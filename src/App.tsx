import { useState } from "react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";
import { useAgentTurn } from "./agent/useAgentTurn";
import { ChatPanel } from "./chat/ChatPanel";
import { useHealth } from "./chat/useHealth";
import { DocumentPane } from "./document/DocumentPane";
import { downloadDocx } from "./document/download";
import { Header } from "./Header";
import { useSuggestions } from "./suggestions/useSuggestions";

type OpenFile = { name: string; bytes: Uint8Array };

function getDownloadHandler(
  editor: DocxEditorInstance | null,
  file: OpenFile | null,
  busy: boolean
): (() => void) | undefined {
  if (!editor || !file || busy) return undefined;
  return () => void downloadDocx(editor, file.name);
}

export function App() {
  const [file, setFile] = useState<OpenFile | null>(null);
  const [editor, setEditor] = useState<DocxEditorInstance | null>(null);
  const health = useHealth();
  const suggestions = useSuggestions(editor);
  const agent = useAgentTurn({ editor, model: health.model, suggestions });
  // The agent or an apply is replacing the document; local edits would be refused.
  const busy = agent.busy || suggestions.applying;

  async function openFile(next: File) {
    if (busy) return;
    const bytes = new Uint8Array(await next.arrayBuffer());
    agent.reset();
    suggestions.reset();
    setFile({ name: next.name, bytes });
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        fileName={file?.name}
        openDisabled={busy}
        onOpen={openFile}
        onDownload={getDownloadHandler(editor, file, busy)}
      />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,38%)_1fr]">
        <ChatPanel
          agent={agent}
          suggestions={suggestions}
          models={health}
          disabled={!editor}
        />
        <DocumentPane
          bytes={file?.bytes}
          locked={busy}
          onFile={openFile}
          onEditor={setEditor}
        />
      </main>
    </div>
  );
}
