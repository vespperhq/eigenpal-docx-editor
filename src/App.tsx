import { useState } from "react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";
import { useAgentTurn } from "./agent/useAgentTurn";
import { ChatPanel } from "./chat/ChatPanel";
import { useModels } from "./chat/useModels";
import { DocumentPane } from "./document/DocumentPane";
import { downloadDocx } from "./document/download";
import { Header } from "./Header";

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
  const models = useModels();
  const agent = useAgentTurn({ editor, model: models.model });

  async function openFile(next: File) {
    if (agent.busy) return;
    const bytes = new Uint8Array(await next.arrayBuffer());
    agent.reset();
    setFile({ name: next.name, bytes });
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        fileName={file?.name}
        openDisabled={agent.busy}
        onOpen={openFile}
        onDownload={getDownloadHandler(editor, file, agent.busy)}
      />
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,38%)_1fr]">
        <ChatPanel agent={agent} models={models} disabled={!editor} />
        <DocumentPane
          bytes={file?.bytes}
          locked={agent.busy}
          onFile={openFile}
          onEditor={setEditor}
        />
      </main>
    </div>
  );
}
