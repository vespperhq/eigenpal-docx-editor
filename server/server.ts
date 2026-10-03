import express, { type Request, type Response } from "express";
import multer from "multer";
import Vespper from "vespper";
import {
  DEFAULT_MODEL,
  DIST_DIR,
  DOCX_AUTHOR,
  getModelApiKeyNames,
  hasModelApiKey,
  HEALTH,
  PORT,
  VESPPER_API_KEY,
  VESPPER_MCP_URL,
} from "./config";
import { runAgent } from "./agent";
import { ApplyRequestSchema, parseChatMessages, type ApplyEvent } from "./types";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, fieldSize: 128 * 1024 * 1024 },
});

function startNdjson(res: Response) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
}

const app = express();

app.get("/health", (_req, res) => {
  res.json(HEALTH);
});

app.post(
  "/api/process",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!VESPPER_API_KEY.startsWith("sk_live_")) {
      return res
        .status(500)
        .json({ error: "Set a valid VESPPER_API_KEY in .env." });
    }
    if (!req.file?.buffer.length) {
      return res.status(400).json({ error: "Missing DOCX upload" });
    }

    let messages;
    try {
      messages = parseChatMessages(req.body.messages);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid messages",
      });
    }
    if (!messages.length) {
      return res
        .status(400)
        .json({ error: "Enter a message or paste an image." });
    }
    const model = String(req.body.model || DEFAULT_MODEL);
    if (!hasModelApiKey(model)) {
      return res.status(500).json({
        error: `Set ${getModelApiKeyNames(model).join(" or ")} for ${model}.`,
      });
    }

    startNdjson(res);
    const controller = new AbortController();
    res.once("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    const stream = runAgent({
      docBytes: req.file.buffer,
      messages,
      author: DOCX_AUTHOR,
      model,
      trackChanges: true,
      mcpUrl: VESPPER_MCP_URL,
      apiKey: VESPPER_API_KEY,
      signal: controller.signal,
    });
    try {
      for await (const event of stream) {
        if (res.destroyed) break;
        res.write(
          `${JSON.stringify(event, (key, value) => {
            if (key === "html") return undefined;
            if (value instanceof Error) return value.message;
            return value;
          })}\n`
        );
      }
    } catch (error) {
      if (!controller.signal.aborted && !res.destroyed) {
        res.write(
          `${JSON.stringify({
            type: "error",
            detail: error instanceof Error ? error.message : String(error),
          })}\n`
        );
      }
    } finally {
      if (!res.destroyed) res.end();
    }
    return;
  }
);

app.post(
  "/api/apply",
  upload.single("file"),
  async (req: Request, res: Response) => {
    if (!VESPPER_API_KEY.startsWith("sk_live_")) {
      return res
        .status(500)
        .json({ error: "Set a valid VESPPER_API_KEY in .env." });
    }
    let request;
    try {
      request = ApplyRequestSchema.parse(JSON.parse(String(req.body.request)));
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : "Invalid apply request",
      });
    }
    if (request.sessionId === undefined && !req.file?.buffer.length) {
      return res
        .status(400)
        .json({ error: "Attach the document or pass a sessionId" });
    }

    startNdjson(res);
    const write = (event: ApplyEvent) =>
      res.write(`${JSON.stringify(event)}\n`);

    const client = new Vespper({
      apiKey: VESPPER_API_KEY,
      mcpUrl: VESPPER_MCP_URL,
    });
    const { author = DOCX_AUTHOR, edits } = request;
    try {
      let sessionId = request.sessionId;
      if (sessionId === undefined) {
        sessionId = await client.openSession(req.file!.buffer);
        write({ type: "session", sessionId });
      }
      // Accepted suggestions become tracked changes, which the editor's review
      // module renders as redlines.
      for await (const outcome of client.applyEdits(sessionId, edits, {
        author,
        trackChanges: true,
        startIndex: request.startIndex ?? 0,
      })) {
        if (res.destroyed) break;
        const { id } = edits[outcome.position]!;
        if (!outcome.ok) {
          write({
            type: "suggestion_failed",
            id,
            code: outcome.code,
            reason: outcome.reason,
          });
          continue;
        }
        write({
          type: "edit_applied",
          docx_b64: Buffer.from(outcome.document).toString("base64"),
          revision: outcome.revision,
        });
        write({ type: "suggestion_applied", id });
      }
    } catch (error) {
      if (!res.destroyed) {
        write({
          type: "error",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      if (!res.destroyed) res.end();
    }
    return;
  }
);

app.delete("/api/apply/:sessionId", async (req, res) => {
  try {
    const client = new Vespper({
      apiKey: VESPPER_API_KEY,
      mcpUrl: VESPPER_MCP_URL,
    });
    await client.closeSession(req.params.sessionId);
    res.sendStatus(204);
  } catch (error) {
    res
      .status(502)
      .send(error instanceof Error ? error.message : String(error));
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(DIST_DIR));
}

app.listen(PORT, () => {
  console.log(`Vespper docx-editor API: http://localhost:${PORT}`);
  console.log(`  MCP:          ${VESPPER_MCP_URL}`);
  console.log(`  Agent:        ${DEFAULT_MODEL}`);
  console.log(`  Suggestions:  ${HEALTH.suggestions ? "on" : "off"}`);
  if (!VESPPER_API_KEY) console.warn("  WARNING: set VESPPER_API_KEY in .env");
  if (!HEALTH.agentConfigured) {
    console.warn(
      `  WARNING: set ${getModelApiKeyNames(DEFAULT_MODEL).join(" or ")} in .env for ${DEFAULT_MODEL}`
    );
  }
});
