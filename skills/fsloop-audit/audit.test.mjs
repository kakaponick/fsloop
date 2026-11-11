import { describe, expect, test } from "bun:test";

import { budgetLabel, candidateLines, classify, intervalsOf, kappa, keyer, lensOf, mergeGroups, parseArgs, parseFixLog, parseGroups, pathsIn, renderWork, selectWork, stageWindows, stateOf, sweep } from "./audit.mjs";

describe("candidateLines", () => {
  test("takes bullets up to the next section and joins a wrapped line", () => {
    const text = ["LENS: code", "FINDINGS:", "- code-1 major", "CANDIDATES:", "- first", "  wrapped", "1. second", "UNVERIFIED:", "- not this"].join("\n");
    expect(candidateLines(text).lines).toEqual(["first wrapped", "second"]);
  });

  test("reads a bold header and an inline value", () => {
    expect(candidateLines("**CANDIDATES:** one thing").lines).toEqual(["one thing"]);
    expect(candidateLines("**CANDIDATES:**\n- item").lines).toEqual(["item"]);
  });

  test("an empty mark is no line", () => {
    expect(candidateLines("CANDIDATES: —\n- none").lines).toEqual([]);
  });

  test("text with no bullet first is kept and named as an anomaly", () => {
    const { lines, anomalies } = candidateLines("CANDIDATES:\nloose text");
    expect(lines).toEqual(["loose text"]);
    expect(anomalies).toEqual([{ line: 2, text: "loose text" }]);
  });

  test("a closing fence ends the section", () => {
    expect(candidateLines("CANDIDATES:\n- kept\n```\n- outside").lines).toEqual(["kept"]);
  });

  test("prose after a blank line ends the section, a further bullet does not", () => {
    expect(candidateLines("CANDIDATES:\n- kept\n\nThe files I used were these.").lines).toEqual(["kept"]);
    expect(candidateLines("CANDIDATES:\n- one\n\n- two").lines).toEqual(["one", "two"]);
  });
});

describe("lensOf", () => {
  test("the declared lens wins over the file name", () => {
    expect(lensOf("p1-review-critic-code.md", "LENS: runtime")).toBe("runtime");
    expect(lensOf("x.md", "LENS: code verdict")).toBe("code-verdict");
  });

  test("falls back to the file name", () => {
    expect(lensOf("integrate-critic-craft-verdict-3.md", "")).toBe("craft-verdict");
    expect(lensOf("p1-review-critic-runtime.md", "")).toBe("runtime");
  });
});

test("keyer is stable and tells identical lines apart by position", () => {
  const a = keyer();
  const b = keyer();
  const first = a("r", "l", "same");
  expect(b("r", "l", "same")).toBe(first);
  expect(a("r", "l", "same")).toBe(`${first}~1`);
  expect(a("r", "other", "same")).not.toBe(first);
});

test("classify names a command list by its log and a plain command by its verb", () => {
  expect(classify("s=$(date +%s); bun test > land.log")).toBe("list:land");
  expect(classify("bun test ./x.test.ts")).toBe("test");
  expect(classify("git -C wt rebase origin/main")).toBe("git-write");
  expect(classify("ls -la")).toBe("shell-read");
});

describe("budgetLabel", () => {
  const gen = (agent, role) => ({ agent, role, cat: `gen:${role}` });

  test("counts implement lanes by distinct agent, whatever else runs", () => {
    expect(budgetLabel([gen("a", "fsloop-implement"), { agent: "a", role: "fsloop-implement", cat: "tool:sub:test" }])).toBe("implement, 1 lane");
    expect(budgetLabel([gen("a", "fsloop-implement"), gen("b", "fsloop-debug"), gen("main", "orchestrator")])).toBe("implement, 2 lanes");
    expect(budgetLabel(["a", "b", "c", "d"].map((x) => gen(x, "fsloop-implement")))).toBe("implement, 3+ lanes");
  });

  test("review outranks research, research outranks the orchestrator", () => {
    expect(budgetLabel([gen("a", "fsloop-critic"), gen("b", "Explore")])).toBe("review, no implement");
    expect(budgetLabel([gen("b", "Explore"), gen("main", "orchestrator")])).toBe("research");
    expect(budgetLabel([gen("b", "prod-check")])).toBe("other agents");
  });

  test("the orchestrator alone is generating or in tools", () => {
    expect(budgetLabel([gen("main", "orchestrator"), { agent: "main", role: "orchestrator", cat: "tool:orch:test" }])).toBe("orchestrator generating alone");
    expect(budgetLabel([{ agent: "main", role: "orchestrator", cat: "tool:orch:test" }])).toBe("orchestrator alone in tools");
  });
});

describe("sweep", () => {
  test("splits overlapping time equally and counts the rest as a gap", () => {
    const { busy, share, concurrency, gaps } = sweep(
      [
        { s: 0, e: 10, cat: "gen:a", agent: "1", role: "a" },
        { s: 5, e: 10, cat: "gen:b", agent: "2", role: "b" },
      ],
      0,
      20,
    );
    expect(busy).toBe(10);
    expect(share).toEqual({ "gen:a": 7.5, "gen:b": 2.5 });
    expect(concurrency).toEqual({ 1: 5, 2: 5 });
    expect(gaps).toEqual([{ s: 10, e: 20 }]);
  });

  test("the budget's rows sum to active time", () => {
    const { busy, budget } = sweep(
      [
        { s: 0, e: 10, cat: "gen:fsloop-implement", agent: "a", role: "fsloop-implement" },
        { s: 5, e: 20, cat: "gen:orchestrator", agent: "main", role: "orchestrator" },
      ],
      0,
      30,
    );
    expect(budget).toEqual({ "implement, 1 lane": 10, "orchestrator generating alone": 10 });
    expect(Object.values(budget).reduce((a, b) => a + b)).toBe(busy);
  });

  test("clamps intervals to the window", () => {
    expect(sweep([{ s: -5, e: 50, cat: "gen:a", agent: "1", role: "a" }], 0, 10).busy).toBe(10);
  });
});

describe("stageWindows", () => {
  test("a stage re-gated later keeps windows ordered and without overlap", () => {
    const at = (n) => new Date(n).toISOString();
    const windows = stageWindows(
      [
        { stage: "p1-map", green: true, at: at(100), startedAt: at(0) },
        { stage: "p1-spike", green: true, at: at(50), startedAt: at(60) },
        { stage: "p1-decompose", green: true, at: at(200), startedAt: at(90) },
      ],
      0,
      200,
    );
    expect(windows.map((w) => [w.stage, w.start, w.end])).toEqual([["p1-spike", 0, 50], ["p1-map", 50, 100], ["p1-decompose", 100, 200]]);
  });

  test("the stage still in progress runs to the end of the window", () => {
    const windows = stageWindows([{ stage: "p1-map", green: true, at: new Date(10).toISOString() }, { stage: "p1-units", green: false }], 0, 40);
    expect(windows.at(-1)).toEqual({ stage: "p1-units", start: 10, end: 40, open: true });
  });
});

test("kappa is 1 on full agreement and 0 when agreement is chance", () => {
  expect(kappa([["a", "a"], ["b", "b"]]).kappa).toBe(1);
  expect(kappa([["a", "a"], ["a", "b"], ["b", "a"], ["b", "b"]]).kappa).toBe(0);
  expect(kappa([]).kappa).toBeNull();
});

test("parseFixLog groups files under their commit", () => {
  const text = "\u0001abc\u001f2026-11-01T00:00:00Z\u001ffix(x): y\u001frun1\n\na.ts\nb.ts\n\u0001def\u001f2026-11-02T00:00:00Z\u001ffix: z\u001f\n";
  expect(parseFixLog(text)).toEqual([
    { sha: "abc", at: "2026-11-01T00:00:00Z", subject: "fix(x): y", trailer: "run1", files: ["a.ts", "b.ts"] },
    { sha: "def", at: "2026-11-02T00:00:00Z", subject: "fix: z", trailer: null, files: [] },
  ]);
});

test("stateOf closes an init run at its green gate; an unclosed run is live only on recent activity", () => {
  const now = 10_000_000;
  expect(stateOf({ closed: true, outcome: { pushed: true } })).toBe("closed, pushed");
  expect(stateOf({ running: [], stages: [{ stage: "init", green: true }] })).toBe("closed, init");
  expect(stateOf({ running: [], stages: [{ stage: "p1-map", green: true }] }, now - 60_000, now)).toBe("running");
  expect(stateOf({ running: [], stages: [{ stage: "p1-map", green: true }] }, now - 3_600_000, now)).toBe("open, idle");
});

describe("parseArgs", () => {
  test("reads runs, out and the positional file", () => {
    expect(parseArgs(["labels.json", "--runs", "a, b", "--out", "d", "--compare"])).toEqual({ positional: ["labels.json"], runs: ["a", "b"], out: "d", compare: true });
  });

  test("a flag with no value is an error", () => {
    expect(parseArgs(["--runs"]).error).toBe("--runs needs a value");
  });
});

test("mergeGroups replaces a block by id, appends a new one and keeps the head", () => {
  const current = "# Head\n\n### A\n- old a\n\n### B\n- b\n";
  const { text, added, replaced } = mergeGroups(current, "### A\n- new a\n\n### C\n- c");
  expect(text).toBe("# Head\n\n### A\n- new a\n\n### B\n- b\n### C\n- c\n");
  expect({ added, replaced }).toEqual({ added: 1, replaced: 1 });
});

test("mergeGroups keeps a section heading that follows a replaced block", () => {
  const { text } = mergeGroups("### A\n- old\n\n## Next\n\n### B\n- b\n", "### A\n- new\n");
  expect(text).toBe("### A\n- new\n## Next\n\n### B\n- b\n");
});

describe("work file", () => {
  const groupsText = [
    "# Группы",
    "## Дефекты",
    "### D-low",
    "- класс: defect · тяжесть: низкая · статус: stands",
    "- что: low thing",
    "- где: src/a/b.ts:1",
    "- правило: нет",
    "",
    "### D-mid",
    "- класс: defect · тяжесть: средняя · статус: stands",
    "- что: mid thing",
    "- где: src/c/d.ts:2, src/e/f.ts:3",
    "- должно: stays right",
    "- вопрос: keep or erase?",
    "- правило: `rules`: «x»",
    "",
    "## Улучшения",
    "### D-fixed",
    "- класс: defect · тяжесть: средняя · статус: fixed · коммит: abc",
    "- что: gone",
    "",
    "### I-big",
    "- класс: imp+ · тяжесть: — · статус: stands",
    "- что: big change",
    "",
    "### P-open",
    "- класс: product · тяжесть: — · статус: open",
    "- что: which way?",
    "",
    "### S-small",
    "- класс: small · тяжесть: низкая · статус: stands",
    "- что: small",
  ].join("\n");
  const groups = parseGroups(groupsText);

  test("parseGroups reads a block's fields and stops at the next section", () => {
    expect(groups.map((g) => g.id)).toEqual(["D-low", "D-mid", "D-fixed", "I-big", "P-open", "S-small"]);
    expect(groups[1]).toMatchObject({ class: "defect", severity: "средняя", status: "stands", should: "stays right", question: "keep or erase?", where: "src/c/d.ts:2, src/e/f.ts:3" });
    expect(groups[2].status).toBe("fixed");
  });

  test("standing defects go to work worst first; product and a finding's question become questions", () => {
    const { taken, questions, left } = selectWork(groups);
    expect(taken.map((g) => g.id)).toEqual(["D-mid", "D-low"]);
    expect(questions).toEqual([{ id: "P-open", text: "which way?" }, { id: "D-mid", text: "keep or erase?" }]);
    expect(left.map((g) => g.id)).toEqual(["I-big"]);
  });

  test("named groups replace the class filter, and what is left stays listed", () => {
    const { taken, left } = selectWork(groups, { only: ["I-big"] });
    expect(taken.map((g) => g.id)).toEqual(["I-big"]);
    expect(left.map((g) => g.id)).toEqual(["D-mid", "D-low"]);
  });

  test("the rendered file carries the command, the sha, each section and no empty rule", () => {
    const text = renderWork(selectWork(groups), { path: "C:/x/findings.md", sha: "abc1234", date: "2026-11-03" });
    expect(text).toContain("`/fsloop исправить находки аудита — C:/x/findings.md`");
    expect(text).toContain("`origin/main` `abc1234`. В работе: 2, вопросов: 2, не в работе: 1.");
    expect(text.indexOf("### D-mid")).toBeLessThan(text.indexOf("### D-low"));
    expect(text).toContain("- Должно: stays right");
    expect(text).toContain("- Вопрос: which way?\n- Ответ: —");
    expect(text).toContain("- `I-big` · —: big change");
    expect(text).not.toContain("- Правило: нет");
    expect(text).not.toContain("D-fixed");
  });

  test("pathsIn takes paths with a folder and skips a bare name", () => {
    expect(pathsIn("src/a/b.ts:1, :9, src/c.test.ts:2-4 (ср. sync.ts:231)")).toEqual(["src/a/b.ts", "src/c.test.ts"]);
    expect(pathsIn(null)).toEqual([]);
  });
});

describe("intervalsOf", () => {
  const entry = (o) => JSON.stringify({ timestamp: new Date(o.t).toISOString(), ...o });

  test("one request is one generation interval, a tool runs to its result", () => {
    const jsonl = [
      entry({ t: 0, type: "api-request", id: "r1" }),
      entry({ t: 10, type: "assistant", requestRef: "r1", message: { id: "m", usage: { output_tokens: 3 }, content: [] } }),
      entry({ t: 20, type: "assistant", requestRef: "r1", message: { id: "m", usage: { output_tokens: 9 }, content: [{ type: "tool_use", id: "t1", name: "Read", input: {} }] } }),
      entry({ t: 50, type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "" }] } }),
    ].join("\n");
    const { intervals, first } = intervalsOf(jsonl, { agent: "a1", role: "fsloop-critic" });
    expect(first).toBe(0);
    expect(intervals.find((i) => i.cat === "gen:fsloop-critic")).toMatchObject({ s: 0, e: 20, output: 9 });
    expect(intervals.find((i) => i.cat === "tool:sub:file-tool")).toMatchObject({ s: 20, e: 50 });
  });

  test("a background command lasts until its notification, an Agent wait is not a tool", () => {
    const jsonl = [
      entry({ t: 0, type: "assistant", message: { id: "m", usage: {}, content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "bun test", run_in_background: true } }, { type: "tool_use", id: "t2", name: "Agent", input: {} }] } }),
      entry({ t: 5, type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "" }] } }),
      entry({ t: 100, type: "queue-operation", content: "<task-notification><tool-use-id>t1</tool-use-id></task-notification>" }),
    ].join("\n");
    const { intervals } = intervalsOf(jsonl, { agent: "main", role: "orchestrator" });
    expect(intervals.find((i) => i.cat === "tool:orch:bg:test")).toMatchObject({ s: 0, e: 100 });
    expect(intervals.filter((i) => i.cat.startsWith("tool:")).length).toBe(1);
  });

  test("a sub-agent's background notification arrives as an attachment", () => {
    const jsonl = [
      entry({ t: 0, type: "assistant", message: { id: "m", usage: {}, content: [{ type: "tool_use", id: "t1", name: "Bash", input: { command: "bun test", run_in_background: true } }] } }),
      entry({ t: 5, type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: "" }] } }),
      entry({ t: 200, type: "attachment", attachment: { prompt: "<task-notification><tool-use-id>t1</tool-use-id></task-notification>" } }),
    ].join("\n");
    expect(intervalsOf(jsonl, { agent: "a1", role: "fsloop-implement" }).intervals.find((i) => i.cat === "tool:sub:bg:test")).toMatchObject({ s: 0, e: 200 });
  });

  test("a usage-limit message is a limit stop, a finding about limits is not", () => {
    const stop = entry({ t: 7, type: "assistant", message: { id: "m", usage: {}, content: [{ type: "text", text: "You've hit your limit · resets 7am" }] } });
    const finding = entry({ t: 8, type: "assistant", message: { id: "n", usage: {}, content: [{ type: "text", text: `code-1 major the rate limit is not honoured ${"x".repeat(200)}` }] } });
    const { limitStops } = intervalsOf([stop, finding].join("\n"), { agent: "main", role: "orchestrator" });
    expect(limitStops).toEqual([{ at: new Date(7).toISOString(), agent: "main", role: "orchestrator" }]);
  });
});
