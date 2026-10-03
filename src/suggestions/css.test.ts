import assert from "node:assert/strict";
import test from "node:test";
import "./fixtures";
import { buildCardCss } from "./css";

const SCOPE = ".vespper-docx";

test("body rules apply to the scope itself", () => {
  assert.equal(
    buildCardCss("body { font-family: Calibri; }", SCOPE),
    ".vespper-docx { font-family: Calibri; }",
  );
});

test("descendants of body and plain selectors nest under the scope", () => {
  assert.equal(
    buildCardCss("body p, .Title { font-weight: 700; }", SCOPE),
    ".vespper-docx p, .vespper-docx .Title { font-weight: 700; }",
  );
});

test("absolute font sizes are compacted and relative ones kept", () => {
  assert.equal(
    buildCardCss(
      String.raw`.Title { font-size: 28pt; }
        .text-\[11pt\] { font-size: 11pt; }
        .p2 { font-size: 7.5pt; }
        .Big { font-size: 120%; }`,
      SCOPE,
    ),
    [
      ".vespper-docx .Title { font-size: 15px; }",
      String.raw`.vespper-docx .text-\[11pt\] { font-size: 12.5px; }`,
      ".vespper-docx .p2 { font-size: 11px; }",
      ".vespper-docx .Big { font-size: 120%; }",
    ].join("\n"),
  );
});

test("escaped commas in arbitrary-value classes do not split the selector", () => {
  const css = String.raw`.\[font-family\:\'Arial\'\,_sans-serif\] { font-family: Arial, sans-serif; }`;
  const scoped = buildCardCss(css, SCOPE);
  assert.match(scoped, /^\.vespper-docx \.\\\[font-family/);
  assert.equal(scoped.split(SCOPE).length, 2);
});

test("rules inside media queries are scoped too", () => {
  assert.equal(
    buildCardCss("@media print { p { color: black; } }", SCOPE),
    "@media print { .vespper-docx p { color: black; } }",
  );
});

test("page layout is dropped and typography is kept", () => {
  // The NDA's hanging indents and its white signature paragraph.
  assert.equal(
    buildCardCss(
      String.raw`.ml-\[0\.25in\] { margin-left: 0.25in; }
        .bg-white { background-color: rgb(255, 255, 255); }
        .ListParagraph { margin-left: 0.5in; margin-bottom: 6pt; font-size: 12pt; }
        td { padding-left: 5.4pt; vertical-align: top; width: 2in; }
        ol[type="a"] { list-style-type: lower-alpha; }`,
      SCOPE,
    ),
    [
      ".vespper-docx .ListParagraph { margin-bottom: 6pt; font-size: 13.6px; }",
      ".vespper-docx td { vertical-align: top; }",
    ].join("\n"),
  );
});

test("rules repeated across streamed suggestions are kept once", () => {
  assert.equal(
    buildCardCss(".Title { color: red; }\n.Title { color: red; }", SCOPE),
    ".vespper-docx .Title { color: red; }",
  );
});
