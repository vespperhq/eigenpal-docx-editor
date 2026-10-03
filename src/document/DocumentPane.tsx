import { useRef, useState } from "react";
import { DocxEditor } from "@docx-editor.dev/react";
import { DocxEditorReview, reviewModule } from "@docx-editor.dev/pro/react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";
import "@docx-editor.dev/core/styles/editor.css";
import { Icon } from "../chat/Icon";
import { EditorBridge } from "./EditorBridge";

// Modules register at mount, so the array must be stable across renders.
const MODULES = [reviewModule()];

type DocumentPaneProps = {
  bytes: Uint8Array | undefined;
  locked: boolean;
  onFile: (file: File) => void;
  onEditor: (editor: DocxEditorInstance | null) => void;
};

export function DocumentPane({
  bytes,
  locked,
  onFile,
  onEditor,
}: DocumentPaneProps) {
  const [dragging, setDragging] = useState(false);

  function pick(file: File | null | undefined) {
    if (file?.name.toLowerCase().endsWith(".docx")) onFile(file);
  }

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-col bg-background"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      {bytes ? (
        <div className="docx-editor flex min-h-0 flex-1 flex-col">
          <DocxEditor.Root
            document={bytes}
            modules={MODULES}
            author="You"
            mode={locked ? "view" : "edit"}
          >
            <EditorBridge onEditor={onEditor} />
            <DocxEditor.Toolbar />
            <DocxEditor.Viewport style={{ flex: 1, minHeight: 0 }}>
              <DocxEditor.Content />
              <DocxEditorReview />
            </DocxEditor.Viewport>
          </DocxEditor.Root>
        </div>
      ) : (
        <DropZone onPick={pick} />
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-brand/50 bg-brand/5 text-sm font-medium text-brand">
          Drop to load
        </div>
      )}
    </section>
  );
}

function DropZone({ onPick }: { onPick: (file: File | undefined) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-dashed border-border px-8 py-12 text-center">
        <Icon name="file" className="mx-auto mb-3 size-10 text-muted-foreground" />
        <p className="m-0 text-sm font-medium">Drop a .docx here</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The agent's edits stream in as tracked changes.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
