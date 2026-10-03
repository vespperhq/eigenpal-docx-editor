import { randomUUID } from "node:crypto";
import { PassThrough, Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { MCPClient } from "@mastra/mcp";
import Vespper, { type SuggestEditResult } from "vespper";
import {
  DEFAULT_MODEL,
  MAX_ROUNDS,
  META_BATCH_ID,
  META_EDIT_INDEX,
  REASONING_EFFORT,
  REASONING_SUMMARY,
  USE_SUGGESTIONS,
} from "./config";
import { createEditInputParser } from "./edit-input";
import {
  CommittedDocumentSchema,
  type EditInputParser,
  type EditPair,
  type RunAgentTurnOptions,
} from "./types";

const SYSTEM_PROMPT = `You are a DOCX editing assistant. You will receive an existing document and a natural-language instruction.
Edit the existing document through edit_document. Do not regenerate it. Preserve formatting, styles, tables, numbering, headers, footers, images, and unrelated content. Make the smallest edits that satisfy the instruction.`;

const SUGGESTIONS_PROMPT = `The user reviews your edits as suggestions: edit_document proposes them without applying them, so the document does not change between edit_document calls.`;

type ReadyPair = {
  batchId: string;
  index: number;
  edit: EditPair;
  abortSignal: AbortSignal | undefined;
};

type StreamingEditHandlers = {
  /** Runs as soon as the model finishes writing one pair of the call. */
  onPairReady(pair: ReadyPair): Promise<unknown>;
  /** Runs with the whole input once every pair's handler has settled. */
  onExecute(
    input: unknown,
    batchId: string,
    abortSignal: AbortSignal | undefined
  ): Promise<unknown>;
};

/**
 * Wraps the MCP edit tool so each edit pair is handled while the model is still
 * writing the call. `pending` collects the handlers' promises.
 */
function createStreamingEditTool(
  mcpEdit: any,
  pending: Promise<unknown>[],
  handlers: StreamingEditHandlers
) {
  let activeInput:
    | { batchId: string; parser: EditInputParser }
    | undefined;

  return createTool({
    id: "edit_document",
    description: mcpEdit.description,
    inputSchema: mcpEdit.inputSchema,
    toModelOutput: mcpEdit.toModelOutput,
    onInputStart: ({ toolCallId, abortSignal }) => {
      if (activeInput && !activeInput.parser.ended) {
        throw new Error("Parallel edit_document calls are unsupported");
      }
      activeInput = {
        batchId: toolCallId,
        parser: createEditInputParser({
          onPairReady: (index, edit) => {
            pending.push(
              handlers
                .onPairReady({ batchId: toolCallId, index, edit, abortSignal })
                .catch(() => undefined)
            );
          },
          onError: () => {
            if (activeInput?.batchId === toolCallId) activeInput = undefined;
          },
        }),
      };
    },
    onInputDelta: ({ toolCallId, inputTextDelta }) => {
      if (activeInput?.batchId !== toolCallId) return;
      activeInput.parser.write(inputTextDelta);
    },
    onInputAvailable: ({ toolCallId }) => {
      if (activeInput?.batchId !== toolCallId) return;
      activeInput.parser.finish();
      activeInput = undefined;
    },
    execute: async (input, context) => {
      const batchId = context.agent?.toolCallId;
      if (!batchId) throw new Error("edit_document has no tool call ID");
      await Promise.allSettled([...pending]);
      return handlers.onExecute(input, batchId, context.abortSignal);
    },
  });
}

export async function* runAgent(options: RunAgentTurnOptions) {
  const client = new Vespper({
    apiKey: options.apiKey,
    mcpUrl: options.mcpUrl,
  });
  const sessionId = await client.openSession(options.docBytes);
  const mcp = new MCPClient({
    id: randomUUID(),
    servers: {
      vespperDocx: {
        url: new URL(client.mcpUrl),
        requestInit: {
          headers: { Authorization: client.authorizationHeader },
        },
      },
    },
  });
  let latest: { revision: number; document: Uint8Array } | undefined;
  const output = new PassThrough({ objectMode: true });
  const pending: Promise<unknown>[] = [];
  let editCount = 0;

  try {
    await client.patchMCPTools({
      mcp,
      sessionId,
      author: options.author,
      trackChanges: options.trackChanges,
      suggest: USE_SUGGESTIONS,
      onDocumentUpdated(update) {
        if (!latest || update.revision > latest.revision) {
          latest = { revision: update.revision, document: update.document };
        }
        output.write({
          type: "edit_applied",
          docx_b64: Buffer.from(update.document).toString("base64"),
          edit_count: update.editCount,
          revision: update.revision,
        });
      },
    });
    const tools: any = await mcp.listTools();
    const readDocument = tools.vespperDocx_read_document;
    const searchDocument = tools.vespperDocx_search_document;
    const mcpEdit = tools.vespperDocx_edit_document;
    if (!readDocument || !searchDocument || !mcpEdit) {
      throw new Error("Vespper did not advertise the required DOCX tools");
    }

    // Suggest mode: the patched tool localizes instead of applying, so each pair
    // becomes a card as soon as it's written.
    const proposeEdits: StreamingEditHandlers = {
      async onPairReady({ batchId, index, edit }) {
        const proposed: SuggestEditResult = await mcpEdit.execute(
          { edits: [edit] },
          {}
        );
        const [suggestion] = proposed.suggestions;
        if (!suggestion) return;
        output.write({
          type: "suggestion_ready",
          tool_call_id: batchId,
          suggestion: { ...suggestion, index: index + 1 },
          css: proposed.css,
        });
      },
      // The whole call is localized again: only a batch can tell that two of
      // its edits overlap. Its result replaces the streamed cards.
      onExecute: (input) => mcpEdit.execute(input, {}),
    };
    const applyEdits: StreamingEditHandlers = {
      onPairReady: ({ batchId, index, edit, abortSignal }) =>
        mcpEdit.execute(
          { edits: [edit] },
          {
            _meta: { [META_BATCH_ID]: batchId, [META_EDIT_INDEX]: index },
            abortSignal,
          }
        ),
      async onExecute(input, batchId, abortSignal) {
        const raw = await mcpEdit.execute(input, {
          _meta: { [META_BATCH_ID]: batchId },
          abortSignal,
        });
        const committed = CommittedDocumentSchema.safeParse(raw);
        if (committed.success) editCount += committed.data.count;
        if (!raw || typeof raw !== "object") return raw;
        const { base64: _base64, ...modelResult } = raw as Record<
          string,
          unknown
        >;
        return modelResult;
      },
    };

    const agent = new Agent({
      id: "docx-editor-agent",
      name: "DOCX Editor Agent",
      instructions: USE_SUGGESTIONS
        ? `${SYSTEM_PROMPT}\n${SUGGESTIONS_PROMPT}`
        : SYSTEM_PROMPT,
      model: options.model || DEFAULT_MODEL,
      tools: {
        read_document: readDocument,
        search_document: searchDocument,
        edit_document: createStreamingEditTool(
          mcpEdit,
          pending,
          USE_SUGGESTIONS ? proposeEdits : applyEdits
        ),
      },
    });
    const stream = await agent.stream(options.messages, {
      maxSteps: MAX_ROUNDS,
      abortSignal: options.signal,
      providerOptions: {
        openai: {
          reasoningSummary: REASONING_SUMMARY,
          reasoningEffort: REASONING_EFFORT,
        },
      },
    });
    const modelOutput = Readable.from(stream.fullStream, {
      objectMode: true,
    });
    modelOutput.pipe(output, { end: false });

    const completion = (async () => {
      try {
        await finished(modelOutput);
        await Promise.allSettled(pending);
        const document =
          latest?.document ?? client.getSessionDocument(sessionId);
        output.end({
          type: "done",
          docx_b64: Buffer.from(document).toString("base64"),
          edit_count: editCount,
          revision: latest?.revision ?? -1,
        });
      } catch (error) {
        output.destroy(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    })();

    for await (const event of output) yield event;
    await completion;
  } finally {
    try {
      await mcp.disconnect();
    } finally {
      await client.closeSession(sessionId).catch(console.error);
    }
  }
}
