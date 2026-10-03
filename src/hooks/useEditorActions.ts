import { useDocxEditor } from "@docx-editor.dev/react";
import { useDocument } from "../context/ChatContext";
import { downloadDocx } from "../document/download";

/** Header actions on the open document. */
export function useEditorActions() {
  const editor = useDocxEditor();
  const { file, locked } = useDocument();
  const ready = Boolean(editor && file);

  return {
    canDownload: ready && !locked,
    download: () => {
      if (editor && file) void downloadDocx(editor, file.name);
    },
  };
}
