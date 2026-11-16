// The views' registry loads with `@/finding` read through its index at the top level (code-4: no load-time cycle),
// and the «Отчёты» tab counts what the run model counts once (craft-8).
import { join } from "node:path";
import { describe, expect, inject, test } from "vitest";
import { FACETS, openFindings } from "@/finding";
import { PROJECTS, runId } from "../../fixtures/make.ts";
import { readRun } from "../../server/run.ts";
import { DEFAULT_VIEW, VIEW_IDS, VIEWS } from "./index.ts";

// A top-level read through the index: the load order no longer depends on how a view imports.
const facets = Object.keys(FACETS);

describe("the views' registry", () => {
  test("loads whole with @/finding read through its index first", () => {
    expect(facets).toContain("report");
    expect(typeof openFindings).toBe("function");
    expect(VIEWS.map((v) => v.id)).toEqual([...VIEW_IDS]);
    expect(VIEWS.every((v) => typeof v.component === "function")).toBe(true);
    expect(DEFAULT_VIEW).toBe("findings");
  });

  test("the «Отчёты» tab counts every launch of the run, the running one included — the model's one count", () => {
    let first = 0;
    const project = PROJECTS.find((p) => (first += p.runs) > 40)?.name ?? "";
    const run = readRun(join(inject("fixtureRoot"), project, ".claude", "fsloop", "runs", runId(40)), { git: () => null });
    const reports = VIEWS.find((v) => v.id === "reports");
    // 97 recorded launches and 1 running (fixtures/make.ts → maxRun): the rail, the «Агент» filter and the status bar list 98.
    expect(reports?.count(run)).toBe(98);
  });
});
