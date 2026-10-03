import { JSDOM } from "jsdom";

// The suggestion modules use the DOM; tests run them against jsdom.
const { window } = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  document: window.document,
  CSSStyleSheet: window.CSSStyleSheet,
  CSSStyleRule: window.CSSStyleRule,
  CSSMediaRule: window.CSSMediaRule,
});

/** Resolved suggestion sides seen in real documents. */
export const SAMPLES = {
  listLinksOld:
    '<ul class="ListParagraph my-[6pt] ml-[0.25in] [list-style-type:disc]"><li class="ListParagraph my-[6pt]"><p class="leading-[115%] mt-0 mb-0"><a href="https://www.ndiscommission.gov.au/workerresources"><span class="Hyperlink-000021">Dysphagia</span><span class="Hyperlink-000018">,</span><span class="Hyperlink-000021">\u00a0safe swallowing</span></a></p></li><li class="ListParagraph my-[6pt]"><p class="leading-[115%] mt-0 mb-0"><a href="https://www.ndiscommission.gov.au/workerresources"><span class="Hyperlink-000021">Oral health</span></a></p></li></ul>',
  listLinksNew:
    '<ul class="ListParagraph my-[6pt] ml-[0.25in] [list-style-type:disc]"><li class="ListParagraph my-[6pt]"><p class="leading-[115%] mt-0 mb-0"><a href="https://www.ndiscommission.gov.au/workerresources"><span class="Hyperlink-000021">Dysphagia</span><span class="Hyperlink-000018">,</span><span class="Hyperlink-000021">\u00a0safe swallowing</span></a></p></li></ul>',
  titleAnchorOld:
    '<p class="Title"><a id="_nj23sjpj5u97" class="no-underline"></a><span class="text-[#666666]">Business Questionnaire</span> </p>',
  titleAnchorNew:
    '<p class="Title"><a id="_nj23sjpj5u97" class="no-underline"></a><span class="text-[#666666]">Business Strategy Questionnaire</span> </p>',
  table:
    '<table class="border-collapse w-[6.5in]"><tbody><tr class="h-[0.3in]"><td class="border-solid border-[1pt] border-black bg-[#F6F4EF] w-[2in] align-top"><p class="Answers mb-0"><span class="font-bold">Company name</span></p></td><td class="border-solid border-[1pt] border-black w-[4.5in]"><p class="Answers mb-0"><span class="text-[#808080]">Click or tap here to enter text.</span></p></td></tr></tbody></table>',
  bareRow:
    '<tr class="h-[0.3in]"><td class="border-solid bg-[#F6F4EF]"><p class="Answers mb-0">Phone</p></td><td class="border-solid"><p class="Answers mb-0"></p></td></tr>',
  insDel:
    '<p class="BodyText text-justify mb-[6pt]">The Party shall <del class="line-through" data-author="Jane">promptly </del>return <ins class="underline" data-author="Jane">all</ins> materials.</p>',
  header:
    '<header data-docx-part="word/header1.xml" data-docx-refs="section-1:default section-2:first"><p class="Header text-right"><span class="text-[8pt] [font-family:\'Arial\',_sans-serif]">CONFIDENTIAL</span></p></header>',
  nbspBreak:
    '<p class="mb-0">Signed:\u00a0\u00a0<br>Date: <sup class="text-[8pt]">1</sup></p>',
  termOld:
    '<p class="BodyText mb-[6pt]"><span class="[font-family:\'Georgia\',_serif]">For the purposes of this Agreement, the term</span></p>',
  termNew:
    '<p class="BodyText mb-[6pt]"><span class="[font-family:\'Georgia\',_serif]">In this Agreement, the term</span></p>',
};

/** `html` as the browser serializes it, e.g. U+00A0 as `&nbsp;`. */
export function normalizeHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.innerHTML;
}
