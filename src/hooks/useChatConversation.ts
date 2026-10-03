import { useEffect, useRef, useState } from "react";
import {
  createDocumentRefresh,
  useDocxEditor,
  type RefreshSubmission,
} from "@docx-editor.dev/react";
import { streamProcess } from "../agent/process";
import {
  createUpdateQueue,
  describeRefusal,
  type UpdateQueue,
} from "../agent/updateQueue";
import {
  applyTraceEvents,
  buildUserMessage,
  emptyTurn,
  togglePartOpen,
  turnsToMessages,
} from "../chat/trace";
import {
  ProposedEditResultSchema,
  TraceEventType,
  type MessageImage,
  type ProposedEditResult,
  type SuggestionReady,
  type TraceEvent,
  type Turn,
} from "../chat/types";

type UseChatConversationOptions = {
  instruction: string;
  selectedContent: string;
  images: MessageImage[];
  imagesLoading: boolean;
  model: string;
  clearComposer: () => void;
  /** Accepted suggestions are still being applied; a new turn must wait. */
  applying: boolean;
  onSuggestionsProposed: (toolCallId: string, result: ProposedEditResult) => void;
  onSuggestionReady: (event: SuggestionReady) => void;
  getSuggestionReview: (setId: string) => string | undefined;
};

export function useChatConversation({
  instruction,
  selectedContent,
  images,
  imagesLoading,
  model,
  clearComposer,
  applying,
  onSuggestionsProposed,
  onSuggestionReady,
  getSuggestionReview,
}: UseChatConversationOptions) {
  const editor = useDocxEditor();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef<{
    controller: AbortController;
    stopped: boolean;
  } | null>(null);

  useEffect(
    () => () => {
      activeRef.current?.controller.abort();
    },
    []
  );

  function patchLastTurn(updater: (turn: Turn) => Turn) {
    setTurns((previous) => {
      if (!previous.length) return previous;
      const copy = previous.slice();
      copy[copy.length - 1] = updater(copy[copy.length - 1]);
      return copy;
    });
  }

  function togglePart(turnIndex: number, id: string) {
    setTurns((previous) =>
      previous.map((turn, index) =>
        index === turnIndex ? togglePartOpen(turn, id) : turn
      )
    );
  }

  function reset() {
    setTurns([]);
  }

  function stop() {
    const active = activeRef.current;
    if (!active || active.stopped) return;
    active.stopped = true;
    active.controller.abort();
    if (editor) createDocumentRefresh(editor).cancel();
  }

  async function send() {
    if (!editor || busy || imagesLoading || applying) return;
    const text = instruction.trim();
    const imagesForTurn = images;
    const selectedContentForTurn = selectedContent;
    const currentMessage = buildUserMessage(
      text,
      selectedContentForTurn,
      imagesForTurn
    );
    if (!currentMessage) return;

    const history = [
      ...turnsToMessages(turns, getSuggestionReview),
      currentMessage,
    ];
    clearComposer();
    setTurns((previous) => [
      ...previous,
      emptyTurn(text, selectedContentForTurn, imagesForTurn),
    ]);

    const thisRun = { controller: new AbortController(), stopped: false };
    activeRef.current = thisRun;
    setBusy(true);

    const refresh = createDocumentRefresh(editor);
    let submission: RefreshSubmission | undefined;
    let queue: UpdateQueue | undefined;
    let queuedTraceEvents: TraceEvent[] = [];
    let traceFrame: number | null = null;

    const flushTraceEvents = () => {
      if (!queuedTraceEvents.length) return;
      const events = queuedTraceEvents;
      queuedTraceEvents = [];
      patchLastTurn((turn) => applyTraceEvents(turn, events));
    };

    const flushTraceEventsNow = () => {
      if (traceFrame != null) {
        cancelAnimationFrame(traceFrame);
        traceFrame = null;
      }
      flushTraceEvents();
    };

    const queueTraceEvent = (event: TraceEvent) => {
      if (
        event.type === TraceEventType.TOOL_RESULT &&
        event.payload.toolName === "edit_document"
      ) {
        const proposed = ProposedEditResultSchema.safeParse(event.payload.result);
        if (proposed.success) {
          onSuggestionsProposed(event.payload.toolCallId, proposed.data);
        }
      }
      queuedTraceEvents.push(event);
      const isDelta =
        event.type === TraceEventType.REASONING_DELTA ||
        event.type === TraceEventType.TEXT_DELTA ||
        event.type === TraceEventType.TOOL_CALL_DELTA;
      if (!isDelta) {
        flushTraceEventsNow();
      } else if (traceFrame == null) {
        traceFrame = requestAnimationFrame(() => {
          traceFrame = null;
          flushTraceEvents();
        });
      }
    };

    try {
      submission = await refresh.capture();
      queue = createUpdateQueue(refresh, submission);

      await streamProcess({
        bytes: submission.bytes,
        messages: history,
        model,
        signal: thisRun.controller.signal,
        onEvent: queueTraceEvent,
        onDocument: queue.push,
        onSuggestionReady,
      });
      await queue.drain();
      flushTraceEventsNow();

      if (thisRun.controller.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (queue.refused) throw new Error(describeRefusal(queue.refused.code));
      patchLastTurn((turn) => ({ ...turn, working: false }));
    } catch (error) {
      await queue?.drain();
      flushTraceEventsNow();
      const appliedDuringRun = (queue?.applied ?? -1) >= 0;

      if (thisRun.stopped) {
        const note = appliedDuringRun
          ? "Stopped — edits applied before cancellation remain in the document."
          : "Stopped — no changes were applied to your document.";
        patchLastTurn((turn) => ({
          ...turn,
          working: false,
          note,
          summarySuperseded: Boolean(turn.summary.trim()),
        }));
        return;
      }

      const message =
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError")
          ? "Server request timed out (agent edits can take several minutes)."
          : error instanceof Error
            ? error.message
            : String(error);
      patchLastTurn((turn) => ({
        ...turn,
        working: false,
        error: appliedDuringRun
          ? `The agent failed after applying some edits — ${message}`
          : `No changes were applied to your document — ${message}`,
        summarySuperseded: Boolean(turn.summary.trim()),
      }));
    } finally {
      if (submission) refresh.finish(submission);
      patchLastTurn((turn) =>
        turn.working ? { ...turn, working: false } : turn
      );
      activeRef.current = null;
      setBusy(false);
    }
  }

  return { turns, busy, send, stop, reset, togglePart };
}
