// The 5 s one test may take (`tests 10`), checked around every test of every file: this is the suite's setup file
// (vite.config.ts → setupFiles). The test's limit there only catches a hang (`tests 4`); a test over the budget fails
// here, with its name and its time, whatever that limit is. Longer only with an allow-list entry a human commits —
// the project keeps none.
import { afterEach, beforeEach } from "vitest";

const BUDGET_MS = 5000;

/** The clock as it was when the file loaded: a test's fake timers never reach it. */
const hrtime = process.hrtime.bigint;
const started = new WeakMap<object, bigint>();

/** The failure of a test that took `ms`; null within the budget. */
export function budgetBreach(name: string, ms: number): string | null {
  return ms > BUDGET_MS ? `«${name}» took ${Math.round(ms)} ms: over the ${BUDGET_MS} ms one test may take (tests 10)` : null;
}

beforeEach(({ task }) => {
  started.set(task, hrtime());
});

// Registered first, so it runs after the file's own `afterEach` hooks: the time counts them, as the test's own does.
afterEach(({ task }) => {
  const at = started.get(task);
  const breach = at === undefined ? null : budgetBreach(task.name, Number(hrtime() - at) / 1e6);
  if (breach) throw new Error(breach);
});
