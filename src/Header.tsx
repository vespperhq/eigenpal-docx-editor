import { useRef } from "react";
import { Icon } from "./chat/Icon";
import { useDocument } from "./context/ChatContext";
import { useEditorActions } from "./hooks/useEditorActions";

const buttonClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45";

export function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { file, openFile, locked } = useDocument();
  const actions = useEditorActions();

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="m-0 text-base font-semibold">Vespper × docx-editor</h1>
        {file ? (
          <span className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">
            {file.name}
          </span>
        ) : null}
      </div>
      {/* Keep the editor's selection when a header button is pressed. */}
      <div
        className="flex flex-wrap items-center gap-2"
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) e.preventDefault();
        }}
      >
        <button
          type="button"
          className={buttonClassName}
          disabled={!actions.canNavigate}
          onClick={actions.previousChange}
          title="Scroll to the previous tracked change"
        >
          <Icon name="arrowLeft" /> Previous change
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={!actions.canNavigate}
          onClick={actions.nextChange}
          title="Scroll to the next tracked change"
        >
          Next change <Icon name="arrowRight" />
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={!actions.canAcceptAll}
          onClick={actions.acceptAllChanges}
          title="Accept all tracked changes from every author"
        >
          <Icon name="checkCheck" /> Accept all changes
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={!actions.canDownload}
          onClick={actions.download}
          title="Download the current document, with tracked changes"
        >
          <Icon name="download" /> Download .docx
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={locked}
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
            const next = e.target.files?.[0];
            if (next) void openFile(next);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
