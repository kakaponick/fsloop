import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { build, collect, HUMAN_VERDICTS } from "../../skills/fsloop/fsl.mjs";
import { criticReport, writeRun } from "../fixtures/make.ts";
import { createApp } from "./http.ts";
import { readRun } from "./run.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fsloopui-verdict-"));
const root = join(temp, "projects");
const ID = "ver00001";
const dir = join(root, "app", ".claude", "fsloop", "runs", ID);
const FINDING = "p1-map-craft-shell#craft-1";
const SECOND = "p1-map-craft-shell#craft-2";
writeRun(dir, {
  id: ID,
  mtime: NOW,
  now: NOW,
  record: true,
  launches: [
    {
      id: "p1-map-craft-shell",
      stage: "p1-map",
      agent: "fsloop-critic",
      description: "craft shell",
      report: criticReport({ lens: "craft assess", findings: ["craft-1 [craft] major high local src/shell.tsx:3 — ux 2 — the toolbar is clipped — /impeccable adapt: wrap it.", "craft-2 [craft] minor med local src/shell.tsx:9 — ux 1 — the tab reads «Run» — /impeccable clarify: name the run."] }),
    },
  ],
});
// An earlier verdict, written before fsloopUI ran.
writeFileSync(join(dir, "human.jsonl"), JSON.stringify({ finding: FINDING, verdict: "disagree", note: null, at: "2026-11-16T08:00:00Z" }) + "\n");

const app = createApp({ roots: [root], distDir: join(temp, "dist"), intervalMs: 60_000, now: () => NOW });
afterAll(() => {
  app.close();
  rmSync(temp, { recursive: true, force: true });
});
const post = (body: unknown) => app.handle(new Request("http://127.0.0.1:4747/api/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
const lines = () => readFileSync(join(dir, "human.jsonl"), "utf8").trim().split("\n");

describe("POST /api/verdict", () => {
  test("appends one line fsl.mjs's own reader accepts, keeping the earlier lines", async () => {
    const res = await post({ run: `app/${ID}`, finding: FINDING, verdict: "wrong-severity", note: "minor, not major" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verdict: { verdict: "wrong-severity", note: "minor, not major", at: "2026-11-16T10:00:00.000Z" } });
    expect(lines()).toHaveLength(2);
    expect(JSON.parse(lines()[1])).toEqual({ finding: FINDING, verdict: "wrong-severity", note: "minor, not major", at: "2026-11-16T10:00:00.000Z" });
    expect(HUMAN_VERDICTS).toContain("wrong-severity");
    const own = build(collect(dir, { git: () => null })).findings.find((f) => f.id === FINDING);
    expect(own?.human).toEqual([
      { verdict: "disagree", note: null, at: "2026-11-16T08:00:00Z" },
      { verdict: "wrong-severity", note: "minor, not major", at: "2026-11-16T10:00:00.000Z" },
    ]);
  });

  test("the next readRun shows it as the finding's latest verdict, with no fsl.mjs build", async () => {
    const f = readRun(dir).findings.find((x) => x.id === FINDING);
    expect(f?.verdict).toEqual({ verdict: "wrong-severity", note: "minor, not major", at: "2026-11-16T10:00:00.000Z" });
    expect(f?.verdicts).toHaveLength(2);
    const served = await (await app.handle(new Request(`http://127.0.0.1:4747/api/run?run=app/${ID}`))).json();
    expect(served.findings[0].verdict.verdict).toBe("wrong-severity");
  });

  test("an empty note is no note", async () => {
    expect((await post({ run: `app/${ID}`, finding: FINDING, verdict: "agree", note: "  " })).status).toBe(200);
    expect(JSON.parse(lines().at(-1) ?? "")).toMatchObject({ verdict: "agree", note: null });
  });

  test("a selection: one note, many findings, one line each, all or none", async () => {
    const before = lines().length;
    const res = await post({ run: `app/${ID}`, findings: [FINDING, SECOND], verdict: "false-positive", note: "same cause" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verdict: { verdict: "false-positive", note: "same cause", at: "2026-11-16T10:00:00.000Z" }, findings: [FINDING, SECOND] });
    expect(lines().slice(before).map((l) => JSON.parse(l))).toEqual([
      { finding: FINDING, verdict: "false-positive", note: "same cause", at: "2026-11-16T10:00:00.000Z" },
      { finding: SECOND, verdict: "false-positive", note: "same cause", at: "2026-11-16T10:00:00.000Z" },
    ]);
    const run = readRun(dir);
    expect(run.findings.filter((f) => f.verdict?.verdict === "false-positive").map((f) => f.id)).toEqual([FINDING, SECOND]);
    // one id the run lacks refuses the whole selection
    const partly = await post({ run: `app/${ID}`, findings: [FINDING, "p1-map-craft-shell#craft-9"], verdict: "agree" });
    expect(partly.status).toBe(404);
    expect(await partly.json()).toEqual({ error: "Находка p1-map-craft-shell#craft-9 не найдена в прогоне app/ver00001" });
    expect((await post({ run: `app/${ID}`, findings: [], verdict: "agree" })).status).toBe(400);
    expect(lines()).toHaveLength(before + 2);
  });

  test("refuses a verdict outside the four, an unknown finding, an unknown run, a body that is not JSON", async () => {
    const before = lines().length;
    const bad = await post({ run: `app/${ID}`, finding: FINDING, verdict: "maybe" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Оценка maybe неизвестна: согласен, не согласен, не та серьёзность, ложная находка" });
    const unknown = await post({ run: `app/${ID}`, finding: "p1-map-craft-shell#craft-9", verdict: "agree" });
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({ error: "Находка p1-map-craft-shell#craft-9 не найдена в прогоне app/ver00001" });
    expect((await post({ run: "app/nope", finding: FINDING, verdict: "agree" })).status).toBe(404);
    expect((await app.handle(new Request("http://127.0.0.1:4747/api/verdict", { method: "POST", body: "{" }))).status).toBe(400);
    expect(lines()).toHaveLength(before);
  });
});
