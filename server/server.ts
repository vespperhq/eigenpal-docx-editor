import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DIST_DIR,
  DOCX_AUTHOR,
  getModelApiKeyNames,
  hasModelApiKey,
  PORT,
  VESPPER_API_KEY,
  VESPPER_MCP_URL,
} from "./config";
import { runAgentTurn } from "./agent";
import { parseChatMessages, type ChatMessage } from "./types";

const MAX_MESSAGES_FIELD_BYTES = 128 * 1024 * 1024;

type AgentStreamEvent = {
  type?: string;
  docx_b64?: string;
  payload?: { toolName?: string };
};

function includesDocumentBase64(event: AgentStreamEvent): boolean {
  return (
    event.type === "done" ||
    (event.type === "tool-result" &&
      event.payload?.toolName === "edit_document")
  );
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    fieldSize: MAX_MESSAGES_FIELD_BYTES,
  },
});

const app = express();

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/") || req.path === "/health") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    vespperConfigured: Boolean(VESPPER_API_KEY),
    agentConfigured: hasModelApiKey(DEFAULT_MODEL),
    defaultModel: DEFAULT_MODEL,
    availableModels: AVAILABLE_MODELS,
    mcpUrl: VESPPER_MCP_URL,
  });
});

app.post(
  "/api/process",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!VESPPER_API_KEY.startsWith("sk_live_")) {
      return res.status(500).json({
        error:
          "VESPPER_API_KEY is missing or invalid. Add your sk_live_… key (from https://app.vespper.com/keys) to docx-editor/.env.",
      });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({ error: "Missing file upload" });
    }

    let messages: ChatMessage[];
    try {
      messages = parseChatMessages(req.body.messages);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "unknown validation error";
      return res.status(400).json({ error: `Invalid chat messages: ${detail}` });
    }
    if (!messages.length) {
      return res.status(400).json({ error: "Enter a message or paste an image." });
    }
    const model = String(req.body.model || DEFAULT_MODEL);
    if (!hasModelApiKey(model)) {
      const keyNames = getModelApiKeyNames(model);
      return res.status(500).json({
        error: keyNames.length
          ? `${keyNames.join(" or ")} is not set for ${model}. Add it to docx-editor/.env.`
          : `No API-key environment variable is configured for ${model}.`,
      });
    }

    const docBytes = req.file.buffer;
    console.log(`[process] bytes=${docBytes.length} model=${model}`);

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");

    const abortController = new AbortController();
    const abortTurn = () => {
      if (!res.writableEnded) abortController.abort();
    };
    res.once("close", abortTurn);

    const stream = runAgentTurn({
      docBytes,
      messages,
      author: DOCX_AUTHOR,
      model,
      trackChanges: true,
      mcpUrl: VESPPER_MCP_URL,
      apiKey: VESPPER_API_KEY,
      signal: abortController.signal,
    });
    try {
      for await (const chunk of stream) {
        if (res.destroyed) break;
        const event = chunk as AgentStreamEvent;
        const includeBase64 = includesDocumentBase64(event);
        if (event.type === "done" && event.docx_b64) {
          const body = Buffer.from(event.docx_b64, "base64");
          if (body.length < 512 && docBytes.length > 2048) {
            res.write(
              `${JSON.stringify({
                type: "error",
                detail:
                  `MCP returned a suspiciously small .docx (${body.length} bytes vs ${docBytes.length} input). ` +
                  "Check VESPPER_MCP_URL and that the gateway is not in stub mode.",
              })}\n`,
            );
            continue;
          }
        }
        res.write(
          `${JSON.stringify(chunk, (key, value) => {
            if (key === "html") return undefined;
            if (key === "base64" && !includeBase64) return undefined;
            if (value instanceof Error) return value.message;
            return value;
          })}\n`,
        );
      }
    } catch (err) {
      if (!abortController.signal.aborted && !res.destroyed) {
        console.error(err);
        res.write(
          `${JSON.stringify({
            type: "error",
            detail: err instanceof Error ? err.message : "Processing failed",
          })}\n`,
        );
      }
    } finally {
      res.off("close", abortTurn);
      if (!res.destroyed && !res.writableEnded) res.end();
    }
    return;
  },
);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(DIST_DIR));
}

app.listen(PORT, () => {
  console.log(`Vespper docx-editor API: http://localhost:${PORT}`);
  console.log(`  MCP:    ${VESPPER_MCP_URL}`);
  console.log(`  Agent:  ${DEFAULT_MODEL}`);
  if (!VESPPER_API_KEY) console.warn("  WARNING: set VESPPER_API_KEY in .env");
  if (!hasModelApiKey(DEFAULT_MODEL)) {
    console.warn(
      `  WARNING: set ${getModelApiKeyNames(DEFAULT_MODEL).join(" or ")} in .env for ${DEFAULT_MODEL}`,
    );
  }
});
