// Page layout that doesn't fit a narrow card: backgrounds, list markers, and
// the horizontal geometry of the page (indents, side margins and padding, fixed
// widths in inches). Typography, colors, borders and vertical spacing are kept.
const CARD_STRIPPED_PROPERTIES = [
  "background",
  "background-color",
  "background-image",
  "list-style",
  "list-style-type",
  "list-style-image",
  "margin-left",
  "margin-right",
  "margin-inline",
  "margin-inline-start",
  "margin-inline-end",
  "padding-left",
  "padding-right",
  "padding-inline",
  "padding-inline-start",
  "padding-inline-end",
  "text-indent",
  "width",
  "min-width",
  "max-width",
];

// Card text is set at 0.85 of the document's size, kept between 11px and 15px:
// body text lands near the panel's 13px and headings stay only slightly larger.
const CARD_FONT_SCALE = 0.85;
const CARD_FONT_MIN_PX = 11;
const CARD_FONT_MAX_PX = 15;
const PX_PER_UNIT = {
  px: 1,
  pt: 4 / 3,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
};

/** The card's size for an absolute `font-size`, or undefined to keep it. */
function getCardFontSize(value: string): string | undefined {
  const match = /^(\d*\.?\d+)(px|pt|pc|in|cm|mm)$/.exec(value.trim());
  if (!match) return undefined;
  const unit = match[2] as keyof typeof PX_PER_UNIT;
  const px = Number(match[1]) * PX_PER_UNIT[unit] * CARD_FONT_SCALE;
  const clamped = Math.min(Math.max(px, CARD_FONT_MIN_PX), CARD_FONT_MAX_PX);
  return `${Number(clamped.toFixed(1))}px`;
}

/**
 * Adapts a document stylesheet to suggestion cards under `scope`, with the
 * browser's own CSS parser: `body`, `html` and `:root` selectors become the scope
 * itself, every other selector nests under it, page-layout properties are
 * dropped, font sizes are compacted, and repeated rules are kept once.
 */
export function buildCardCss(css: string, scope: string): string {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return [...new Set(scopeRules(sheet.cssRules, scope))].join("\n");
}

function scopeRules(rules: CSSRuleList, scope: string): string[] {
  return Array.from(rules).flatMap((rule) => {
    if (rule instanceof CSSStyleRule) {
      for (const property of CARD_STRIPPED_PROPERTIES) {
        rule.style.removeProperty(property);
      }
      const fontSize = getCardFontSize(rule.style.getPropertyValue("font-size"));
      if (fontSize) rule.style.setProperty("font-size", fontSize);
      if (rule.style.length === 0) return [];
      return [
        `${scopeSelectors(rule.selectorText, scope)} { ${rule.style.cssText} }`,
      ];
    }
    if (rule instanceof CSSMediaRule) {
      const inner = scopeRules(rule.cssRules, scope);
      return inner.length
        ? [`@media ${rule.conditionText} { ${inner.join("\n")} }`]
        : [];
    }
    return [rule.cssText];
  });
}

function scopeSelectors(selectors: string, scope: string): string {
  return (
    selectors
      // Tailwind escapes the commas inside arbitrary-value classes.
      .split(/(?<!\\),/)
      .map((selector) => {
        const trimmed = selector.trim();
        const rest = trimmed.replace(/^(?:html|body|:root)\b\s*/, "");
        return `${scope} ${rest}`.trim();
      })
      .join(", ")
  );
}
