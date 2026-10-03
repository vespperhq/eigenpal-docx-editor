import type {
  DocumentRefresh,
  RefreshFailureCode,
  RefreshHighlightOptions,
  RefreshResult,
  RefreshSubmission,
} from "@docx-editor.dev/react";

const HIGHLIGHT: RefreshHighlightOptions = {
  timeoutMs: 3000,
  animation: { durationMs: 180, exitDurationMs: 300 },
};

type Refusal = Extract<RefreshResult, { ok: false }>;

/** One cumulative server document, tagged with its session revision. */
export type RevisionUpdate = { revision: number; docx_b64: string };

export type UpdateQueue = ReturnType<typeof createUpdateQueue>;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function describeRefusal(code: RefreshFailureCode): string {
  switch (code) {
    case "local-edits":
      return "The document was edited while the update was running, so later edits were not applied.";
    case "invalid-document":
      return "The server returned a file that is not a valid .docx.";
    default:
      return `The editor refused the updated document (${code}).`;
  }
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

  function push({ revision, docx_b64 }: RevisionUpdate): void {
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
