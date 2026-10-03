import { Mark, Node } from "@tiptap/core";
import type { DOMOutputSpec, Node as ProseMirrorNode } from "@tiptap/pm/model";

// Every element keeps its tag and attributes verbatim, so a card serializes
// back to exactly the HTML it was given (Tailwind classes, data-* and all).

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "caption",
  "colgroup",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);
const VOID_BLOCK_TAGS = new Set(["col", "hr"]);

function isBlockElement(element: HTMLElement): boolean {
  return BLOCK_TAGS.has(element.localName);
}

function hasBlockChild(element: HTMLElement): boolean {
  return Array.from(element.children).some(
    (child) =>
      BLOCK_TAGS.has(child.localName) || VOID_BLOCK_TAGS.has(child.localName),
  );
}

function isInlineElement(element: HTMLElement): boolean {
  return (
    !BLOCK_TAGS.has(element.localName) &&
    !VOID_BLOCK_TAGS.has(element.localName)
  );
}

// `tag` defaults only for content ProseMirror wraps itself, such as stray text
// directly inside a container.
function getElementAttributes(defaultTag: string) {
  return {
    tag: {
      default: defaultTag,
      rendered: false,
      parseHTML: (element: HTMLElement) => element.localName,
    },
    attrs: {
      default: [],
      rendered: false,
      parseHTML: (element: HTMLElement) =>
        Array.from(element.attributes, (attribute) => [
          attribute.name,
          attribute.value,
        ]),
    },
  };
}

function renderElement(
  { node }: { node: ProseMirrorNode },
  withContent = true,
): DOMOutputSpec {
  const spec: [string, Record<string, string>] = [
    node.attrs.tag,
    Object.fromEntries(node.attrs.attrs),
  ];
  return withContent ? [...spec, 0] : spec;
}

export const HtmlDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "block*",
});

export const HtmlText = Node.create({ name: "text", group: "inline" });

export const HtmlContainer = Node.create({
  name: "htmlContainer",
  group: "block",
  content: "block*",
  addAttributes: () => getElementAttributes("div"),
  parseHTML: () => [
    {
      tag: "*",
      getAttrs: (element) =>
        isBlockElement(element) && hasBlockChild(element) ? {} : false,
    },
  ],
  renderHTML: (props) => renderElement(props),
});

export const HtmlTextblock = Node.create({
  name: "htmlTextblock",
  group: "block",
  content: "inline*",
  addAttributes: () => getElementAttributes("p"),
  parseHTML: () => [
    {
      tag: "*",
      getAttrs: (element) => (isBlockElement(element) ? {} : false),
    },
  ],
  renderHTML: (props) => renderElement(props),
});

export const HtmlVoidBlock = Node.create({
  name: "htmlVoidBlock",
  group: "block",
  atom: true,
  addAttributes: () => getElementAttributes("hr"),
  parseHTML: () => [
    {
      tag: "*",
      getAttrs: (element) =>
        VOID_BLOCK_TAGS.has(element.localName) ? {} : false,
    },
  ],
  renderHTML: (props) => renderElement(props, false),
});

/** Childless inline elements, such as bookmarks (`<a id>`) and `<br>`. */
export const HtmlInlineAtom = Node.create({
  name: "htmlInlineAtom",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes: () => getElementAttributes("span"),
  parseHTML: () => [
    {
      tag: "*",
      getAttrs: (element) =>
        isInlineElement(element) && element.childNodes.length === 0
          ? {}
          : false,
    },
  ],
  renderHTML: (props) => renderElement(props, false),
});

export const HtmlElementMark = Mark.create({
  name: "htmlElement",
  excludes: "",
  inclusive: true,
  addAttributes: () => getElementAttributes("span"),
  parseHTML: () => [
    {
      tag: "*",
      getAttrs: (element) =>
        isInlineElement(element) && element.childNodes.length > 0
          ? {}
          : false,
    },
  ],
  renderHTML: ({ mark }) => [
    mark.attrs.tag,
    Object.fromEntries(mark.attrs.attrs),
    0,
  ],
});

export const htmlElements = [
  HtmlDocument,
  HtmlText,
  HtmlContainer,
  HtmlTextblock,
  HtmlVoidBlock,
  HtmlInlineAtom,
  HtmlElementMark,
];
