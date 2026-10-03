import { createContext, useContext } from "react";
import type { Suggestions } from "./useSuggestions";

type SuggestionsContextValue = {
  suggestions: Suggestions;
  /** The server proposes edits as suggestions instead of applying them. */
  enabled: boolean;
  /** An agent turn is running; cards can't be acted on until it ends. */
  busy: boolean;
};

const SuggestionsContext = createContext<SuggestionsContextValue | undefined>(
  undefined
);

export const SuggestionsProvider = SuggestionsContext.Provider;

export function useSuggestionsContext(): SuggestionsContextValue {
  const context = useContext(SuggestionsContext);
  if (!context) {
    throw new Error("Suggestion components must be used within SuggestionsProvider");
  }
  return context;
}
