import { useRef, useState } from "react";
import {
  createDocumentRefresh,
  type RefreshSubmission,
} from "@docx-editor.dev/react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";
import {
  createUpdateQueue,
  describeRefusal,
  type UpdateQueue,
} from "../agent/updateQueue";
import type {
  ProposedEdit,
  ProposedEditResult,
  Suggestion,
  SuggestionReady,
  SuggestionSet,
} from "../chat/types";
import { closeApplySession, sendApply, type ApplyEdit } from "./apply";

/** Failure codes for a suggestion whose text changed after it was proposed. */
export const STALE_ANCHOR_CODES = new Set([
  "anchor_not_found",
  "multiple_matches",
]);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

/**
 * One server session that every accept joins while any apply is in flight:
 * its children share a batch, so each returned revision holds all of them.
 * The editor document is captured once for the whole session, and every
 * returned revision goes through the same refresh queue.
 */
type ApplySession = {
  sessionId: Deferred<string>;
  refresh: Promise<{ submission: RefreshSubmission; queue: UpdateQueue }>;
  ids: string[];
  nextIndex: number;
  inFlight: number;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  // Joiners await it; the opener's own failure is reported on its cards.
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}

function mapSuggestions(
  sets: Record<string, SuggestionSet>,
  ids: ReadonlySet<string>,
  update: (suggestion: Suggestion) => Suggestion
): Record<string, SuggestionSet> {
  return Object.fromEntries(
    Object.entries(sets).map(([setId, set]) => [
      setId,
      {
        ...set,
        suggestions: set.suggestions.map((suggestion) =>
          ids.has(suggestion.id) ? update(suggestion) : suggestion
        ),
      },
    ])
  );
}

function toSuggestion(setId: string, edit: ProposedEdit): Suggestion {
  return {
    id: `${setId}:${edit.index}`,
    index: edit.index,
    old: edit.old,
    proposedNew: edit.new,
    new: edit.new,
    status: "pending",
  };
}

function toSuggestionSet(id: string, result: ProposedEditResult): SuggestionSet {
  return {
    id,
    css: result.css,
    suggestions: result.suggestions.map((edit) => toSuggestion(id, edit)),
  };
}

/** Adds one streamed suggestion; its CSS is appended and deduplicated on render. */
function addStreamedSuggestion(
  sets: Record<string, SuggestionSet>,
  { tool_call_id: setId, suggestion, css }: SuggestionReady
): Record<string, SuggestionSet> {
  const set = sets[setId] ?? { id: setId, css: "", suggestions: [] };
  const others = set.suggestions.filter(
    (existing) => existing.index !== suggestion.index
  );
  return {
    ...sets,
    [setId]: {
      ...set,
      css: `${set.css}\n${css}`,
      suggestions: [...others, toSuggestion(setId, suggestion)].sort(
        (a, b) => a.index - b.index
      ),
    },
  };
}

function describeSuggestion(suggestion: Suggestion): string {
  switch (suggestion.status) {
    case "applied":
      return suggestion.new === suggestion.proposedNew
        ? "applied"
        : "applied after the user edited it";
    case "rejected":
      return "rejected";
    case "failed":
      return STALE_ANCHOR_CODES.has(suggestion.failure?.code ?? "")
        ? "failed because the text had changed"
        : `failed (${suggestion.failure?.reason ?? "unknown error"})`;
    case "applying":
      return "still being applied";
    case "pending":
      return "not reviewed yet";
  }
}

/** The history note that tells the agent what became of its suggestions. */
function describeSuggestionReview(set: SuggestionSet | undefined) {
  if (!set?.suggestions.length) return undefined;
  const outcomes = set.suggestions.map(
    (suggestion) => `#${suggestion.index} ${describeSuggestion(suggestion)}`
  );
  return `Suggestion review: ${outcomes.join(", ")}.`;
}

export function useSuggestions(editor: DocxEditorInstance | null) {
  const [sets, setSets] = useState<Record<string, SuggestionSet>>({});
  const [applying, setApplying] = useState(false);
  const session = useRef<ApplySession | null>(null);
  // Ids already sent, so a quick second accept can't send a card twice.
  const claimed = useRef(new Set<string>());

  function updateSuggestions(ids: string[], patch: Partial<Suggestion>) {
    setSets((previous) =>
      mapSuggestions(previous, new Set(ids), (suggestion) => ({
        ...suggestion,
        ...patch,
      }))
    );
  }

  function failSuggestions(
    ids: string[],
    statuses: Suggestion["status"][],
    reason: string
  ) {
    setSets((previous) =>
      mapSuggestions(previous, new Set(ids), (suggestion) =>
        statuses.includes(suggestion.status)
          ? { ...suggestion, status: "failed", failure: { code: null, reason } }
          : suggestion
      )
    );
  }

  async function finishSession(current: ApplySession) {
    const refresh = await current.refresh.catch(() => null);
    if (refresh) {
      await refresh.queue.drain();
      if (refresh.queue.refused) {
        // The server applied these, but the editor never showed the result.
        failSuggestions(
          current.ids,
          ["applying", "applied"],
          describeRefusal(refresh.queue.refused.code)
        );
      }
      if (editor) createDocumentRefresh(editor).finish(refresh.submission);
    }
    const sessionId = await current.sessionId.promise.catch(() => null);
    if (sessionId) await closeApplySession(sessionId).catch(console.error);
  }

  async function apply(ids: string[]) {
    if (!editor) return;
    const wanted = new Set(ids);
    const edits: ApplyEdit[] = Object.values(sets)
      .flatMap((set) => set.suggestions)
      .filter(
        (suggestion) =>
          wanted.has(suggestion.id) &&
          suggestion.status === "pending" &&
          !claimed.current.has(suggestion.id)
      )
      .map(({ id, old, new: replacement }) => ({ id, old, new: replacement }));
    if (edits.length === 0) return;
    const editIds = edits.map((edit) => edit.id);
    for (const id of editIds) claimed.current.add(id);
    updateSuggestions(editIds, { status: "applying" });

    const opening = session.current === null;
    if (opening) {
      const refresh = createDocumentRefresh(editor);
      session.current = {
        sessionId: createDeferred<string>(),
        refresh: refresh.capture().then((submission) => ({
          submission,
          queue: createUpdateQueue(refresh, submission),
        })),
        ids: [],
        nextIndex: 0,
        inFlight: 0,
      };
    }
    const current = session.current!;
    const startIndex = current.nextIndex;
    current.nextIndex += edits.length;
    current.ids.push(...editIds);
    current.inFlight += 1;
    setApplying(true);
    try {
      const { submission, queue } = await current.refresh;
      const target = opening
        ? { file: submission.bytes }
        : { sessionId: await current.sessionId.promise, startIndex };
      await sendApply({ ...target, edits }, async (event) => {
        if (event.type === "session") {
          current.sessionId.resolve(event.sessionId);
        } else if (event.type === "edit_applied") {
          queue.push(event);
        } else if (event.type === "suggestion_applied") {
          updateSuggestions([event.id], { status: "applied" });
        } else if (event.type === "suggestion_failed") {
          updateSuggestions([event.id], {
            status: "failed",
            failure: { code: event.code, reason: event.reason },
          });
        }
      });
      failSuggestions(
        editIds,
        ["applying"],
        "The apply ended before this edit finished."
      );
    } catch (error) {
      if (opening) current.sessionId.reject(error);
      failSuggestions(
        editIds,
        ["applying"],
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      current.inFlight -= 1;
      if (current.inFlight === 0) {
        session.current = null;
        await finishSession(current);
        setApplying(false);
      }
    }
  }

  return {
    sets,
    applying,
    apply,
    addSuggestion: (event: SuggestionReady) =>
      setSets((previous) => addStreamedSuggestion(previous, event)),
    // The call's final result is authoritative: it replaces the streamed cards,
    // dropping any its batch check rejected. Cards can't be acted on while the
    // agent is still running, so nothing the user did is lost.
    addSet: (id: string, result: ProposedEditResult) =>
      setSets((previous) => ({ ...previous, [id]: toSuggestionSet(id, result) })),
    reject: (id: string) => updateSuggestions([id], { status: "rejected" }),
    edit: (id: string, html: string) => updateSuggestions([id], { new: html }),
    getReview: (setId: string) => describeSuggestionReview(sets[setId]),
    reset: () => {
      setSets({});
      claimed.current.clear();
    },
  };
}

export type Suggestions = ReturnType<typeof useSuggestions>;
