import { useRef } from "react";
import { Icon } from "../chat/Icon";

export function DropZone({
  onPick,
}: {
  onPick: (file: File | undefined) => void;
}) {
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
