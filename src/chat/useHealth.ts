import { useEffect, useState } from "react";

type HealthResponse = {
  availableModels?: string[];
  defaultModel?: string;
  /** The agent proposes edits as suggestions instead of applying them. */
  suggestions?: boolean;
};

/** Server configuration from `/health`: the model picker and suggestion mode. */
export function useHealth() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/health", { signal: controller.signal })
      .then((resp) => resp.json() as Promise<HealthResponse>)
      .then((health) => {
        setModels(health.availableModels ?? []);
        setModel((current) => current || health.defaultModel || "");
        setSuggestions(health.suggestions === true);
      })
      .catch(() => {
        // The server picks its default model when none is sent.
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { model, models, modelsLoading, setModel, suggestions };
}

export type ModelSelection = ReturnType<typeof useHealth>;
