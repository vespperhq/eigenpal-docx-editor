import { useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
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
          <Group orientation="horizontal" className="min-h-0 flex-1">
            <Panel defaultSize="38%" minSize={320} maxSize="65%">
              <ChatPanel />
            </Panel>
            <Separator className="w-px bg-border outline-none transition-colors focus-visible:bg-brand data-[separator=active]:bg-brand data-[separator=hover]:bg-brand/50" />
            <Panel minSize={360}>
              <DocumentPane />
            </Panel>
          </Group>
        </div>
      </ChatProvider>
    </DocxEditor.Root>
  );
}
