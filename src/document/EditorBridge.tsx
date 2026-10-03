import { useEffect } from "react";
import { useDocxEditor } from "@docx-editor.dev/react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";

// `useDocxEditor()` only answers inside `DocxEditor.Root`; the chat panel lives
// beside it. `onEditor` must be stable (a state setter), or every render re-runs
// the unmount path.
export function EditorBridge({
  onEditor,
}: {
  onEditor: (editor: DocxEditorInstance | null) => void;
}) {
  const editor = useDocxEditor();
  useEffect(() => {
    onEditor(editor);
    return () => onEditor(null);
  }, [editor, onEditor]);
  return null;
}
