// @vitest-environment jsdom
import "./test-setup.ts";
import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { THRESHOLDS } from "../../shared/liveness.ts";
import { applyStylesheet } from "../app/layout-testing.ts";
import { EDGE_MS, OPEN_FRAME, useEdgeMarks } from "./marks.tsx";

interface Row {
  key: string;
  state: string;
  note: string;
}

const id = (r: Row) => r.key;
/** The view's own sign: what a change of the run moves. Here the note is the user's, not the run's. */
const sign = (r: Row) => r.state;

describe("the edge mark (rules/ui → Conventions 9): one hook for every live list", () => {
  test("the first read marks nothing; a change the view's sign sees marks its row until «the last minutes» pass", () => {
    const rows: Row[] = [
      { key: "a", state: "ready", note: "" },
      { key: "b", state: "ready", note: "" },
    ];
    const t0 = Date.parse("2026-11-16T04:00:00Z");
    const { result, rerender } = renderHook((p: { version: number; rows: readonly Row[]; now: number }) => useEdgeMarks(p.version, p.rows, id, sign, p.now), { initialProps: { version: 1, rows, now: t0 } });
    expect(result.current("a")).toBe(false);
    expect(result.current("b")).toBe(false);
    // b moves its state, a only its note: the sign sees b alone
    const next = [{ ...rows[0], note: "моя оценка" }, { ...rows[1], state: "implement" }, { key: "c", state: "ready", note: "" }];
    rerender({ version: 2, rows: next, now: t0 + 1000 });
    expect(result.current("a")).toBe(false);
    expect(result.current("b")).toBe(true);
    // a row the run adds is new, not changed: the held strip names it, the edge mark does not
    expect(result.current("c")).toBe(false);
    rerender({ version: 2, rows: next, now: t0 + 1000 + EDGE_MS - 1 });
    expect(result.current("b")).toBe(true);
    rerender({ version: 2, rows: next, now: t0 + 1000 + EDGE_MS });
    expect(result.current("b")).toBe(false);
  });

  test("«the last minutes» are the fresh write's span, owned once beside the mark", () => {
    expect(EDGE_MS).toBe(THRESHOLDS.quiet);
  });
});

describe("p3-decompose-design-check#design-4: the open row's frame — one export for the table and ExpandingFindings", () => {
  test("a 1 px inset frame in muted ink (ink on a link's target): the row draws its top and sides, the detail its sides and bottom", () => {
    expect(OPEN_FRAME.muted).toBe("[--frame:var(--muted-foreground)]");
    expect(OPEN_FRAME.target).toBe("[--frame:var(--foreground)]");
    // theme shadows, as the edge and target marks are (src/ui/tokens.test.ts: no arbitrary size in a component)
    expect(OPEN_FRAME.row).toBe("shadow-open-row");
    expect(OPEN_FRAME.detail).toBe("shadow-open-detail");
  });

  test("drawn inside the box (an inset shadow), so opening a row moves nothing: the product's stylesheet builds both parts", async () => {
    document.body.innerHTML = `<div id="row" class="${OPEN_FRAME.muted} ${OPEN_FRAME.row}"></div><div id="detail" class="${OPEN_FRAME.muted} ${OPEN_FRAME.detail}"></div>`;
    await applyStylesheet();
    const css = document.head.querySelector("style[data-product-stylesheet]")?.textContent ?? "";
    expect(css).toContain("inset 0 1px 0 0 var(--tw-shadow-color, var(--frame))");
    expect(css).toContain("inset 0 -1px 0 0 var(--tw-shadow-color, var(--frame))");
    expect(css).toMatch(/--frame:\s*var\(--muted-foreground\)/);
    for (const id of ["row", "detail"]) {
      const s = getComputedStyle(document.getElementById(id) as HTMLElement);
      for (const side of ["Top", "Right", "Bottom", "Left"] as const) expect(s[`border${side}Width`] === "" || s[`border${side}Width`] === "0px").toBe(true);
    }
  });
});
