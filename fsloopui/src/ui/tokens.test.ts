// The theme's contract (DESIGN.md → Colors, Typography; rules/ui → Components 3): every colour, radius, space and
// type size a shared component uses is a token of src/styles/index.css; the light and the dark set define the same
// tokens; text on its ground meets 4.5:1 and a signal tone, used only as a dot, 3:1 — computed here from the
// token values themselves.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { MORE_INK, TAB_INK, ZERO_TAB } from "./count-tabs.tsx";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const css = read("../styles/index.css");

/** The custom properties of a block's body. */
function props(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim());
  return out;
}

/** The body of the block that opens at `start` (the index of its `{`). */
function blockAt(text: string, start: number): string {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start + 1, i);
  }
  throw new Error("unbalanced block");
}

const lightAt = css.search(/^:root\s*\{/m);
const light = props(blockAt(css, css.indexOf("{", lightAt)));
const darkMedia = blockAt(css, css.indexOf("{", css.indexOf("@media (prefers-color-scheme: dark) {")));
const dark = props(blockAt(darkMedia, darkMedia.indexOf("{")));
const theme = props(blockAt(css, css.indexOf("{", css.indexOf("@theme {"))));
const inline = props(blockAt(css, css.indexOf("{", css.indexOf("@theme inline"))));
const colours = new Set([...inline.keys()].filter((k) => k.startsWith("--color-")).map((k) => k.slice("--color-".length)));

const components = readdirSync(fileURLToPath(new URL(".", import.meta.url)))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !/^test-/.test(f))
  .map((f) => ({ file: f, text: read(f) }));

/** Every class-like token of the components' source. */
const classTokens = components.flatMap(({ file, text }) => [...text.matchAll(/[\w:@/[\]().,&*=>-]+/g)].map((m) => ({ file, token: m[0] })));

function hex(value: string): [number, number, number, number] {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (!m) throw new Error(`not a hex colour: ${value}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
}
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(hex(fg)), luminance(hex(bg))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("theme tokens", () => {
  test("light and dark define the same colour tokens, every one a colour", () => {
    const lightColours = [...light.keys()].filter((k) => k !== "--radius").sort();
    expect([...dark.keys()].sort()).toEqual(lightColours);
    for (const set of [light, dark]) for (const [k, v] of set) if (k !== "--radius") expect(() => hex(v), k).not.toThrow();
  });

  test("every colour the library reads is mapped to a theme variable defined in both sets", () => {
    for (const name of colours) {
      const source = inline.get(`--color-${name}`)!;
      const variable = /^var\((--[\w-]+)\)$/.exec(source)?.[1];
      expect(variable, name).toBeDefined();
      expect(light.has(variable!), `${variable} in light`).toBe(true);
      expect(dark.has(variable!), `${variable} in dark`).toBe(true);
    }
    for (const name of ["background", "foreground", "muted", "muted-foreground", "border", "primary", "primary-foreground", "destructive", "warning", "success", "info", "code"]) expect(colours.has(name), name).toBe(true);
  });

  test("the base type, radius and fonts are the prototype's: 13px/1.45, 8px, system faces", () => {
    expect(theme.get("--text-sm")).toBe("0.8125rem");
    expect(theme.get("--text-sm--line-height")).toBe("1.45");
    expect(light.get("--radius")).toBe("8px");
    expect(theme.get("--font-sans")).toBe('system-ui, "Segoe UI", sans-serif');
    expect(theme.get("--font-mono")).toBe('ui-monospace, "Cascadia Mono", Consolas, monospace');
    expect(css).not.toMatch(/@fontsource|Geist/);
  });

  test("no component writes a raw colour, a palette colour or an arbitrary size", () => {
    for (const { file, text } of components) {
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(|\boklch\(/);
      expect(text, file).not.toMatch(/\b(?:bg|text|border|ring|fill|stroke|decoration|outline|shadow|from|to|via)-(?:red|green|blue|amber|yellow|emerald|gray|zinc|neutral|slate|stone|orange|lime|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?\b/);
      expect(text, file).not.toMatch(/\[[^\]\s"]*\d(?:px|rem|em|ch|vh|vw|%)[^\]\s"]*\]/);
      expect(text, file).not.toMatch(/style=\{\{[^}]*\d+px/);
    }
  });

  test("every colour, size and shadow utility a component uses is a theme token", () => {
    const colourPrefixes = /^(?:[\w-]+:)*(?:bg|text|border|ring|decoration|outline|fill|stroke)-([a-z][\w-]*?)(?:\/\d+)?$/;
    const notColour = new Set(["xs", "sm", "base", "lg", "left", "right", "center", "balance", "b", "t", "l", "r", "x", "y", "0", "transparent", "current", "inherit", "dotted", "dashed", "inset", "hidden", "none", "clip", "full", "collapse", "separate"]);
    const sizePrefixes = /^(?:[\w-]+:)*(?:size|h|w|min-w|max-w|min-h|max-h)-([a-z][\w-]*)$/;
    const sizeKeywords = new Set(["full", "fit", "auto", "screen", "min", "max", "px", "none", "prose", "max-content", "min-content"]);
    for (const { file, token } of classTokens) {
      const colour = colourPrefixes.exec(token);
      if (colour && !notColour.has(colour[1]) && !/^(?:\d|[btlrxyse](?:-|$))/.test(colour[1])) expect(colours.has(colour[1]), `${file}: ${token}`).toBe(true);
      const size = sizePrefixes.exec(token);
      // Tailwind's own named container scale (max-w-md …) is a token of the framework's theme.
      if (size && !sizeKeywords.has(size[1]) && !/^(?:[2-7]?xl|3xs|2xs|xs|sm|md|lg)$/.test(size[1])) expect(theme.has(`--spacing-${size[1]}`) || theme.has(`--container-${size[1]}`), `${file}: ${token}`).toBe(true);
      const shadow = /^(?:[\w-]+:)*shadow-([a-z][\w-]*)$/.exec(token);
      if (shadow && shadow[1] !== "none") expect(theme.has(`--shadow-${shadow[1]}`), `${file}: ${token}`).toBe(true);
      const type = /^(?:[\w-]+:)*text-(xs|sm|base|lg|xl|\dxl)$/.exec(token);
      if (type) expect(theme.has(`--text-${type[1]}`), `${file}: ${token}`).toBe(true);
    }
  });
});

/** A text utility's colour in a theme as hex — `text-<token>` or `text-<token>/<alpha>`, its `dark:` form in the dark
 * set when it has one — the alpha blended over the page's paper, as the browser paints it. */
function textInk(classes: string, set: Map<string, string>, isDark: boolean): string {
  const of = (prefix: string) => classes.split(/\s+/).map((c) => new RegExp(`^${prefix}text-([a-z][\\w-]*?)(?:/(\\d+))?$`).exec(c)).find((m) => m && colours.has(m[1]));
  const m = (isDark ? of("dark:") : null) ?? of("");
  if (!m) throw new Error(`no text colour in «${classes}»`);
  const alpha = m[2] ? Number(m[2]) / 100 : 1;
  const [fr, fg, fb] = hex(set.get(`--${m[1]}`)!);
  const [br, bg, bb] = hex(set.get("--background")!);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg, bg), mix(fb, bb)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

describe("p3-review-critic-craft-2#craft-3: the tabs' inks, computed from the tokens — every tab holds 4.5:1 on the page, a zero tab quieter than a tab that holds something", () => {
  for (const [name, set] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    test(`${name}: the chosen tab in ink, then a tab that holds something, then a zero tab — each ≥ 4.5:1; «Ещё N» ≥ 4.5:1`, () => {
      const on = (classes: string) => contrast(textInk(classes, set, name === "dark"), set.get("--background")!);
      const [chosen, holds, zero, more] = [on("text-foreground"), on(TAB_INK), on(ZERO_TAB), on(MORE_INK)];
      for (const [what, ratio] of [
        ["a tab that holds something", holds],
        ["a zero tab", zero],
        ["«Ещё N»", more],
      ] as const)
        expect(ratio, what).toBeGreaterThanOrEqual(4.5);
      expect(zero).toBeLessThan(holds);
      expect(holds).toBeLessThan(chosen);
    });
  }
});

describe("contrast, computed from the tokens", () => {
  const TEXT: [fg: string, bg: string][] = [
    ["--foreground", "--background"],
    ["--muted-foreground", "--background"],
    ["--foreground", "--muted"],
    ["--muted-foreground", "--muted"],
    ["--foreground", "--code"],
    ["--foreground", "--popover"],
    ["--muted-foreground", "--popover"],
    ["--primary-foreground", "--primary"],
    ["--background", "--foreground"],
    ["--destructive", "--background"],
  ];
  const DOTS = ["--warning", "--success", "--destructive", "--info", "--muted-foreground"];

  for (const [name, set] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    test(`${name}: text on its ground holds 4.5:1`, () => {
      for (const [fg, bg] of TEXT) expect(contrast(set.get(fg)!, set.get(bg)!), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    });
    test(`${name}: a signal tone, shown only as a dot, holds 3:1 on the page and on a muted row`, () => {
      for (const tone of DOTS) for (const ground of ["--background", "--muted", "--popover"]) expect(contrast(set.get(tone)!, set.get(ground)!), `${tone} on ${ground}`).toBeGreaterThanOrEqual(3);
    });
  }
});
