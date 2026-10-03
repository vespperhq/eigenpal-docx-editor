import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLES } from "./fixtures";
import { getSuggestionChanges } from "./extensions/suggestion-diff";
import { parseSuggestionHtml, suggestionSchema } from "./html";

function describeChanges(oldHtml: string, newHtml: string): string[][] {
  const oldDoc = parseSuggestionHtml(suggestionSchema, oldHtml);
  const newDoc = parseSuggestionHtml(suggestionSchema, newHtml);
  return getSuggestionChanges(oldDoc, newDoc).map((change) => [
    oldDoc.textBetween(change.fromA, change.toA, "¶"),
    newDoc.textBetween(change.fromB, change.toB, "¶"),
  ]);
}

test("a reworded phrase is one change", () => {
  assert.deepEqual(describeChanges(SAMPLES.termOld, SAMPLES.termNew), [
    ["For the purposes of", "In"],
  ]);
});

test("an inserted word keeps the surrounding bookmark and spans", () => {
  assert.deepEqual(
    describeChanges(SAMPLES.titleAnchorOld, SAMPLES.titleAnchorNew),
    [["", "Strategy "]],
  );
});

test("a deleted list item is one block deletion", () => {
  assert.deepEqual(
    describeChanges(SAMPLES.listLinksOld, SAMPLES.listLinksNew),
    [["Oral health", ""]],
  );
});

test("bolding a word is a change even though the text is equal", () => {
  assert.deepEqual(
    describeChanges(
      '<p class="BodyText"><span class="font-bold">Term</span> means the period.</p>',
      '<p class="BodyText"><span class="font-bold">Term</span> <span class="font-bold">means</span> the period.</p>',
    ),
    [["means", "means"]],
  );
});

test("swapping a paragraph style token is a change", () => {
  assert.equal(
    describeChanges(
      '<p class="BodyText text-center mb-[6pt]">Summary</p>',
      '<p class="IntenseQuote text-center mb-[6pt]">Summary</p>',
    ).length,
    1,
  );
});

test("identical sides have no changes", () => {
  assert.deepEqual(describeChanges(SAMPLES.table, SAMPLES.table), []);
});
