import { getSchema } from "@tiptap/core";
import {
  DOMParser,
  DOMSerializer,
  type Node as ProseMirrorNode,
  type Schema,
} from "@tiptap/pm/model";
import { htmlElements } from "./extensions/html-elements";

export const suggestionSchema = getSchema(htmlElements);

// Parsing goes through <template>, not Tiptap's own HTML parsing: Tiptap wraps
// input in <body>, which drops bare fragments such as a lone <tr>.
export function parseSuggestionHtml(
  schema: Schema,
  html: string,
): ProseMirrorNode {
  const template = document.createElement("template");
  template.innerHTML = html;
  return DOMParser.fromSchema(schema).parse(template.content, {
    preserveWhitespace: "full",
  });
}

export function serializeSuggestionHtml(doc: ProseMirrorNode): string {
  const template = document.createElement("template");
  template.content.append(
    DOMSerializer.fromSchema(doc.type.schema).serializeFragment(doc.content, {
      document,
    }),
  );
  return template.innerHTML;
}
