import * as z from "zod/mini";
import type { MessageImage } from "../../shared/messages";

export type {
  ChatMessage,
  ImageMimeType,
  MessageImage,
  UserMessagePart,
} from "../../shared/messages";

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available";

export enum TraceEventType {
  REASONING_START = "reasoning-start",
  REASONING_DELTA = "reasoning-delta",
  REASONING_END = "reasoning-end",
  TEXT_START = "text-start",
  TEXT_DELTA = "text-delta",
  TEXT_END = "text-end",
  TOOL_CALL_INPUT_STREAMING_START = "tool-call-input-streaming-start",
  TOOL_CALL_DELTA = "tool-call-delta",
  TOOL_CALL = "tool-call",
  TOOL_RESULT = "tool-result",
  TOOL_ERROR = "tool-error",
  FINISH = "finish",
  ERROR = "error",
}

export type TracePart = {
  id: string;
  kind: "tool" | "reasoning" | "text";
  name?: string;
  state?: ToolState;
  text?: string;
  thinkMs?: number;
  reasoningStartedAt?: number;
  argumentsStartedAt?: number;
  toolStartedAt?: number;
  argsMs?: number;
  runMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  argsText?: string;
  open?: boolean;
  userToggled?: boolean;
};

export type Turn = {
  instruction: string;
  selectedContent?: string;
  images: MessageImage[];
  parts: TracePart[];
  summary: string;
  working: boolean;
  error?: string;
  note?: string;
  summarySuperseded?: boolean;
};

type ReasoningPayload = {
  id: string;
  text?: string;
};

type ToolPayload = {
  toolCallId: string;
  toolName?: string;
  argsTextDelta?: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  isError?: boolean;
};

type TextPayload = {
  id?: string;
  text?: string;
};

type TraceEventData =
  | { type: TraceEventType.REASONING_START; payload: ReasoningPayload }
  | { type: TraceEventType.REASONING_DELTA; payload: ReasoningPayload }
  | { type: TraceEventType.REASONING_END; payload: ReasoningPayload }
  | { type: TraceEventType.TEXT_START; payload: TextPayload }
  | { type: TraceEventType.TEXT_DELTA; payload: TextPayload }
  | { type: TraceEventType.TEXT_END; payload: TextPayload }
  | {
      type: TraceEventType.TOOL_CALL_INPUT_STREAMING_START;
      payload: ToolPayload;
    }
  | { type: TraceEventType.TOOL_CALL_DELTA; payload: ToolPayload }
  | { type: TraceEventType.TOOL_CALL; payload: ToolPayload }
  | { type: TraceEventType.TOOL_RESULT; payload: ToolPayload }
  | { type: TraceEventType.TOOL_ERROR; payload: ToolPayload }
  | { type: TraceEventType.FINISH; payload?: Record<string, unknown> }
  | {
      type: TraceEventType.ERROR;
      payload?: { error?: unknown; detail?: unknown };
      detail?: unknown;
    };

export type TraceEvent = TraceEventData & {
  receivedAt?: number;
};

export const DocumentUpdateSchema = z.object({
  type: z.enum(["edit_applied", "done"]),
  docx_b64: z.string().check(z.minLength(1)),
  edit_count: z.number().check(z.nonnegative()),
  revision: z.int().check(z.nonnegative()),
});

export type DocumentUpdate = z.infer<typeof DocumentUpdateSchema>;

const ProposedEditSchema = z.object({
  index: z.number(),
  old: z.string(),
  new: z.string(),
  part: z.string(),
});

export type ProposedEdit = z.infer<typeof ProposedEditSchema>;

/** A suggest-mode `edit_document` result: proposed edits, not applied. */
export const ProposedEditResultSchema = z.object({
  status: z.literal("proposed"),
  suggestions: z.array(ProposedEditSchema),
  css: z.string(),
});

export type ProposedEditResult = z.infer<typeof ProposedEditResultSchema>;

/** One pair of a still-streaming edit_document call, already localized. */
export const SuggestionReadySchema = z.object({
  type: z.literal("suggestion_ready"),
  tool_call_id: z.string(),
  suggestion: ProposedEditSchema,
  css: z.string(),
});

export type SuggestionReady = z.infer<typeof SuggestionReadySchema>;

export type SuggestionStatus =
  | "pending"
  | "applying"
  | "applied"
  | "rejected"
  | "failed";

export type Suggestion = {
  /** `${toolCallId}:${index}` */
  id: string;
  index: number;
  /** The resolved anchor; never edited. */
  old: string;
  /** The agent's resolved replacement. */
  proposedNew: string;
  /** What applying writes: `proposedNew` until the user edits the card. */
  new: string;
  status: SuggestionStatus;
  failure?: { code: string | null; reason: string };
};

export type SuggestionSet = {
  id: string;
  css: string;
  suggestions: Suggestion[];
};

export const ApplyEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session"), sessionId: z.string() }),
  z.object({
    type: z.literal("edit_applied"),
    docx_b64: z.string(),
    revision: z.int(),
  }),
  z.object({ type: z.literal("suggestion_applied"), id: z.string() }),
  z.object({
    type: z.literal("suggestion_failed"),
    id: z.string(),
    code: z.nullable(z.string()),
    reason: z.string(),
  }),
  z.object({ type: z.literal("error"), detail: z.string() }),
]);

export type ApplyEvent = z.infer<typeof ApplyEventSchema>;
