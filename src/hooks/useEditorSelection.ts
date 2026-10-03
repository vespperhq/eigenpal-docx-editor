import { useCallback, useEffect, useState } from "react";
import { useDocxEditor } from "@docx-editor.dev/react";

const SELECTION_DEBOUNCE_MS = 150;

export function useEditorSelection() {
  const editor = useDocxEditor();
  const [selectedContent, setSelectedContent] = useState("");

  useEffect(() => {
    setSelectedContent("");
    if (!editor) return;

    let timer: number | undefined;
    const unsubscribe = editor.on("selectionChange", (snapshot) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // `selectionCollapsed` is cheap; building the selected text is not.
        setSelectedContent(
          snapshot.selectionCollapsed
            ? ""
            : editor.query({ type: "selectedText" }).trim()
        );
      }, SELECTION_DEBOUNCE_MS);
    });

    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [editor]);

  const clearSelectedContent = useCallback(() => setSelectedContent(""), []);

  return { selectedContent, clearSelectedContent };
}
