import { useEffect, useState } from "react";

type HealthResponse = {
  availableModels?: string[];
  defaultModel?: string;
};

export function useModels() {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/health", { signal: controller.signal })
      .then((resp) => resp.json() as Promise<HealthResponse>)
      .then((health) => {
        setModels(health.availableModels ?? []);
        setModel((current) => current || health.defaultModel || "");
      })
      .catch(() => {
        // The server picks its default model when none is sent.
      })
      .finally(() => {
        if (!controller.signal.aborted) setModelsLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { model, models, modelsLoading, setModel };
}

export type ModelSelection = ReturnType<typeof useModels>;
