/**
 * Reads a newline-delimited JSON stream, yielding each parsed line in order.
 * Lines that are not JSON are skipped. Aborting `signal` cancels the read.
 */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancel = () => {
    void reader.cancel().catch(() => {
      /* already closed */
    });
  };
  signal?.addEventListener("abort", cancel, { once: true });

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        yield message;
      }
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    // A consumer that stops early must not leave the response open.
    cancel();
  }
}
