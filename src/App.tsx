import { useState } from "react";
import { DocxEditor } from "@docx-editor.dev/react";
import { reviewModule } from "@docx-editor.dev/pro/react";
import { ChatPanel } from "./chat/ChatPanel";
import { ChatProvider, type OpenFile } from "./context/ChatContext";
import { DocumentPane } from "./document/DocumentPane";
import { Header } from "./Header";

// Modules register at mount, so the array must be stable across renders.
const MODULES = [reviewModule()];

export function App() {
  const [file, setFile] = useState<OpenFile | null>(null);

  return (
    <DocxEditor.Root
      document={file?.bytes}
      modules={MODULES}
      author="You"
      mode="edit"
    >
      <ChatProvider file={file} onFileChange={setFile}>
        <div className="flex h-full flex-col">
          <Header />
          <main className="grid min-h-0 flex-1 grid-cols-[minmax(320px,38%)_1fr]">
            <ChatPanel />
            <DocumentPane />
          </main>
        </div>
      </ChatProvider>
    </DocxEditor.Root>
  );
}
