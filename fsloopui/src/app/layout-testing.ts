// What the browser lays out, asked of jsdom: the product's own stylesheet — src/styles/index.css through Tailwind,
// built for the classes in the page — goes into the document, so `getComputedStyle` answers with the cascade the
// browser runs (layers, media queries, `calc(var(--spacing) * 32)` resolved); then the flex algorithm of CSS
// Flexbox §9 sizes what jsdom does not lay out. A test proves a box by its computed flex and size, never by the name
// of a class (craft-1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";
import { afterEach } from "vitest";

// The stylesheet lives for one test: the next starts on jsdom's bare page, as every other test of its file expects.
afterEach(() => document.head.querySelector("style[data-product-stylesheet]")?.remove());

const at = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

/** The stylesheets index.css imports, as the build resolves them. */
const IMPORTS: Record<string, string> = {
  tailwindcss: "../../node_modules/tailwindcss/index.css",
  "tw-animate-css": "../../node_modules/tw-animate-css/dist/tw-animate.css",
  "shadcn/tailwind.css": "../../node_modules/shadcn/dist/tailwind.css",
};

let compiler: ReturnType<typeof compile> | null = null;

function product() {
  compiler ??= compile(readFileSync(at("../styles/index.css"), "utf8"), {
    base: at("../styles/"),
    loadStylesheet: async (id: string) => {
      const file = IMPORTS[id];
      if (!file) throw new Error(`layout-testing: no stylesheet for @import "${id}"`);
      return { path: at(file), base: at("../styles/"), content: readFileSync(at(file), "utf8") };
    },
  });
  return compiler;
}

/** Puts the product's stylesheet, built for every class now in the page, into the document; call it again after the
 * page gains classes. */
export async function applyStylesheet(): Promise<void> {
  const classes = new Set<string>();
  for (const el of document.querySelectorAll("[class]")) for (const c of el.classList) classes.add(c);
  const css = (await product()).build([...classes]);
  let style = document.head.querySelector<HTMLStyleElement>("style[data-product-stylesheet]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.productStylesheet = "";
    document.head.append(style);
  }
  style.textContent = css;
}

const px = (value: string): number | null => (/^-?[\d.]+px$/.test(value) ? Number.parseFloat(value) : null);

/** The block size the browser gives a box: a flex item of a column by its flex base size (Flexbox §9.2 step 3) —
 * `auto` takes its height, a percentage of a container whose height is not definite falls back to its content — and,
 * in a container whose height is not definite, no free space to grow or shrink into, so it stays at that size within
 * its min and max. «content» when nothing but its content sizes it. */
export function usedBlockSize(el: Element): number | "content" {
  const s = getComputedStyle(el);
  const clamp = (n: number) => Math.min(Math.max(n, px(s.minHeight) ?? 0), px(s.maxHeight) ?? Infinity);
  const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const column = parent !== null && /flex/.test(parent.display) && parent.flexDirection.startsWith("column");
  if (!column) return px(s.height) === null ? "content" : clamp(px(s.height) as number);
  const definite = px(parent.height) !== null;
  if (definite) throw new Error("usedBlockSize: a column of definite height grows and shrinks its items — not measured here");
  const basis = s.flexBasis === "auto" ? px(s.height) : s.flexBasis.endsWith("%") ? null : px(s.flexBasis);
  return basis === null ? "content" : clamp(basis);
}

/** The 15 px a classic Windows scrollbar takes — what `scrollbar-gutter: stable` reserves beside a list. */
export const SCROLLBAR = 15;

/** A text's width at the product's body face (Segoe UI), by glyph class and rounded up — the measure
 * p1-verdict-findings.png calibrates at 13 px (views/findings/view.test.tsx), scaled to the size; semibold a tenth
 * wider; mono at 0.6 em a glyph. It errs wide, never narrow. */
export function textWidth(text: string, { size = 13, weight = 400, mono = false }: { size?: number; weight?: number; mono?: boolean } = {}): number {
  if (mono) return Math.ceil([...text].length * 0.6 * size);
  let w = 0;
  for (const ch of text) w += /[мшщжюыМШЩЖЮЫmwMW…]/.test(ch) ? 11 : /[ijlrtfI.,:;!| ·]/.test(ch) ? 4.3 : /[0-9]/.test(ch) ? 7.5 : /[A-ZА-ЯЁ]/.test(ch) ? 9 : 7.4;
  return Math.ceil(w * (size / 13) * (weight >= 600 ? 1.1 : 1));
}

/** A box's own content width, as its computed font, gap and padding draw it: a text at its face, an element by its
 * computed width when it has one (a dot), a row of children side by side with its gap between them. */
export function contentWidth(el: Element): number {
  const s = getComputedStyle(el);
  if (s.display === "none") return 0;
  const fixed = px(s.width);
  if (fixed !== null) return fixed;
  const pad = (px(s.paddingLeft) ?? 0) + (px(s.paddingRight) ?? 0);
  const font = { size: px(s.fontSize) ?? 13, weight: Number(s.fontWeight) || 400, mono: /mono|Consolas/i.test(s.fontFamily) };
  const kids = [...el.childNodes].filter((n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent));
  const widths = kids.map((k) => (k.nodeType === Node.TEXT_NODE ? textWidth(k.textContent ?? "", font) : contentWidth(k as Element)));
  const flexRowBox = /flex/.test(s.display) && !s.flexDirection.startsWith("column");
  // A flex row and inline content lie side by side, a flex row with its gap; anything else stacks.
  if (flexRowBox) return pad + (px(s.columnGap) ?? 0) * Math.max(0, kids.length - 1) + widths.reduce((a, b) => a + b, 0);
  if (s.display.startsWith("inline")) return pad + widths.reduce((a, b) => a + b, 0);
  return pad + Math.max(0, ...widths);
}

/** The widths a flex row gives its items in `width` px of content box (Flexbox §9.7): each from its content, within
 * its min and max; the shortfall shared by flex-shrink × size among those that may shrink, each stopping at its min. */
export function flexRow(row: Element, width: number): Map<Element, number> {
  const s = getComputedStyle(row);
  const items = [...row.children];
  const free = width - (px(s.columnGap) ?? 0) * Math.max(0, items.length - 1);
  const facts = items.map((el) => {
    const c = getComputedStyle(el);
    const base = contentWidth(el);
    const max = c.maxWidth.endsWith("%") ? (width * Number.parseFloat(c.maxWidth)) / 100 : (px(c.maxWidth) ?? Infinity);
    // `min-width: auto` on a box that clips its overflow is 0; otherwise its content.
    const min = px(c.minWidth) ?? (c.overflowX === "visible" ? base : 0);
    return { el, base, shrink: Number(c.flexShrink), min, max, size: Math.min(Math.max(base, min), max), frozen: false };
  });
  for (let round = 0; round < facts.length + 1; round++) {
    const used = facts.reduce((n, f) => n + f.size, 0);
    const short = used - free;
    const open = facts.filter((f) => !f.frozen && f.shrink > 0 && f.size > f.min);
    if (short <= 0.01 || !open.length) break;
    const weight = open.reduce((n, f) => n + f.shrink * f.base, 0);
    for (const f of open) {
      const next = f.size - (short * f.shrink * f.base) / weight;
      if (next <= f.min) {
        f.size = f.min;
        f.frozen = true;
      } else f.size = next;
    }
  }
  return new Map(facts.map((f) => [f.el, f.size]));
}

/** The content box width of `el` inside an ancestor of known width: the ancestor's width less every border and
 * padding on the way down, and the scrollbar gutter of each box that keeps one. */
export function innerWidth(el: Element, ancestor: Element, ancestorWidth: number): number {
  let width = ancestorWidth;
  const chain: Element[] = [];
  for (let n: Element | null = el; n && n !== ancestor.parentElement; n = n.parentElement) chain.unshift(n);
  for (const n of chain) {
    const c = getComputedStyle(n);
    width -= ["borderLeftWidth", "borderRightWidth", "paddingLeft", "paddingRight"].reduce((sum, k) => sum + (px(c[k as "paddingLeft"]) ?? 0), 0);
    if (c.scrollbarGutter === "stable" || /stable/.test(c.getPropertyValue("scrollbar-gutter"))) width -= SCROLLBAR;
  }
  return width;
}
