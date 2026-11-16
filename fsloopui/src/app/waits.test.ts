// @vitest-environment jsdom
// The harness's time bounds (`tests 4`): a wait catches a hang with at least twice its margin inside the test that
// waits, so a failed wait fails as its own assertion, with its message, never as a bare test timeout.
import "../ui/test-setup.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { getConfig } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { budgetBreach } from "../ui/test-budget.ts";

/** The package: vitest runs from it (`npm test`, `npx vitest run` in fsloopui/). */
const PACKAGE = process.cwd();
/** `tests 10`: one test — up to 5 s. */
const BUDGET = 5000;

describe("every test runs within the 5 s budget (`tests 10`); the test's limit only catches a hang (`tests 4`)", () => {
  test("a test over 5 000 ms fails with its name and its time; one at 5 000 ms or under passes", () => {
    expect(budgetBreach("4–6: rows expand in place", 5326.4)).toBe("«4–6: rows expand in place» took 5326 ms: over the 5000 ms one test may take (tests 10)");
    expect(budgetBreach("4–6: rows expand in place", BUDGET)).toBeNull();
    expect(budgetBreach("4–6: rows expand in place", 120)).toBeNull();
  });

  test("the check runs around every test of every file: it is the suite's setup file", () => {
    const config = readFileSync(join(PACKAGE, "vite.config.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(config).toMatch(/setupFiles:\s*\["src\/ui\/test-budget\.ts"\]/);
  });

  test("the test's limit is a hang bound: at least twice the budget", ({ task }) => {
    expect(task.timeout ?? 0).toBeGreaterThanOrEqual(BUDGET * 2);
  });
});

/** Every test file of the package, by its path from the package. */
function testFiles(): string[] {
  const files: string[] = [];
  for (const top of ["src", "server", "shared", "fixtures"]) {
    for (const rel of readdirSync(join(PACKAGE, top), { recursive: true }) as string[]) {
      if (/\.test\.tsx?$/.test(rel) && !rel.split(sep).includes("root")) files.push(join(top, rel));
    }
  }
  return files;
}

describe("a wait inside a test sits at most at half the test's limit", () => {
  test("the shared wait limit (`waitFor`, `findBy`)", ({ task }) => {
    const limit = task.timeout ?? 0;
    expect(limit).toBeGreaterThan(0);
    expect(getConfig().asyncUtilTimeout * 2).toBeLessThanOrEqual(limit);
  });

  test("every wait limit a test file sets itself", ({ task }) => {
    const limit = task.timeout ?? 0;
    const near: string[] = [];
    for (const file of testFiles()) {
      const lines = readFileSync(join(PACKAGE, file), "utf8").replace(/\r\n/g, "\n").split("\n");
      lines.forEach((line, k) => {
        for (const m of line.matchAll(/\btimeout:\s*([\d_]+)/g)) {
          if (Number(m[1].replace(/_/g, "")) * 2 > limit) near.push(`${file.split(sep).join("/")}:${k + 1} — ${m[1]} of ${limit}`);
        }
      });
    }
    expect(near).toEqual([]);
  });
});
