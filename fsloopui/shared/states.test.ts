import { describe, expect, test } from "vitest";
import { OUTCOMES as FSL_OUTCOMES, STEPS as FSL_STEPS } from "../../skills/fsloop/fsl.mjs";
import { LIVENESS } from "./liveness.ts";
import { duration, MINUTE } from "./text.ts";
import { agentKind, CHECK_OUTCOME, checkOutcome, DECISION, FINDING_STATUS, LAUNCH_STATE, launchName, launchNames, launchState, PASS_OUTCOME, reportWord, SEVERITY, stageOf, STAGE_WORDS, STEPS, UNIT_STATE, VERDICT } from "./states.ts";

describe("glossary lines (ui → Glossary → Bound)", () => {
  test("every value of every state map reads «value — meaning» in 80 characters or fewer", () => {
    const maps = { UNIT_STATE, SEVERITY, DECISION, FINDING_STATUS, VERDICT, LAUNCH_STATE, LIVENESS, CHECK_OUTCOME, PASS_OUTCOME };
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
    expect(Object.keys(STAGE_WORDS).sort()).toEqual([...FSL_STEPS, "init", "integrate", "finish"].sort());
  });

  test("the stage order lives beside the words: a pass's steps as fsloop runs them (code-verdict cand-2)", () => {
    expect(STEPS).toEqual(["init", "map", "spike", "decompose", "units", "review", "fix", "verdict", "assess", "integrate", "finish"]);
  });

  test("a pass's outcome as passes.md writes it: next, converged, cap; improve-11 (3) · stalled — every outcome fsl.mjs allows has its word", () => {
    expect(Object.keys(PASS_OUTCOME)).toEqual(["next", "converged", "cap", "stalled"]);
    expect(Object.keys(PASS_OUTCOME).sort()).toEqual([...FSL_OUTCOMES].sort());
    expect(PASS_OUTCOME.next.compact).toBe("следующий проход");
    expect(PASS_OUTCOME.stalled).toEqual({ compact: "без продвижения", full: "без продвижения", tone: "warning", rank: 3, meaning: "Серьёзных находок не стало меньше: новых проходов нет." });
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
    expect(launchState({ running: false, seconds: 3 * 60 + 20 }, NOW).label).toBe("завершён за 3 мин");
  });

  test("p3-decompose-design-check#design-2: a done launch reads its time as how long it took — one form on the rail, the reader and a unit's detail", () => {
    const words = (s: string) => s.split(" ").length;
    const done = (seconds: number | null) => launchState({ running: false, seconds }, NOW);
    expect(done(9 * 60 + 12)).toEqual({ state: "done", label: "завершён за 9 мин", tone: "neutral" });
    expect(words(done(9 * 60 + 12).label)).toBe(4);
    // the widest: hours, compact as in a cell
    expect(done(2 * 3600 + 5 * 60).label).toBe("завершён за 2 ч");
    // under a minute — never seconds (rules/ui → Conventions 10)
    expect(done(40).label).toBe("завершён меньше чем за минуту");
    expect(words(done(40).label)).toBe(5);
    // no time recorded: the word alone
    expect(done(null).label).toBe("завершён");
  });

  test("p3-review-critic-code#code-13: «меньше чем за минуту» is duration()'s own threshold — `MINUTE` of shared/text.ts, never a copy", () => {
    expect(MINUTE).toBe(60_000);
    const done = (seconds: number) => launchState({ running: false, seconds }, NOW).label;
    // one second under the threshold, and the threshold itself: the launch and the duration read the same side
    expect(done(MINUTE / 1000 - 1)).toBe("завершён меньше чем за минуту");
    expect(duration(MINUTE - 1000)).toBe("меньше минуты");
    expect(done(MINUTE / 1000)).toBe("завершён за 1 мин");
    expect(duration(MINUTE)).toBe("1 мин");
  });

  test("a critic's report is «отчёт критика», any other «отчёт запуска»", () => {
    expect(reportWord({ agent: "fsloop-critic", description: "critic code" })).toBe("отчёт критика");
    expect(reportWord({ agent: "fsloop-implement", description: "u1 implement" })).toBe("отчёт запуска");
  });

  test("a name two launches share carries the pass, or the stage when the pass is shared too (craft-10)", () => {
    const critic = (id: string, stage: string, description: string) => ({ id, stage, agent: "fsloop-critic", description });
    const names = launchNames([
      critic("p1-map-craft-shell", "p1-map", "craft shell"),
      critic("p1-review-critic-runtime", "p1-review", "critic runtime"),
      critic("p2-review-critic-runtime", "p2-review", "critic runtime"),
      critic("p2-assess-critic-runtime", "p2-assess", "critic runtime"),
      critic("p1-review-critic-code", "p1-review", "critic code"),
      critic("p2-review-critic-code", "p2-review", "critic code"),
      { id: "p1-units-u1-implement", stage: "p1-units", agent: "fsloop-implement", description: "u1 implement" },
    ]);
    expect(Object.fromEntries(names)).toEqual({
      "p1-map-craft-shell": "craft · shell",
      "p1-review-critic-runtime": "runtime · проход 1",
      "p2-review-critic-runtime": "runtime · проход 2 · ревью",
      "p2-assess-critic-runtime": "runtime · проход 2 · приёмка",
      "p1-review-critic-code": "code · проход 1",
      "p2-review-critic-code": "code · проход 2",
      "p1-units-u1-implement": "u1 · исполнитель",
    });
    // Nothing tells two launches of one stage apart: each carries its number among them (craft-verdict cand-13).
    expect([...launchNames([critic("a", "p1-review", "critic code"), critic("b", "p1-review", "critic code")]).values()]).toEqual(["code · запуск 1", "code · запуск 2"]);
    // Beside a namesake of another pass, the twins keep their stage too: no two names alike.
    expect([...launchNames([critic("a", "p1-review", "critic code"), critic("b", "p1-review", "critic code"), critic("c", "p2-review", "critic code")]).values()]).toEqual(["code · проход 1 · ревью · запуск 1", "code · проход 1 · ревью · запуск 2", "code · проход 2"]);
  });
});

describe("a unit check's outcome (rules/ui → Conventions 1, code-10)", () => {
  test("passed, failed with its exit code, not recorded — words of the shared map", () => {
    expect(CHECK_OUTCOME.passed).toMatchObject({ compact: "прошла", tone: "success" });
    expect(CHECK_OUTCOME.failed).toMatchObject({ compact: "упала", tone: "warning" });
    expect(checkOutcome(0)).toBe("прошла");
    expect(checkOutcome(127)).toBe("упала · exit 127");
    expect(checkOutcome(null)).toBe("не записано");
  });
});
