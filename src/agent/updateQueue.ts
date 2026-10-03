import type {
  DocumentRefresh,
  RefreshHighlightOptions,
  RefreshResult,
  RefreshSubmission,
} from "@docx-editor.dev/react";
import type { DocumentUpdate } from "../chat/types";

const HIGHLIGHT: RefreshHighlightOptions = {
  timeoutMs: 3000,
  animation: { durationMs: 180, exitDurationMs: 300 },
};

type Refusal = Extract<RefreshResult, { ok: false }>;

export type UpdateQueue = ReturnType<typeof createUpdateQueue>;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Applies cumulative server documents one at a time. When several revisions
 * arrive during a replacement, only the newest is loaded: each file is the
 * complete document, and the sequence only has to increase.
 */
export function createUpdateQueue(
  refresh: DocumentRefresh,
  submission: RefreshSubmission
) {
  let latest = -1;
  let applied = -1;
  let refused: Refusal | null = null;
  let chain = Promise.resolve();

  function push({ revision, docx_b64 }: DocumentUpdate): void {
    if (revision <= latest || refused) return;
    latest = revision;
    chain = chain.then(async () => {
      if (revision !== latest || refused) return;
      // No `changes`: the review module locates the tracked revisions that
      // Vespper wrote into the file, and only new ones get highlighted.
      const result = await refresh.applyUpdate({
        submission,
        sequence: revision,
        bytes: base64ToBytes(docx_b64),
      });
      if (!result.ok) {
        refused = result;
        return;
      }
      applied = revision;
      refresh.highlightChanges(HIGHLIGHT);
    });
  }

  return {
    push,
    drain: () => chain,
    get applied() {
      return applied;
    },
    get refused() {
      return refused;
    },
  };
}
