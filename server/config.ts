import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SERVER_DIR, "..");

dotenv.config({ path: path.join(ROOT_DIR, ".env") });

export const DIST_DIR = path.join(ROOT_DIR, "dist");
export const PORT = Number(process.env.PORT ?? 3001);
export const VESPPER_API_KEY = process.env.VESPPER_API_KEY ?? "";
export const DOCX_AUTHOR = process.env.DOCX_AUTHOR || "Vespper Agent";
export const VESPPER_MCP_URL = (
  process.env.VESPPER_MCP_URL ?? "https://mcp.vespper.com/mcp"
).replace(/\/+$/, "");
// The agent proposes edits as suggestion cards; false applies them as it writes.
export const USE_SUGGESTIONS = process.env.USE_SUGGESTIONS !== "false";
export const REASONING_EFFORT = process.env.AGENT_REASONING_EFFORT ?? "medium";
export const REASONING_SUMMARY =
  process.env.AGENT_REASONING_SUMMARY ?? "detailed";
export const MAX_ROUNDS = 24;

export const META_BATCH_ID = "com.vespper/batch-id";
export const META_EDIT_INDEX = "com.vespper/edit-index";
export const AVAILABLE_MODELS = [
  "openai/gpt-5.6-sol",
  "openai/gpt-5.5",
  "anthropic/claude-sonnet-4.5",
  "anthropic/claude-opus-5",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
];
export const DEFAULT_MODEL =
  process.env.DOCX_AGENT_MODEL || AVAILABLE_MODELS[0];

export function getModelApiKeyNames(model: string): string[] {
  const provider = model.includes("/") ? model.split("/", 1)[0] : "";
  if (provider === "openai") return ["OPENAI_API_KEY"];
  if (provider === "anthropic") return ["ANTHROPIC_API_KEY"];
  if (provider === "google") {
    return ["GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"];
  }
  return [];
}

export function hasModelApiKey(model: string): boolean {
  return getModelApiKeyNames(model).some((name) => Boolean(process.env[name]));
}

export const HEALTH = {
  ok: true,
  vespperConfigured: Boolean(VESPPER_API_KEY),
  agentConfigured: hasModelApiKey(DEFAULT_MODEL),
  defaultModel: DEFAULT_MODEL,
  availableModels: AVAILABLE_MODELS,
  mcpUrl: VESPPER_MCP_URL,
  suggestions: USE_SUGGESTIONS,
};
