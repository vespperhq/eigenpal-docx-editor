import { useEffect, useRef, useState } from "react";
import {
  createDocumentRefresh,
  type RefreshFailureCode,
  type RefreshSubmission,
} from "@docx-editor.dev/react";
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor";
import {
  applyTraceEvents,
  buildUserMessage,
  emptyTurn,
  togglePartOpen,
  turnsToMessages,
} from "../chat/trace";
import {
  TraceEventType,
  type MessageImage,
  type TraceEvent,
  type Turn,
} from "../chat/types";
import { streamProcess } from "./process";
import { createUpdateQueue, type UpdateQueue } from "./updateQueue";

type UseAgentTurnOptions = {
  editor: DocxEditorInstance | null;
  model: string;
};

function describeRefusal(code: RefreshFailureCode): string {
  switch (code) {
    case "local-edits":
      return "The document was edited while the agent was working, so later agent edits were not applied.";
    case "invalid-document":
      return "The server returned a file that is not a valid .docx.";
    default:
      return `The editor refused the updated document (${code}).`;
  }
}

export function useAgentTurn({ editor, model }: UseAgentTurnOptions) {
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

  async function send(text: string, images: MessageImage[]) {
    if (!editor || busy) return;
    const currentMessage = buildUserMessage(text, undefined, images);
    if (!currentMessage) return;

    const history = [...turnsToMessages(turns), currentMessage];
    setTurns((previous) => [...previous, emptyTurn(text, undefined, images)]);

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

export type AgentTurn = ReturnType<typeof useAgentTurn>;
