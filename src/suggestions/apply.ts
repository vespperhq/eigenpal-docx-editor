import { readNdjson } from "../agent/ndjson";
import { parseJsonError } from "../agent/process";
import { ApplyEventSchema, type ApplyEvent } from "../chat/types";

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ApplyEdit = { id: string; old: string; new: string };

/** The first apply of a session sends the document; later ones join it. */
export type ApplyRequest =
  | { file: ArrayBuffer; edits: ApplyEdit[] }
  | { sessionId: string; startIndex: number; edits: ApplyEdit[] };

/**
 * Applies edits through the server and awaits `onEvent` for each streamed
 * event, in order. Throws when the request fails or the stream reports an error.
 */
export async function sendApply(
  request: ApplyRequest,
  onEvent: (event: ApplyEvent) => Promise<void>
): Promise<void> {
  const form = new FormData();
  if ("file" in request) {
    const { file, ...fields } = request;
    form.append("request", JSON.stringify(fields));
    form.append("file", new Blob([file], { type: DOCX_TYPE }), "document.docx");
  } else {
    form.append("request", JSON.stringify(request));
  }

  const response = await fetch("/api/apply", { method: "POST", body: form });
  if (!response.ok) throw new Error(await parseJsonError(response));
  if (!response.body) throw new Error("No response body to stream.");

  let errorDetail: string | null = null;
  for await (const message of readNdjson(response.body)) {
    const parsed = ApplyEventSchema.safeParse(message);
    if (!parsed.success) continue;
    if (parsed.data.type === "error") {
      errorDetail = parsed.data.detail;
      continue;
    }
    await onEvent(parsed.data);
  }
  if (errorDetail) throw new Error(errorDetail);
}

export async function closeApplySession(sessionId: string): Promise<void> {
  const response = await fetch(
    `/api/apply/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error(await parseJsonError(response));
}
