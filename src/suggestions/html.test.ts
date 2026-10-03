import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHtml, SAMPLES } from "./fixtures";
import {
  parseSuggestionHtml,
  serializeSuggestionHtml,
  suggestionSchema,
} from "./html";

for (const [name, html] of Object.entries(SAMPLES)) {
  test(`${name} round-trips exactly`, () => {
    const doc = parseSuggestionHtml(suggestionSchema, html);
    assert.equal(serializeSuggestionHtml(doc), normalizeHtml(html));
  });
}
