import { useEffect, useMemo } from "react";
import { UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { htmlElements } from "./extensions/html-elements";
import { SuggestionDiff } from "./extensions/suggestion-diff";
import { TextOnlyEditing } from "./extensions/text-only-editing";
import { parseSuggestionHtml, serializeSuggestionHtml, suggestionSchema } from "./html";

type SuggestionEditorProps = {
  old: string;
  initialNew: string;
  editable: boolean;
  onChange: (html: string) => void;
};

/** One card's replacement HTML, editable as text, shown as a diff against `old`. */
export function SuggestionEditor({
  old,
  initialNew,
  editable,
  onChange,
}: SuggestionEditorProps) {
  const content = useMemo(
    () => parseSuggestionHtml(suggestionSchema, initialNew).toJSON(),
    [initialNew],
  );
  const editor = useEditor({
    extensions: [
      ...htmlElements,
      TextOnlyEditing,
      UndoRedo,
      SuggestionDiff.configure({ oldHtml: old }),
    ],
    content,
    editable,
    enableInputRules: false,
    enablePasteRules: false,
    onUpdate: ({ editor }) => onChange(serializeSuggestionHtml(editor.state.doc)),
  });
  // Without `false`, Tiptap emits an update, and onChange would replace the
  // agent's HTML with a re-serialized copy though nothing was typed.
  useEffect(() => editor?.setEditable(editable, false), [editor, editable]);
  return (
    <EditorContent
      editor={editor}
      className="vespper-docx text-foreground [&_.ProseMirror]:outline-none"
    />
  );
}
