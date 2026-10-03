import { JSONParser } from "@streamparser/json";
import { EditPairSchema, type EditInputParser, type EditPair } from "./types";

/** Parses streamed edit_document arguments, calling `onPairReady` as each pair completes. */
export function createEditInputParser(options: {
  onPairReady(index: number, edit: EditPair): void;
  onError(): void;
}): EditInputParser {
  const parser = new JSONParser({
    paths: ["$.edits.*"],
    keepStack: false,
    emitPartialValues: false,
  });
  parser.onError = options.onError;
  parser.onValue = ({ key, value, partial }) => {
    if (partial || typeof key !== "number") return;
    const edit = EditPairSchema.safeParse(value);
    if (edit.success) options.onPairReady(key, edit.data);
  };

  return {
    get ended() {
      return parser.isEnded;
    },
    write(delta) {
      if (!parser.isEnded) parser.write(delta);
    },
    finish() {
      if (!parser.isEnded) parser.end();
    },
  };
}
