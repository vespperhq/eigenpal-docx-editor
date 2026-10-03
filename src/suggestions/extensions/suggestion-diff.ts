import { Extension } from "@tiptap/core";
import {
  ChangeSet,
  simplifyChanges,
  type Change,
  type TokenEncoder,
} from "@tiptap/pm/changeset";
import {
  DOMSerializer,
  type Fragment,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { parseSuggestionHtml } from "../html";

// Tokens carry marks and node attributes, so a change that only swaps a class
// (bold, a style token) counts as a change.
const formattingEncoder: TokenEncoder<string | number> = {
  encodeCharacter: (char, marks) =>
    marks.length
      ? `${char}|${marks.map((mark) => JSON.stringify(mark.attrs)).join("")}`
      : char,
  encodeNodeStart: (node) => `${node.type.name}|${JSON.stringify(node.attrs)}`,
  encodeNodeEnd: () => -1,
  compareTokens: (a, b) => a === b,
};

export function getSuggestionChanges(
  oldDoc: ProseMirrorNode,
  newDoc: ProseMirrorNode,
): readonly Change[] {
  const tr = EditorState.create({ doc: oldDoc }).tr.replaceWith(
    0,
    oldDoc.content.size,
    newDoc.content,
  );
  const changes = ChangeSet.create(
    oldDoc,
    undefined,
    formattingEncoder,
  ).addSteps(tr.doc, tr.mapping.maps, "suggestion").changes;
  return simplifyChanges(changes, tr.doc);
}

/** The deleted range of `oldDoc`, and whether it sits inside one textblock. */
function getDeletedContent(
  oldDoc: ProseMirrorNode,
  from: number,
  to: number,
): { content: Fragment; inline: boolean } {
  const $from = oldDoc.resolve(from);
  const $to = oldDoc.resolve(to);
  if ($from.sameParent($to) && $from.parent.inlineContent) {
    return {
      content: $from.parent.content.cut($from.parentOffset, $to.parentOffset),
      inline: true,
    };
  }
  return { content: oldDoc.slice(from, to).content, inline: false };
}

function renderDeletion(
  serializer: DOMSerializer,
  { content, inline }: { content: Fragment; inline: boolean },
): HTMLElement {
  const element = document.createElement(inline ? "del" : "div");
  element.className = "vespper-suggestion-delete";
  element.contentEditable = "false";
  element.append(serializer.serializeFragment(content, { document }));
  return element;
}

function buildDiffDecorations(
  oldDoc: ProseMirrorNode,
  newDoc: ProseMirrorNode,
): DecorationSet {
  const serializer = DOMSerializer.fromSchema(newDoc.type.schema);
  const decorations = getSuggestionChanges(oldDoc, newDoc).flatMap(
    (change) => [
      ...(change.toA > change.fromA
        ? [
            Decoration.widget(
              change.fromB,
              () =>
                renderDeletion(
                  serializer,
                  getDeletedContent(oldDoc, change.fromA, change.toA),
                ),
              { side: -1, key: `delete-${change.fromA}-${change.toA}` },
            ),
          ]
        : []),
      ...(change.toB > change.fromB
        ? [
            Decoration.inline(change.fromB, change.toB, {
              class: "vespper-suggestion-insert",
            }),
          ]
        : []),
    ],
  );
  return DecorationSet.create(newDoc, decorations);
}

const suggestionDiffKey = new PluginKey<{
  oldDoc: ProseMirrorNode;
  decorations: DecorationSet;
}>("suggestionDiff");

/** Shows the card's current HTML as a diff against `oldHtml`, live as it is edited. */
export const SuggestionDiff = Extension.create<{ oldHtml: string }>({
  name: "suggestionDiff",
  addOptions: () => ({ oldHtml: "" }),
  addProseMirrorPlugins() {
    const { oldHtml } = this.options;
    return [
      new Plugin({
        key: suggestionDiffKey,
        state: {
          init: (_config, state) => {
            const oldDoc = parseSuggestionHtml(state.schema, oldHtml);
            return {
              oldDoc,
              decorations: buildDiffDecorations(oldDoc, state.doc),
            };
          },
          apply: (tr, value, _oldState, newState) =>
            tr.docChanged
              ? {
                  ...value,
                  decorations: buildDiffDecorations(value.oldDoc, newState.doc),
                }
              : value,
        },
        props: {
          decorations: (state) =>
            suggestionDiffKey.getState(state)?.decorations,
        },
      }),
    ];
  },
});
