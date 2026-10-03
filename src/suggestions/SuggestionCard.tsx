import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Icon, iconButtonClassName } from "../chat/Icon";
import type { Suggestion, SuggestionStatus } from "../chat/types";
import { SuggestionEditor } from "./SuggestionEditor";
import { useSuggestionsContext } from "./SuggestionsContext";
import { STALE_ANCHOR_CODES } from "./useSuggestions";

const STATUS_ICONS: Partial<
  Record<SuggestionStatus, { name: string; label: string; className: string }>
> = {
  applying: { name: "loader", label: "Applying", className: "animate-spin" },
  applied: { name: "check", label: "Applied", className: "text-brand" },
  rejected: { name: "close", label: "Rejected", className: "" },
  failed: { name: "alert", label: "Failed", className: "text-destructive" },
};

const STALE_ANCHOR_MESSAGE =
  "The text this suggestion changes is no longer in the document. It was edited after the suggestion was made. If the change is still wanted, ask the agent to propose it again against the current text.";

/** Matches `max-h-40`, the height a collapsed card is clipped to. */
const COLLAPSED_HEIGHT_PX = 160;

/** Whether the element is taller than `height`, tracked as its content changes. */
function useIsTallerThan(ref: RefObject<HTMLElement | null>, height: number) {
  const [taller, setTaller] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() =>
      setTaller(element.offsetHeight > height),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, height]);
  return taller;
}

export function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const {
    suggestions: { apply, reject, edit },
    busy,
  } = useSuggestionsContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const tall = useIsTallerThan(contentRef, COLLAPSED_HEIGHT_PX);
  const [expanded, setExpanded] = useState(false);
  const collapsed = tall && !expanded;
  const actionable = suggestion.status === "pending" && !busy;
  const statusIcon = STATUS_ICONS[suggestion.status];
  return (
    <article
      className="group relative rounded-2xl border border-transparent bg-muted p-3 pr-16 text-[13px] transition-[border-color,box-shadow] duration-200 ease-out data-[status=rejected]:opacity-50 has-[.ProseMirror-focused]:border-brand/35 has-[.ProseMirror-focused]:ring-3 has-[.ProseMirror-focused]:ring-brand/10"
      data-status={suggestion.status}
    >
      <div className="absolute top-1.5 right-1.5 flex gap-0.5">
        {actionable ? (
          <div className="hidden gap-0.5 group-hover:flex group-focus-within:flex">
            <button
              type="button"
              aria-label="Accept"
              title="Accept"
              className={iconButtonClassName}
              onClick={() => void apply([suggestion.id])}
            >
              <Icon name="check" />
            </button>
            <button
              type="button"
              aria-label="Reject"
              title="Reject"
              className={iconButtonClassName}
              onClick={() => reject(suggestion.id)}
            >
              <Icon name="close" />
            </button>
          </div>
        ) : statusIcon ? (
          <span
            className="inline-flex size-[30px] items-center justify-center text-muted-foreground"
            title={statusIcon.label}
          >
            <Icon name={statusIcon.name} className={statusIcon.className} />
          </span>
        ) : null}
      </div>
      <div className={collapsed ? "relative max-h-40 overflow-hidden" : ""}>
        <div ref={contentRef}>
          <SuggestionEditor
            old={suggestion.old}
            initialNew={suggestion.proposedNew}
            editable={actionable}
            onChange={(html) => edit(suggestion.id, html)}
          />
        </div>
        {collapsed ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-b from-transparent to-muted" />
        ) : null}
      </div>
      {tall ? (
        <button
          type="button"
          className="mt-1 border-0 bg-transparent p-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
      {suggestion.failure ? (
        <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          {STALE_ANCHOR_CODES.has(suggestion.failure.code ?? "")
            ? STALE_ANCHOR_MESSAGE
            : suggestion.failure.reason}
        </p>
      ) : null}
    </article>
  );
}
