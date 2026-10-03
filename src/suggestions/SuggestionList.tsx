import { useMemo } from "react";
import type { Suggestion } from "../chat/types";
import { buildCardCss } from "./css";
import { useChatSuggestions, useConversation } from "../context/ChatContext";
import { SuggestionCard } from "./SuggestionCard";

// SuggestionEditor renders card content inside this class.
const SCOPE = ".vespper-docx";

/** Drops a pair a later call proposed again, keeping its first card. */
function getUniqueSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = JSON.stringify([suggestion.old, suggestion.proposedNew]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The suggestions of one turn's edit_document calls, under one "N suggestions"
 * and Apply all: a retry call for the edits that failed to localize joins the
 * first call's group.
 */
export function SuggestionList({ setIds }: { setIds: string[] }) {
  const { sets, apply } = useChatSuggestions();
  const { busy } = useConversation();
  const groupSets = setIds.flatMap((id) => (sets[id] ? [sets[id]] : []));
  const cssSource = groupSets.map((set) => set.css).join("\n");
  const css = useMemo(() => buildCardCss(cssSource, SCOPE), [cssSource]);
  const suggestions = getUniqueSuggestions(
    groupSets.flatMap((set) => set.suggestions),
  );
  if (!suggestions.length) return null;
  const pending = suggestions.filter(
    (suggestion) => suggestion.status === "pending",
  );
  return (
    <section className="flex flex-col gap-2">
      <style>{css}</style>
      <header className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-foreground">
          {suggestions.length}{" "}
          {suggestions.length === 1 ? "suggestion" : "suggestions"}
        </span>
        <button
          type="button"
          disabled={busy || pending.length === 0}
          onClick={() => void apply(pending.map((suggestion) => suggestion.id))}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
        >
          Apply all
        </button>
      </header>
      {suggestions.map((suggestion) => (
        <SuggestionCard key={suggestion.id} suggestion={suggestion} />
      ))}
    </section>
  );
}
