import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = mkdtempSync(join(tmpdir(), "fsloop-audit-"));
const out = join(repo, "out");
const store = join(repo, ".claude", "fsloop", "audit");
let main;
let auditFolder;

const json = (name) => JSON.parse(readFileSync(join(out, name), "utf8"));
const addRun = (id, startedAt, findings, report) => {
  const dir = join(repo, ".claude", "fsloop", "runs", id);
  mkdirSync(join(dir, "reports"), { recursive: true });
  writeFileSync(join(dir, "run.json"), JSON.stringify({ id, startedAt, closed: true, outcome: { pushed: true }, findings, launches: [], stages: [] }));
  writeFileSync(join(dir, "reports", "p1-review-critic-runtime.md"), report);
};

beforeAll(async () => {
  process.env.FSLOOP_AUDIT_REPO = repo;
  ({ main, auditFolder } = await import(`./audit.mjs?flow=${Date.now()}`));
  addRun(
    "later",
    "2026-02-01T00:00:00Z",
    [
      { id: "f1", stage: "p1-review", severity: "minor", decision: "fix", rule: "`code` → No duplication" },
      { id: "f2", stage: "p1-review", severity: "minor", decision: "candidate", launch: "p1-review-critic-code", raw: "a dropped minor" },
      { id: "f3", stage: "p2-review", severity: "major", decision: "fix", rule: "`code` → No duplication" },
    ],
    "LENS: runtime\nCANDIDATES:\n- line two\n",
  );
  addRun("earlier", "2026-01-01T00:00:00Z", [], "LENS: runtime\nCANDIDATES:\n- line one\n");
});

afterAll(() => {
  delete process.env.FSLOOP_AUDIT_REPO;
  rmSync(repo, { recursive: true, force: true });
});

test("an unknown run id fails and names the id", () => {
  expect(main(["funnel", "--runs", "nope", "--out", out])).toBe(1);
  expect(existsSync(join(out, "funnel.json"))).toBe(false);
});

test("funnel counts severity against decision per run, oldest first", () => {
  expect(main(["funnel", "--out", out])).toBe(0);
  const { rows, topRules } = json("funnel.json");
  expect(rows.map((r) => r.run)).toEqual(["earlier", "later"]);
  expect(rows[1]).toMatchObject({ findings: 3, fixMinor: 1, lines: 1 });
  expect(rows[1].decision).toMatchObject({ fix: 2, candidate: 1 });
  expect(topRules).toEqual([["code → No duplication", 2]]);
});

test("--runs narrows the scope", () => {
  expect(main(["lines", "--runs", "earlier", "--out", out])).toBe(0);
  expect(json("unlabeled.json").map((i) => i.raw)).toEqual(["line one"]);
});

test("labels land in the ledger, leave unlabeled, and hide in a recheck", () => {
  expect(main(["lines", "--out", out])).toBe(0);
  const items = json("unlabeled.json");
  expect(items.map((i) => [i.kind, i.raw])).toEqual([["line", "line one"], ["line", "line two"], ["finding", "a dropped minor"]]);

  const labels = join(out, "labels.json");
  writeFileSync(labels, JSON.stringify(items.map((i) => ({ key: i.key, class: "defect", group: "D-x" }))));
  expect(main(["label", labels])).toBe(0);

  expect(main(["lines", "--recheck", "2", "--out", out])).toBe(0);
  expect(json("unlabeled.json")).toEqual([]);
  const recheck = json("recheck.json");
  expect(recheck.length).toBe(2);
  for (const item of recheck) expect(item.class ?? item.group).toBeUndefined();
  expect(readFileSync(join(out, "classes.md"), "utf8")).toContain("| later | 1 | 1 |");
});

test("--compare writes nothing; a relabel keeps the group and the last label wins", () => {
  const items = readFileSync(join(store, "ledger.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const before = items.length;
  const file = join(out, "again.json");
  writeFileSync(file, JSON.stringify([{ key: items[0].key, class: "noise" }]));
  expect(main(["label", file, "--compare"])).toBe(0);
  expect(readFileSync(join(store, "ledger.jsonl"), "utf8").trim().split("\n").length).toBe(before);

  expect(main(["label", file])).toBe(0);
  const last = readFileSync(join(store, "ledger.jsonl"), "utf8").trim().split("\n").at(-1);
  expect(JSON.parse(last)).toMatchObject({ key: items[0].key, class: "noise", group: "D-x" });
});

test("an unknown class or key is refused and nothing is written", () => {
  const before = readFileSync(join(store, "ledger.jsonl"), "utf8");
  const file = join(out, "bad.json");
  writeFileSync(file, JSON.stringify([{ key: "nope", class: "serious" }]));
  expect(main(["label", file])).toBe(1);
  expect(readFileSync(join(store, "ledger.jsonl"), "utf8")).toBe(before);
});

test("groups merges blocks into the store", () => {
  const update = join(out, "update.md");
  writeFileSync(update, "### D-x\n- класс: defect\n");
  expect(main(["groups", update])).toBe(0);
  writeFileSync(update, "### D-x\n- класс: small\n");
  expect(main(["groups", update])).toBe(0);
  const groups = readFileSync(join(store, "groups.md"), "utf8");
  expect(groups).toContain("- класс: small");
  expect(groups).not.toContain("- класс: defect");
});

test("work writes findings.md from the store, with its own absolute path in the command", () => {
  const update = join(out, "update.md");
  writeFileSync(update, "### D-real\n- класс: defect · тяжесть: средняя · статус: stands\n- что: breaks\n- где: src/a/b.ts:1\n");
  expect(main(["groups", update])).toBe(0);
  expect(main(["work", "--out", out])).toBe(0);
  const text = readFileSync(join(out, "findings.md"), "utf8");
  const path = join(out, "findings.md").replaceAll("\\", "/");
  expect(text).toContain(`\`/fsloop исправить находки аудита — ${path}\``);
  expect(text).toContain("### D-real · средняя");
  expect(main(["work", "--groups", "nope", "--out", out])).toBe(1);
});

test("an audit folder with a finished report is not reused", () => {
  const dated = join(repo, "folders");
  mkdirSync(join(dated, "2026-11-03"), { recursive: true });
  expect(auditFolder(dated, "2026-11-03")).toBe(join(dated, "2026-11-03"));
  writeFileSync(join(dated, "2026-11-03", "report.md"), "done");
  expect(auditFolder(dated, "2026-11-03")).toBe(join(dated, "2026-11-03-2"));
});

test("a command with no file or a bad flag fails with usage", () => {
  expect(main(["label"])).toBe(1);
  expect(main(["groups"])).toBe(1);
  expect(main(["funnel", "--runs"])).toBe(1);
  expect(main(["nothing"])).toBe(1);
});
