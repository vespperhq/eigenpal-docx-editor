import {
  DocumentUpdateSchema,
  TraceEventType,
  type ChatMessage,
  type DocumentUpdate,
  type TraceEvent,
} from "../chat/types";

const FETCH_TIMEOUT_MS = 300_000;

export type ProcessArg = {
  bytes: ArrayBuffer;
  messages: ChatMessage[];
  model: string;
  signal: AbortSignal;
  onEvent: (event: TraceEvent) => void;
  onDocument: (update: DocumentUpdate) => void;
};

type StreamMessage = {
  type: string;
  payload?: Record<string, unknown>;
  detail?: unknown;
};

const TRACE_EVENT_TYPES = new Set<string>(Object.values(TraceEventType));

function removeDocumentFromEvent(event: TraceEvent): TraceEvent {
  if (event.type !== TraceEventType.TOOL_RESULT) return event;
  const result = event.payload.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return event;
  }
  const { base64: _base64, ...output } = result as Record<string, unknown>;
  return { ...event, payload: { ...event.payload, result: output } };
}

async function parseJsonError(resp: Response): Promise<string> {
  const text = await resp.text();
  try {
    const body = JSON.parse(text) as { error?: string };
    return body.error ?? text;
  } catch {
    return text || `Server error ${resp.status}`;
  }
}

async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<StreamMessage> {
  const reader = body.getReader();
  const cancel = () => void reader.cancel().catch(() => undefined);
  signal.addEventListener("abort", cancel, { once: true });
  const decoder = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          yield JSON.parse(line) as StreamMessage;
        } catch {
          // Ignore a malformed line and keep streaming.
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

/**
 * Streams one agent turn. Every committed document revision goes to
 * `onDocument` as it arrives; the final `done` document is passed there too.
 */
export async function streamProcess(arg: ProcessArg): Promise<void> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([arg.bytes], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "document.docx",
  );
  form.append("messages", JSON.stringify(arg.messages));
  form.append("model", arg.model);

  const signal = AbortSignal.any([
    arg.signal,
    AbortSignal.timeout(FETCH_TIMEOUT_MS),
  ]);
  const resp = await fetch("/api/process", {
    method: "POST",
    body: form,
    signal,
  });
  if (!resp.ok) throw new Error(await parseJsonError(resp));
  if (!resp.body) throw new Error("No response body to stream.");

  let finished = false;
  let errorDetail: string | null = null;
  for await (const msg of readNdjson(resp.body, signal)) {
    if (msg.type === "done") finished = true;
    if (msg.type === "edit_applied" || msg.type === "done") {
      const update = DocumentUpdateSchema.safeParse(msg);
      if (update.success) {
        arg.onDocument(update.data);
      }
    } else if (msg.type === TraceEventType.ERROR && msg.detail != null) {
      errorDetail = String(msg.detail);
    } else if (TRACE_EVENT_TYPES.has(msg.type)) {
      arg.onEvent({
        ...removeDocumentFromEvent(msg as TraceEvent),
        receivedAt: performance.now(),
      });
    }
  }

  if (arg.signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (errorDetail) throw new Error(errorDetail);
  if (!finished) throw new Error("Agent finished without a response.");
}
