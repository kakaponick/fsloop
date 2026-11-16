import { describe, expect, test } from "vitest";
import { STEPS } from "../../skills/fsloop/fsl.mjs";
import { LIVENESS } from "./liveness.ts";
import { agentKind, DECISION, FINDING_STATUS, LAUNCH_STATE, launchName, launchState, reportWord, SEVERITY, stageOf, STAGE_WORDS, UNIT_STATE, VERDICT } from "./states.ts";

describe("glossary lines (ui → Glossary → Bound)", () => {
  test("every value of every state map reads «value — meaning» in 80 characters or fewer", () => {
    const maps = { UNIT_STATE, SEVERITY, DECISION, FINDING_STATUS, VERDICT, LAUNCH_STATE, LIVENESS };
    const over = Object.entries(maps).flatMap(([name, map]) =>
      Object.entries(map as Record<string, { compact: string; meaning: string }>)
        .map(([key, e]) => ({ at: `${name}.${key}`, line: `${e.compact} — ${e.meaning}` }))
        .filter(({ line }) => line.length > 80)
        .map(({ at, line }) => `${at} (${line.length}): ${line}`),
    );
    expect(over).toEqual([]);
  });
});

describe("the stage map (common.md → Design conventions)", () => {
  test("covers fsl.mjs's steps plus init, integrate and finish", () => {
    expect(Object.keys(STAGE_WORDS).sort()).toEqual([...STEPS, "init", "integrate", "finish"].sort());
  });

  test("a stage with a pass reads «проход k · <word>», its compact form the word", () => {
    expect(stageOf("p2-review")).toMatchObject({ compact: "ревью", full: "проход 2 · ревью", pass: 2, step: "review" });
    expect(stageOf("p1-units").full).toBe("проход 1 · юниты в работе");
    expect(stageOf("p1-verdict").compact).toBe("проверка исправлений");
    expect(stageOf("init")).toMatchObject({ compact: "настройка проекта", full: "настройка проекта", pass: null });
    expect(stageOf("integrate").full).toBe("интеграция");
    expect(stageOf("finish").full).toBe("завершение");
  });

  test("no stage, or one fsl.mjs does not know, reads «не записано»", () => {
    expect(stageOf(null).full).toBe("не записано");
    expect(stageOf("p1-dance").full).toBe("p1-dance");
  });
});

describe("state maps (rules/ui → Conventions 1–2)", () => {
  test("work in progress is neutral, committed green, blocked amber", () => {
    expect(UNIT_STATE.implement).toMatchObject({ compact: "пишется", tone: "neutral" });
    expect(UNIT_STATE.committed).toMatchObject({ compact: "закоммичен", tone: "success" });
    expect(UNIT_STATE.blocked).toMatchObject({ compact: "заблокирован", tone: "warning" });
    expect(UNIT_STATE.unknown.compact).toBe("не записано");
  });

  test("severity is the one category with a tone, ranked critical first", () => {
    expect(SEVERITY.critical).toMatchObject({ tone: "danger", rank: 0 });
    expect(SEVERITY.major).toMatchObject({ tone: "warning", rank: 1 });
    expect(SEVERITY.minor).toMatchObject({ tone: "neutral", rank: 2 });
  });

  test("the run's decision and the user's verdict keep the product's words", () => {
    expect(DECISION.fix.compact).toBe("в исправление");
    expect(DECISION.candidate.compact).toBe("кандидат");
    expect(DECISION.none.compact).toBe("без решения");
    expect(VERDICT["wrong-severity"].compact).toBe("не та серьёзность");
    expect(VERDICT["false-positive"].compact).toBe("ложная находка");
    expect(FINDING_STATUS.fixed.tone).toBe("success");
    expect(FINDING_STATUS["in-progress"].tone).toBe("neutral");
  });

  test("every entry carries its compact and full form, tone, rank and meaning", () => {
    for (const map of [UNIT_STATE, SEVERITY, DECISION, VERDICT, FINDING_STATUS])
      for (const e of Object.values(map)) {
        expect(e.compact.length).toBeGreaterThan(0);
        expect(e.full.length).toBeGreaterThan(0);
        expect(e.meaning.length).toBeGreaterThan(0);
        expect(typeof e.rank).toBe("number");
      }
  });
});

describe("launches", () => {
  const NOW = Date.parse("2026-11-16T10:00:00Z");

  test("agent kinds, any other as written", () => {
    expect(agentKind({ agent: "fsloop-critic", description: "craft notifications" })).toBe("критик");
    expect(agentKind({ agent: "fsloop-implement", description: "u2 implement" })).toBe("исполнитель");
    expect(agentKind({ agent: "Explore", description: "map" })).toBe("карта");
    expect(agentKind({ agent: "spike-researcher", description: "spike telegram" })).toBe("разведка");
    expect(agentKind({ agent: "prod-check", description: "prod check" })).toBe("prod-check");
  });

  test("one compact launch name", () => {
    expect(launchName({ agent: "fsloop-critic", description: "craft notifications" })).toBe("craft · notifications");
    expect(launchName({ agent: "fsloop-critic", description: "critic code verdict" })).toBe("code · verdict");
    expect(launchName({ agent: "fsloop-critic", description: "critic runtime" })).toBe("runtime");
    expect(launchName({ agent: "fsloop-implement", description: "u2 implement" })).toBe("u2 · исполнитель");
    expect(launchName({ agent: "Explore", description: "map" })).toBe("карта");
    expect(launchName({ agent: "general-purpose", description: "e2e run stage 2" })).toBe("e2e run stage 2");
    expect(launchName(null)).toBe("прогон");
  });

  test("a running launch reads «работает · 12 мин», neutral", () => {
    const s = launchState({ running: true, startedAt: new Date(NOW - 12 * 60_000).toISOString() }, NOW);
    expect(s).toEqual({ state: "running", label: "работает · 12 мин", tone: "neutral" });
    expect(launchState({ running: false, reportMissing: true }, NOW).label).toBe("нет отчёта");
    expect(launchState({ running: false, seconds: 3 * 60 + 20 }, NOW).label).toBe("завершён · 3 мин");
  });

  test("a critic's report is «отчёт критика», any other «отчёт запуска»", () => {
    expect(reportWord({ agent: "fsloop-critic", description: "critic code" })).toBe("отчёт критика");
    expect(reportWord({ agent: "fsloop-implement", description: "u1 implement" })).toBe("отчёт запуска");
  });
});
