// The URL helpers load no view (code-4): app/routes → views/index → a view → @/finding → app/links → app/routes was a
// load-time cycle, held only by a rule on how a view imports. The view ids live in a module with no components.
import { describe, expect, test, vi } from "vitest";

const loaded = vi.hoisted(() => ({ registry: false }));
vi.mock("../views/index.ts", async (original) => {
  loaded.registry = true;
  return original();
});

describe("routes", () => {
  test("reading the view of an address loads no view of the registry", async () => {
    const { viewOf } = await import("./routes.ts");
    expect(viewOf("?view=units")).toBe("units");
    expect(viewOf("?view=nothing")).toBe("findings");
    expect(loaded.registry).toBe(false);
  });

  test("gap 8 (f15): a convention's address is a query key of its own, built as every other object's", async () => {
    const { runPath } = await import("./routes.ts");
    expect(runPath("tga/a098a7d4", { view: "conventions", convention: "12" })).toBe("/r/tga/a098a7d4?view=conventions&convention=12");
  });
});
