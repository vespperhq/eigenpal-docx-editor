import { useDocxEditor } from "@docx-editor.dev/react";
import { useDocument } from "../context/ChatContext";
import { downloadDocx } from "../document/download";

/**
 * Header actions on the open document. Previous, next, and accept all are the
 * commands behind the editor's Review menu.
 */
export function useEditorActions() {
  const editor = useDocxEditor();
  const { file, locked } = useDocument();
  const ready = Boolean(editor && file);

  return {
    canNavigate: ready,
    canAcceptAll: ready && !locked,
    canDownload: ready && !locked,
    previousChange: () =>
      void editor?.exec({ type: "navigateReviewChange", direction: "previous" }),
    nextChange: () =>
      void editor?.exec({ type: "navigateReviewChange", direction: "next" }),
    acceptAllChanges: () =>
      void editor?.exec({
        type: "resolveAllReviewChanges",
        action: "accept",
        // The default only resolves changes left visible by reviewer filters.
        scope: "document",
      }),
    download: () => {
      if (editor && file) void downloadDocx(editor, file.name);
    },
  };
}
