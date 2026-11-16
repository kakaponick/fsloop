import { describe, expect, test } from "vitest";
import { LIVENESS, livenessOf, THRESHOLDS } from "./liveness.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const before = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

describe("livenessOf (rules/ui → Live data 4)", () => {
  test("a fresh write is «работает», neutral", () => {
    const l = livenessOf(before(4 * MIN + 59_000), NOW);
    expect(l.state).toBe("working");
    expect(l.label).toBe("работает");
    expect(l.tone).toBe("neutral");
  });

  test("from 5 minutes it is «тихо · N мин», still neutral", () => {
    const l = livenessOf(before(12 * MIN), NOW);
    expect(l.state).toBe("quiet");
    expect(l.label).toBe("тихо · 12 мин");
    expect(l.tone).toBe("neutral");
    expect(livenessOf(before(5 * MIN), NOW).state).toBe("quiet");
  });

  test("past 30 minutes it is «молчит», amber, and long silent from 6 hours", () => {
    const l = livenessOf(before(3 * 60 * MIN + 20 * MIN), NOW);
    expect(l.state).toBe("silent");
    expect(l.label).toBe("молчит · 3 ч");
    expect(l.tone).toBe("warning");
    expect(l.longSilent).toBe(false);
    expect(livenessOf(before(30 * MIN + 1000), NOW).state).toBe("silent");
    expect(livenessOf(before(6 * 60 * MIN), NOW).longSilent).toBe(true);
  });

  test("a closed run is «закрыт» whatever its last write", () => {
    const l = livenessOf(before(MIN), NOW, { closed: true });
    expect(l.state).toBe("closed");
    expect(l.label).toBe("закрыт");
    expect(l.longSilent).toBe(false);
  });

  test("no write time recorded reads «не записано», never a guess", () => {
    const l = livenessOf(null, NOW);
    expect(l.state).toBe("unknown");
    expect(l.label).toBe("не записано");
    expect(l.tone).toBe("neutral");
  });

  test("the thresholds live once, beside the function", () => {
    expect(THRESHOLDS).toEqual({ quiet: 5 * MIN, silent: 30 * MIN, longSilent: 6 * 60 * MIN });
    expect(LIVENESS.working.full).toBe("работает — прогон писал в последние 5 минут");
  });
});
