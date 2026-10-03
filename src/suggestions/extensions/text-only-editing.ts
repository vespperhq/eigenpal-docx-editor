import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

const swallow = () => true;

/**
 * Cards edit text only: no new blocks, no formatting, and pasted content
 * arrives as plain text, so the HTML keeps the document's own structure.
 */
export const TextOnlyEditing = Extension.create({
  name: "textOnlyEditing",
  priority: 1000,
  addKeyboardShortcuts: () => ({
    Enter: swallow,
    "Shift-Enter": swallow,
    "Mod-Enter": swallow,
    "Mod-b": swallow,
    "Mod-i": swallow,
    "Mod-u": swallow,
  }),
  addProseMirrorPlugins: () => [
    new Plugin({
      props: {
        handlePaste: (view, event) => {
          view.dispatch(
            view.state.tr.insertText(
              event.clipboardData?.getData("text/plain") ?? "",
            ),
          );
          return true;
        },
        handleDrop: swallow,
      },
    }),
  ],
});
