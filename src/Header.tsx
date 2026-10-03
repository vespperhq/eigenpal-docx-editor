import { useRef } from "react";
import { Icon } from "./chat/Icon";

type HeaderProps = {
  fileName?: string;
  openDisabled: boolean;
  onOpen: (file: File) => void;
  onDownload?: () => void;
};

const buttonClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45";

export function Header({
  fileName,
  openDisabled,
  onOpen,
  onDownload,
}: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="m-0 text-base font-semibold">Vespper × docx-editor</h1>
        {fileName ? (
          <span className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">
            {fileName}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClassName}
          disabled={!onDownload}
          onClick={onDownload}
          title="Download the current document, with tracked changes"
        >
          <Icon name="download" /> Download .docx
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={openDisabled}
          onClick={() => inputRef.current?.click()}
        >
          <Icon name="file" /> Open .docx
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onOpen(file);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
