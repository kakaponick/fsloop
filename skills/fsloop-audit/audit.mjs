import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { usageLimitStop } from "../fsloop/fsl.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = process.env.FSLOOP_AUDIT_REPO ?? resolve(HERE, "..", "..", "..");
const RUNS_DIR = join(REPO, ".claude", "fsloop", "runs");
const STORE = join(REPO, ".claude", "fsloop", "audit");
const LEDGER = join(STORE, "ledger.jsonl");
const GROUPS = join(STORE, "groups.md");
const SEVERITIES = ["critical", "major", "minor", "none"];
const DECISIONS = ["fix", "candidate", "dropped", "declined", "duplicate", "open", "undecided"];
const CLASSES = ["defect", "small", "imp+", "imp", "product", "noise", "unclear"];
const IDLE_GAP_MS = 2 * 60000;
const START_PAD_MS = 3 * 60000;
const LIVE_MS = 30 * 60000;
const HOUR = 3.6e6;

const SECTION = /^\s*[*#`_ >]*(LENS|AUDIT|VERDICT|JUDGED|FINDINGS(?: \(ranked\))?|UNVERIFIED|ASSUMPTIONS|ORDER|SHAPE|CONVENTIONS|NOTES|COMMANDS|OPEN|STATUS|ANSWERED|FACT|RED|GREEN|FILES|BLOCKED|DONE|SUMMARY|RESULT|FRAMES|EVIDENCE)\b[^:\n]{0,30}[*`_ ]*:/;
const HEADER = /^\s*[*#`_ >]*CANDIDATES\b[^:\n]*?[*`_ ]*:(.*)$/;
const EMPTY = /^[—–-]+\.?$|^none\.?$|^нет\.?$/i;
const BULLET = /^(?:[-*•]|\d+[.)])\s+(.*)$/;

export function candidateLines(text) {
  const lines = text.split(/\r?\n/);
  const found = [];
  const anomalies = [];
  lines.forEach((line, at) => {
    const header = HEADER.exec(line);
    if (!header) return;
    const items = [];
    let afterBlank = false;
    const first = header[1].replace(/^[*`_ ]+/, "").trim();
    if (first && !EMPTY.test(first)) items.push(first);
    for (let i = at + 1; i < lines.length; i++) {
      const current = lines[i];
      const trimmed = current.trim();
      if (SECTION.test(current) || HEADER.test(current) || trimmed.startsWith("```")) break;
      if (!trimmed) {
        afterBlank = true;
        continue;
      }
      const bullet = BULLET.exec(trimmed);
      if (!bullet && afterBlank && items.length) break;
      afterBlank = false;
      const body = (bullet ? bullet[1] : trimmed).trim();
      if (!body || EMPTY.test(body)) continue;
      if (bullet) items.push(body);
      else if (items.length) items[items.length - 1] += ` ${body}`;
      else {
        items.push(body);
        anomalies.push({ line: i + 1, text: body.slice(0, 160) });
      }
    }
    found.push(...items);
  });
  return { lines: found, anomalies };
}

export function lensOf(file, text) {
  const declared = (/^\s*[*#`_ ]*LENS[*`_ ]*:\s*(.+)$/m.exec(text)?.[1] ?? "").replace(/[*`]/g, "").trim().toLowerCase();
  const name = file.toLowerCase();
  if (/craft verdict/.test(declared)) return "craft-verdict";
  if (/code verdict/.test(declared)) return "code-verdict";
  for (const lens of ["craft", "code", "runtime", "shape", "design"]) if (declared.startsWith(lens)) return lens;
  if (/craft.*verdict/.test(name)) return "craft-verdict";
  if (/code-?verdict/.test(name)) return "code-verdict";
  if (/critic-code/.test(name)) return "code";
  if (/critic-runtime/.test(name)) return "runtime";
  if (/critic-craft|-craft-/.test(name)) return "craft";
  if (/design/.test(name)) return "design";
  if (/shape/.test(name)) return "shape";
  return "other";
}

const digest = (text) => createHash("sha1").update(text).digest("hex").slice(0, 12);

export function keyer() {
  const seen = new Map();
  return (run, launch, raw) => {
    const base = digest(`${run}|${launch}|${raw}`);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n ? `${base}~${n}` : base;
  };
}

export function classify(raw) {
  const cmd = raw ?? "";
  if (/s=\$\(date \+%s\)/.test(cmd)) {
    for (const [pattern, name] of [[/verify\.log/, "verify"], [/land\.log/, "land"], [/lanes\.log|lanes-/, "lanes"], [/integrate-|push\.log|integrate/, "integrate"], [/suite/, "suite"], [/baseline|final|shot/, "shots"]])
      if (pattern.test(cmd)) return `list:${name}`;
    return "list:other";
  }
  const table = [
    [/\b(test:pg|bun test|bun x vitest|vitest|bun run test)\b/, "test"],
    [/type-check|\btsc\b|tsgo/, "type-check"],
    [/\blint\b|eslint/, "lint"],
    [/\bbun run build\b|vite build/, "build"],
    [/shot\.mjs|shot\.ts|\bshot\b|screenshot|puppeteer|playwright/, "screenshot"],
    [/impeccable/, "impeccable"],
    [/git .*(rebase|merge|push|pull|commit|worktree|fetch|apply|checkout|branch)/, "git-write"],
    [/\bgit\b/, "git-read"],
    [/bun install|npm install|pnpm install/, "install"],
    [/fsl\.mjs/, "fsl.mjs"],
    [/spike-lease/, "spike-lease"],
    [/docker|db:up|db:migrate|db:generate|drizzle|psql|createdb/, "db/docker"],
    [/\bsleep\b|until |while /, "poll/sleep"],
    [/^\s*(cd [^;&]+(&&|;)\s*)?(ls|cat|head|tail|wc|grep|rg|find|sed|awk|echo|pwd|test|stat|du|printf|sort)\b/, "shell-read"],
    [/\bbun\b|\bnode\b/, "script"],
    [/\bcurl\b|ssh /, "net"],
  ];
  return table.find(([pattern]) => pattern.test(cmd))?.[1] ?? "other";
}

const IMPLEMENT_ROLES = new Set(["fsloop-implement", "fsloop-debug"]);
const REVIEW_ROLES = new Set(["fsloop-critic", "turnkey-critic", "cold-read", "general-purpose", "fork"]);
const RESEARCH_ROLES = new Set(["Explore", "spike-researcher", "fsloop-shots", "shots-proof"]);

export function budgetLabel(active) {
  const lanes = new Set(active.filter((v) => IMPLEMENT_ROLES.has(v.role)).map((v) => v.agent)).size;
  if (lanes) return `implement, ${lanes >= 3 ? "3+" : lanes} lane${lanes > 1 ? "s" : ""}`;
  const subagents = active.filter((v) => v.agent !== "main");
  if (subagents.some((v) => REVIEW_ROLES.has(v.role))) return "review, no implement";
  if (subagents.some((v) => RESEARCH_ROLES.has(v.role))) return "research";
  if (subagents.length) return "other agents";
  return active.some((v) => v.cat.startsWith("gen:")) ? "orchestrator generating alone" : "orchestrator alone in tools";
}

export function sweep(intervals, from, to) {
  const points = [];
  intervals.forEach((v, i) => {
    const s = Math.max(v.s, from);
    const e = Math.min(v.e, to);
    if (e > s) points.push({ t: s, d: 1, i }, { t: e, d: -1, i });
  });
  points.sort((a, b) => a.t - b.t || a.d - b.d);
  const active = new Set();
  const share = {};
  const concurrency = {};
  const budget = {};
  const gaps = [];
  let busy = 0;
  let last = from;
  for (const p of points) {
    const dt = p.t - last;
    if (dt > 0) {
      if (active.size) {
        busy += dt;
        const running = [...active].map((i) => intervals[i]);
        for (const v of running) share[v.cat] = (share[v.cat] ?? 0) + dt / running.length;
        const agents = new Set(running.map((v) => v.agent)).size;
        concurrency[agents] = (concurrency[agents] ?? 0) + dt;
        const label = budgetLabel(running);
        budget[label] = (budget[label] ?? 0) + dt;
      } else gaps.push({ s: last, e: p.t });
    }
    if (p.d > 0) active.add(p.i);
    else active.delete(p.i);
    last = p.t;
  }
  if (to > last) gaps.push({ s: last, e: to });
  return { busy, share, concurrency, budget, gaps };
}

export function stageWindows(stages, from, to) {
  const green = stages.filter((s) => s.green && s.at).map((s) => ({ stage: s.stage, end: Date.parse(s.at) })).sort((a, b) => a.end - b.end);
  const windows = [];
  let start = from;
  for (const { stage, end } of green) {
    windows.push({ stage, start, end, open: false });
    start = end;
  }
  const done = new Set(green.map((s) => s.stage));
  const current = stages.filter((s) => !done.has(s.stage)).at(-1);
  if (current && to > start) windows.push({ stage: current.stage, start, end: to, open: true });
  return windows;
}

export function kappa(pairs) {
  if (!pairs.length) return { n: 0, agree: 0, kappa: null };
  const agree = pairs.filter(([a, b]) => a === b).length;
  const count = (k) => {
    const m = {};
    for (const p of pairs) m[p[k]] = (m[p[k]] ?? 0) + 1;
    return m;
  };
  const left = count(0);
  const right = count(1);
  const n = pairs.length;
  const expected = Object.keys(left).reduce((s, c) => s + (left[c] / n) * ((right[c] ?? 0) / n), 0);
  const observed = agree / n;
  return { n, agree, kappa: expected === 1 ? 1 : (observed - expected) / (1 - expected) };
}

function loadRun(id) {
  const dir = join(RUNS_DIR, id);
  const path = join(dir, "run.json");
  return existsSync(path) ? { dir, ...JSON.parse(readFileSync(path, "utf8")), id } : null;
}

function loadRuns(wanted) {
  const ids = existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR) : [];
  const missing = ids.filter((id) => !existsSync(join(RUNS_DIR, id, "run.json")));
  const unknown = (wanted ?? []).filter((id) => !ids.includes(id));
  const runs = ids
    .filter((id) => !wanted || wanted.includes(id))
    .map(loadRun)
    .filter(Boolean)
    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  return { runs, missing, unknown };
}

const reportsOf = (run) => {
  const dir = join(run.dir, "reports");
  return existsSync(dir) ? readdirSync(dir).sort().map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") })) : [];
};

function git(args) {
  return execFileSync("git", ["-C", REPO, ...args], { encoding: "utf8", maxBuffer: 1 << 29 });
}

function markdown(headers, rows) {
  return [`| ${headers.join(" | ")} |`, `|${headers.map(() => " --- ").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

const hours = (ms) => (ms / HOUR).toFixed(2);
const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

export function stateOf(run, lastActivity = 0, now = Date.now()) {
  if (run.closed) return run.outcome?.pushed ? "closed, pushed" : "closed, not pushed";
  if ((run.stages ?? []).some((s) => s.stage === "init" && s.green)) return "closed, init";
  return now - lastActivity < LIVE_MS ? "running" : "open, idle";
}

const sessionsOf = (run) => [run.sessions ?? run.orchestrator?.sessions ?? []].flat().filter(Boolean);

function transcriptPaths(sessions) {
  const projects = join(homedir(), ".claude", "projects");
  if (!existsSync(projects)) return [];
  const found = [];
  for (const session of sessions) for (const project of readdirSync(projects)) {
    const main = join(projects, project, `${session}.jsonl`);
    if (!existsSync(main)) continue;
    found.push({ path: main, session, agent: "main", role: "orchestrator" });
    const dir = join(projects, project, session, "subagents");
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".jsonl")) continue;
      let meta = {};
      try {
        meta = JSON.parse(readFileSync(join(dir, file.replace(/\.jsonl$/, ".meta.json")), "utf8"));
      } catch {
        meta = {};
      }
      found.push({ path: join(dir, file), session, agent: file.replace(/\.jsonl$/, "").replace(/^agent-/, ""), role: meta.agentType ?? "?" });
    }
  }
  return found;
}

const lastActivityOf = (run) => Math.max(0, ...transcriptPaths(sessionsOf(run)).map((t) => statSync(t.path).mtimeMs));

function cmdRuns({ runs, missing }, out) {
  const rows = runs.map((run) => {
    const reports = reportsOf(run);
    const launches = run.launches ?? [];
    const red = (run.stages ?? []).reduce((n, s) => n + (s.attempts ?? []).filter((a) => !a.green).length, 0);
    const lastActivity = run.closed ? 0 : lastActivityOf(run);
    return {
      run: run.id,
      started: run.startedAt,
      updated: run.updatedAt,
      state: stateOf(run, lastActivity),
      lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
      goalMet: run.outcome?.goalMet ?? null,
      mode: run.mode,
      N: run.N ?? null,
      K: run.K ?? null,
      launches: launches.length,
      reports: reports.length,
      reportMissing: launches.filter((l) => l.reportMissing).length,
      unparsed: launches.reduce((n, l) => n + (l.unparsed?.length ?? 0), 0),
      findings: (run.findings ?? []).length,
      redGates: red,
    };
  });
  const known = new Set(readdirSync(RUNS_DIR));
  const trailers = git(["log", "origin/main", "--no-merges", "--format=%(trailers:key=Fsloop-Run,valueonly,separator=%x2C)"]);
  const orphans = [...new Set(trailers.split(/\r?\n/).flatMap((l) => l.split(",")).map((s) => s.trim()).filter(Boolean))].filter((id) => !known.has(id));
  const sha = git(["rev-parse", "origin/main"]).trim();
  const snapshot = { at: new Date().toISOString(), originMain: sha, folder: out, rows, orphans, withoutRunJson: missing };
  writeFileSync(join(out, "runs.json"), JSON.stringify(snapshot, null, 1));
  console.log(`audit folder ${out}`);
  console.log(`snapshot ${snapshot.at} · origin/main ${sha}`);
  console.log(markdown(["run", "started", "state", "goal met", "mode", "N", "K", "launches", "reports", "missing", "unparsed", "findings", "red gates"], rows.map((r) => [r.run, r.started, r.state, r.goalMet ?? "—", r.mode, r.N ?? "—", r.K ?? "—", r.launches, r.reports, r.reportMissing, r.unparsed, r.findings, r.redGates])));
  if (orphans.length) console.log(`trailers with no run folder: ${orphans.join(", ")}`);
  if (missing.length) console.log(`folders with no run.json: ${missing.join(", ")}`);
}

export function candidateItems(runs) {
  const key = keyer();
  const items = [];
  const anomalies = [];
  for (const run of runs) {
    for (const { file, text } of reportsOf(run)) {
      const launch = file.replace(/\.md$/, "");
      const parsed = candidateLines(text);
      for (const a of parsed.anomalies) anomalies.push({ run: run.id, launch, ...a });
      for (const raw of parsed.lines) items.push({ key: key(run.id, launch, raw), kind: "line", run: run.id, launch, lens: lensOf(file, text), raw });
    }
    for (const f of run.findings ?? []) {
      if (f.decision !== "candidate") continue;
      const raw = f.raw ?? `${f.rule ?? ""} — ${f.action ?? ""}`;
      items.push({ key: key(run.id, f.id, raw), kind: "finding", run: run.id, launch: f.launch ?? f.id, lens: lensOf(`${f.launch ?? ""}.md`, ""), severity: f.severity ?? null, finding: f.id, why: f.why ?? null, raw });
    }
  }
  return { items, anomalies };
}

export function readLedger(path = LEDGER) {
  const ledger = new Map();
  if (!existsSync(path)) return ledger;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) if (line.trim()) {
    const record = JSON.parse(line);
    ledger.set(record.key, record);
  }
  return ledger;
}

function classTable(items, ledger, by) {
  const rows = new Map();
  for (const item of items) {
    const row = rows.get(item[by]) ?? rows.set(item[by], { total: 0, unlabeled: 0, ...Object.fromEntries(CLASSES.map((c) => [c, 0])) }).get(item[by]);
    row.total++;
    const label = ledger.get(item.key)?.class;
    if (label) row[label]++;
    else row.unlabeled++;
  }
  return markdown([by, "total", ...CLASSES, "unlabeled"], [...rows].map(([name, r]) => [name, r.total, ...CLASSES.map((c) => r[c]), r.unlabeled]));
}

function cmdLines({ runs }, out, options) {
  const { items, anomalies } = candidateItems(runs);
  const ledger = readLedger();
  const unlabeled = items.filter((i) => !ledger.has(i.key));
  writeFileSync(join(out, "unlabeled.json"), JSON.stringify(unlabeled, null, 1));
  if (options.recheck) {
    const seed = new Date().toISOString().slice(0, 10);
    const pool = items.filter((i) => ledger.has(i.key)).sort((a, b) => digest(`${seed}${a.key}`).localeCompare(digest(`${seed}${b.key}`)));
    writeFileSync(join(out, "recheck.json"), JSON.stringify(pool.slice(0, Number(options.recheck)), null, 1));
  }
  const lines = items.filter((i) => i.kind === "line");
  const findings = items.filter((i) => i.kind === "finding");
  writeFileSync(join(out, "classes.md"), [`# CANDIDATES lines: ${lines.length}`, classTable(lines, ledger, "run"), classTable(lines, ledger, "lens"), `# Findings decided candidate: ${findings.length}`, classTable(findings, ledger, "run"), classTable(findings, ledger, "lens")].join("\n\n"));
  console.log(`lines ${lines.length} · findings decided candidate ${findings.length} · labeled ${items.length - unlabeled.length} · unlabeled ${unlabeled.length} · parse anomalies ${anomalies.length}`);
  for (const a of anomalies) console.log(`anomaly ${a.run}/${a.launch}:${a.line} ${a.text}`);
  console.log(markdown(["run", "lines", "findings", "unlabeled"], runs.map((r) => [r.id, lines.filter((i) => i.run === r.id).length, findings.filter((i) => i.run === r.id).length, unlabeled.filter((i) => i.run === r.id).length])));
}

function cmdLabel({ runs }, options) {
  const labels = JSON.parse(readFileSync(options.positional[0], "utf8"));
  const { items } = candidateItems(runs);
  const byKey = new Map(items.map((i) => [i.key, i]));
  const problems = labels.flatMap((l) => [!byKey.has(l.key) && `${l.key}: no such item`, !CLASSES.includes(l.class) && `${l.key}: class "${l.class}" is not one of ${CLASSES.join(", ")}`].filter(Boolean));
  if (problems.length) {
    console.error(problems.join("\n"));
    return 1;
  }
  const ledger = readLedger();
  if (options.compare) {
    const pairs = labels.filter((l) => ledger.has(l.key)).map((l) => [l.class, ledger.get(l.key).class]);
    const { n, agree, kappa: k } = kappa(pairs);
    console.log(`compared ${n} · agree ${agree} (${n ? ((100 * agree) / n).toFixed(1) : 0}%) · kappa ${k?.toFixed(2) ?? "—"}`);
    for (const l of labels.filter((x) => ledger.has(x.key) && ledger.get(x.key).class !== x.class && (x.class === "defect" || ledger.get(x.key).class === "defect"))) console.log(`defect disagreement ${l.key}: now ${l.class}, ledger ${ledger.get(l.key).class}`);
    return 0;
  }
  mkdirSync(STORE, { recursive: true });
  for (const l of labels) appendFileSync(LEDGER, `${JSON.stringify({ ...byKey.get(l.key), class: l.class, group: l.group ?? ledger.get(l.key)?.group ?? null, at: new Date().toISOString() })}\n`);
  console.log(`labeled ${labels.length} → ${LEDGER}`);
  return 0;
}

export function mergeGroups(current, update) {
  const split = (text) => text.split(/^(?=#{1,3} )/m).filter(Boolean);
  const idOf = (block) => /^### (\S+)/.exec(block)?.[1];
  const ensureEnd = (block) => (block.endsWith("\n") ? block : `${block}\n`);
  const incoming = new Map(split(update).filter(idOf).map((b) => [idOf(b), ensureEnd(b)]));
  const total = incoming.size;
  const merged = split(current).map((b) => {
    const next = incoming.get(idOf(b));
    if (!next) return b;
    incoming.delete(idOf(b));
    return next;
  });
  const text = [...merged.map(ensureEnd), ...incoming.values()].join("");
  return { text, added: incoming.size, replaced: total - incoming.size };
}

export function parseGroups(text) {
  return text
    .split(/^(?=### )/m)
    .filter((b) => b.startsWith("### "))
    .map((block) => {
      const lines = block.split(/^(?=#{1,2} )/m)[0].split(/\r?\n/);
      const fields = {};
      for (const line of lines.slice(1)) {
        const field = /^- ([^:]+):\s*(.*)$/.exec(line);
        if (field) fields[field[1].trim()] = field[2].trim();
      }
      const parts = (fields["класс"] ?? "").split(" · ");
      const part = (name) => parts.find((p) => p.startsWith(`${name}:`))?.slice(name.length + 1).trim() ?? null;
      return { id: lines[0].slice(4).trim(), class: parts[0] ?? null, severity: part("тяжесть"), status: part("статус"), what: fields["что"] ?? null, where: fields["где"] ?? null, should: fields["должно"] ?? null, question: fields["вопрос"] ?? null, rule: fields["правило"] ?? null };
    });
}

const SEVERITY_ORDER = ["критическая", "высокая", "средняя", "низкая"];
const severityRank = (group) => {
  const rank = SEVERITY_ORDER.indexOf(group.severity);
  return rank < 0 ? SEVERITY_ORDER.length : rank;
};

export function selectWork(groups, { classes = ["defect"], only = null } = {}) {
  const stands = (g) => g.status === "stands";
  const taken = groups.filter((g) => stands(g) && (only ? only.includes(g.id) : classes.includes(g.class))).sort((a, b) => severityRank(a) - severityRank(b));
  const takenIds = new Set(taken.map((g) => g.id));
  const questions = [...groups.filter((g) => g.class === "product" && (stands(g) || g.status === "open") && !takenIds.has(g.id)).map((g) => ({ id: g.id, text: g.what })), ...taken.filter((g) => g.question).map((g) => ({ id: g.id, text: g.question }))];
  const left = groups.filter((g) => stands(g) && !takenIds.has(g.id) && ["defect", "imp+"].includes(g.class)).sort((a, b) => severityRank(a) - severityRank(b));
  return { taken, questions, left };
}

export function renderWork({ taken, questions, left }, { path, sha, date }) {
  const finding = (g) => [`### ${g.id}${g.severity ? ` · ${g.severity}` : ""}`, `- Что ломается: ${g.what ?? "—"}`, `- Где: ${g.where ?? "—"}`, ...(g.should ? [`- Должно: ${g.should}`] : []), ...(g.rule && g.rule !== "нет" ? [`- Правило: ${g.rule}`] : []), ""].join("\n");
  return [
    `# Находки аудита fsloop · ${date}`,
    "",
    `Отправить в работу: \`/fsloop исправить находки аудита — ${path}\``,
    "",
    `Код проверен на \`origin/main\` \`${sha}\`. В работе: ${taken.length}, вопросов: ${questions.length}, не в работе: ${left.length}. Подробности каждой находки: \`.claude/fsloop/audit/groups.md\`.`,
    "",
    "## Как прогону читать этот файл",
    "",
    "- Цель прогона — закрыть каждую находку раздела «В работу». Находка закрыта тестом, который краснеет на ней и зеленеет после правки, там где у неё есть шов.",
    "- Сначала сверь каждую находку с кодом базы прогона. Если она уже не стоит, это строка журнала с причиной, без юнита.",
    "- Вопрос с заполненным «Ответом» — settled decision. Работа, зависящая от вопроса без ответа, остаётся вне прогона и идёт в отчёт как open.",
    "- Раздел «Не в работу» прогон не строит.",
    "",
    "Перед отправкой файл можно править: удалить блок находки, перенести пункт в «В работу», вписать ответ.",
    "",
    "## В работу",
    "",
    ...(taken.length ? taken.map(finding) : ["Находок нет.", ""]),
    "## Вопросы владельца",
    "",
    ...(questions.length ? questions.flatMap((q) => [`### ${q.id}`, `- Вопрос: ${q.text ?? "—"}`, "- Ответ: —", ""]) : ["Вопросов нет.", ""]),
    "## Не в работу",
    "",
    ...(left.length ? left.map((g) => `- \`${g.id}\`${g.severity ? ` · ${g.severity}` : ""}: ${g.what ?? "—"}${g.where ? ` (${g.where})` : ""}`) : ["Пусто."]),
    "",
  ].join("\n");
}

function shaFor(out) {
  const runs = join(out, "runs.json");
  if (existsSync(runs)) return JSON.parse(readFileSync(runs, "utf8")).originMain;
  try {
    return git(["rev-parse", "origin/main"]).trim();
  } catch {
    return null;
  }
}

export const pathsIn = (where) => [...new Set((where ?? "").match(/[\w@.-]+(?:\/[\w@.-]+)+\.\w+/g) ?? [])];

function cmdWork(options, out) {
  if (!existsSync(GROUPS)) {
    console.error(`no ${GROUPS}: run the findings track first`);
    return 1;
  }
  const groups = parseGroups(readFileSync(GROUPS, "utf8"));
  const unknown = (options.groups ?? []).filter((id) => !groups.some((g) => g.id === id));
  if (unknown.length) {
    console.error(`no such group: ${unknown.join(", ")}`);
    return 1;
  }
  const work = selectWork(groups, { classes: options.classes ?? ["defect"], only: options.groups ?? null });
  const sha = shaFor(out);
  const path = join(resolve(out), "findings.md").replaceAll("\\", "/");
  writeFileSync(path, renderWork(work, { path, sha: sha?.slice(0, 7) ?? "неизвестно", date: today() }));
  const gone = sha
    ? work.taken.flatMap((g) =>
        pathsIn(g.where).filter((p) => {
          try {
            git(["cat-file", "-e", `${sha}:${p}`]);
            return false;
          } catch {
            return true;
          }
        }).map((p) => `${g.id}: ${p}`),
      )
    : [];
  console.log(`findings ${path}`);
  console.log(`в работе ${work.taken.length} · вопросов ${work.questions.length} · не в работе ${work.left.length} · путей не найдено на ${sha?.slice(0, 7) ?? "?"}: ${gone.length}`);
  for (const line of gone) console.log(`missing ${line}`);
  console.log(`/fsloop исправить находки аудита — ${path}`);
  return 0;
}

function cmdGroups(options) {
  const current = existsSync(GROUPS) ? readFileSync(GROUPS, "utf8") : "# Группы строк CANDIDATES\n\n";
  const { text, added, replaced } = mergeGroups(current, readFileSync(options.positional[0], "utf8"));
  mkdirSync(STORE, { recursive: true });
  writeFileSync(GROUPS, text);
  console.log(`groups: replaced ${replaced}, added ${added} → ${GROUPS}`);
  return 0;
}

function cmdFunnel({ runs }, out) {
  const { items } = candidateItems(runs);
  const rows = runs.map((run) => {
    const cross = {};
    const stage = {};
    for (const f of run.findings ?? []) {
      const severity = f.severity ?? "none";
      const decision = f.decision ?? "undecided";
      (cross[severity] ??= {})[decision] = (cross[severity][decision] ?? 0) + 1;
      const step = String(f.stage).replace(/^p\d+-/, "");
      (stage[step] ??= {})[decision] = (stage[step][decision] ?? 0) + 1;
    }
    const totalOf = (severity) => Object.values(cross[severity] ?? {}).reduce((a, b) => a + b, 0);
    const decided = (decision) => SEVERITIES.reduce((n, s) => n + (cross[s]?.[decision] ?? 0), 0);
    return {
      run: run.id,
      findings: (run.findings ?? []).length,
      severity: Object.fromEntries(SEVERITIES.map((s) => [s, totalOf(s)])),
      decision: Object.fromEntries(DECISIONS.map((d) => [d, decided(d)])),
      fixMinor: cross.minor?.fix ?? 0,
      lines: items.filter((i) => i.kind === "line" && i.run === run.id).length,
      cross,
      stage,
    };
  });
  const rules = {};
  for (const run of runs) for (const f of run.findings ?? []) {
    if (f.decision !== "fix" || !f.rule) continue;
    const rule = f.rule.replace(/[`*]/g, "").trim().slice(0, 50);
    rules[rule] = (rules[rule] ?? 0) + 1;
  }
  const top = Object.entries(rules).sort((a, b) => b[1] - a[1]).slice(0, 15);
  writeFileSync(join(out, "funnel.json"), JSON.stringify({ rows, topRules: top }, null, 1));
  const sum = (pick) => rows.reduce((n, r) => n + pick(r), 0);
  const cells = (r) => [r.findings, ...SEVERITIES.map((s) => r.severity[s]), ...DECISIONS.map((d) => r.decision[d]), r.fixMinor, r.lines];
  const total = rows.length ? cells(rows[0]).map((_, i) => sum((r) => cells(r)[i])) : [];
  console.log(markdown(["run", "findings", ...SEVERITIES, ...DECISIONS, "fix∩minor", "CANDIDATES lines"], [...rows.map((r) => [r.run, ...cells(r)]), ["**total**", ...total]]));
}

const WAITS = new Set(["Agent", "Monitor", "mcp__t3-code__t3_background_wait", "TaskOutput", "AskUserQuestion"]);
const FILE_TOOLS = new Set(["Read", "Edit", "Write", "Grep", "Glob"]);

export function intervalsOf(jsonl, { agent, role }) {
  const requestStart = new Map();
  const requests = new Map();
  const open = new Map();
  const tools = [];
  const done = new Map();
  const limitStops = [];
  let lastUser = NaN;
  let first = NaN;
  for (const line of jsonl.split("\n")) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = e.timestamp ? Date.parse(e.timestamp) : NaN;
    if (Number.isNaN(first) && !Number.isNaN(ts)) first = ts;
    if (e.type === "api-request") {
      requestStart.set(e.id, ts);
      continue;
    }
    const note = e.type === "queue-operation" ? e.content : e.type === "attachment" ? e.attachment?.prompt : null;
    if (typeof note === "string" && note.includes("<task-notification>")) {
      const id = /<tool-use-id>([^<]+)/.exec(note)?.[1];
      if (id && !done.has(id)) done.set(id, ts);
      continue;
    }
    if (e.type === "user") {
      const content = e.message?.content;
      const blocks = Array.isArray(content) ? content : [];
      if (!blocks.some((b) => b?.type === "tool_result")) {
        const text = typeof content === "string" ? content : blocks.filter((b) => b?.type === "text").map((b) => b.text).join(" ");
        const id = /<tool-use-id>([^<]+)/.exec(text)?.[1];
        if (id && !done.has(id)) done.set(id, ts);
      }
      for (const b of blocks) {
        if (b?.type !== "tool_result") continue;
        const tool = open.get(b.tool_use_id);
        if (tool) {
          tool.e = ts;
          open.delete(b.tool_use_id);
        }
      }
      lastUser = ts;
      continue;
    }
    if (e.type !== "assistant" || !e.message) continue;
    const key = e.requestRef ?? e.message.id ?? e.uuid;
    let request = requests.get(key);
    if (!request) {
      request = { s: requestStart.get(e.requestRef) ?? lastUser, e: ts, cat: agent === "main" ? "gen:orchestrator" : `gen:${role}`, agent, role, output: 0, think: 0 };
      requests.set(key, request);
    }
    request.e = Math.max(request.e, ts);
    request.output = Math.max(request.output, e.message.usage?.output_tokens ?? 0);
    request.think = Math.max(request.think, e.message.usage?.output_tokens_details?.thinking_tokens ?? 0);
    for (const b of Array.isArray(e.message.content) ? e.message.content : []) {
      if (b?.type === "text" && usageLimitStop(b.text ?? "")) limitStops.push({ at: new Date(ts).toISOString(), agent, role });
      if (b?.type !== "tool_use" || WAITS.has(b.name)) continue;
      const shell = b.name === "Bash" || b.name === "PowerShell";
      const name = shell ? classify(String(b.input?.command ?? "")) : FILE_TOOLS.has(b.name) ? "file-tool" : b.name;
      const tool = { id: b.id, s: ts, e: NaN, name, background: Boolean(b.input?.run_in_background), agent, role };
      tools.push(tool);
      open.set(b.id, tool);
    }
  }
  const who = agent === "main" ? "orch" : "sub";
  const toolIntervals = tools
    .map((t) => {
      const end = t.background ? (done.get(t.id) ?? t.e) : t.e;
      const label = t.background && !t.name.startsWith("list:") ? `bg:${t.name}` : t.name;
      return { s: t.s, e: end, cat: `tool:${who}:${label}`, agent, role };
    })
    .filter((t) => t.e >= t.s);
  return { intervals: [...[...requests.values()].filter((r) => r.e >= r.s), ...toolIntervals], limitStops, first };
}

const REWORK = new Set(["review", "fix", "verdict", "assess", "integrate"]);

function speedOf(run) {
  const parsed = transcriptPaths(sessionsOf(run)).map((t) => intervalsOf(readFileSync(t.path, "utf8"), t));
  const intervals = parsed.flatMap((p) => p.intervals);
  const started = Date.parse(run.startedAt);
  const firstEvent = Math.min(...parsed.map((p) => p.first).filter((t) => !Number.isNaN(t)), started);
  const from = Math.max(started - START_PAD_MS, firstEvent);
  const stagesRaw = run.stages ?? [];
  const final = stagesRaw.find((s) => (s.stage === "finish" || s.stage === "init") && s.green)?.at;
  const to = final ? Date.parse(final) : Math.max(from, ...intervals.map((v) => v.e));
  const whole = sweep(intervals, from, to);
  const stages = stageWindows(stagesRaw, from, to).map((w) => {
    const part = sweep(intervals, w.start, w.end);
    return { stage: w.stage, open: w.open, clock: w.end - w.start, busy: part.busy, top: Object.entries(part.share).sort((a, b) => b[1] - a[1]).slice(0, 4) };
  });
  const stepOf = (stage) => stage.replace(/^p\d+-/, "");
  const build = stages.filter((s) => stepOf(s.stage) === "units").reduce((n, s) => n + s.busy, 0);
  const rework = stages.filter((s) => REWORK.has(stepOf(s.stage))).reduce((n, s) => n + s.busy, 0);
  const launches = (run.launches ?? []).map((l) => ({ ...l, s: Date.parse(l.startedAt), e: Date.parse(l.endedAt) })).filter((l) => l.e > l.s);
  const implement = launches.filter((l) => IMPLEMENT_ROLES.has(l.agent));
  const lanes = sweep(implement.map((l) => ({ s: l.s, e: l.e, cat: "implement", agent: l.id, role: l.agent })), from, to);
  const byRole = {};
  for (const l of launches) (byRole[l.agent] ??= []).push(l);
  const roles = Object.entries(byRole).map(([role, list]) => ({ role, launches: list.length, agentHours: list.reduce((n, l) => n + l.seconds, 0) / 3600, medianMin: quantile(list.map((l) => l.seconds), 0.5) / 60, p90Min: quantile(list.map((l) => l.seconds), 0.9) / 60 }));
  const generation = {};
  for (const v of intervals) {
    if (!v.cat.startsWith("gen:") || !(v.e > v.s) || v.s < from || v.s > to) continue;
    const g = (generation[v.role] ??= { requests: 0, output: 0, think: 0, ms: 0 });
    g.requests++;
    g.output += v.output;
    g.think += v.think;
    g.ms += v.e - v.s;
  }
  return {
    run: run.id,
    state: stateOf(run, run.closed ? 0 : lastActivityOf(run)),
    sessions: sessionsOf(run).length,
    transcripts: parsed.length,
    clock: to - from,
    active: whole.busy,
    idle: to - from - whole.busy,
    budget: Object.entries(whole.budget).sort((a, b) => b[1] - a[1]),
    gaps: whole.gaps.filter((g) => g.e - g.s > IDLE_GAP_MS).map((g) => ({ from: new Date(g.s).toISOString(), to: new Date(g.e).toISOString(), minutes: (g.e - g.s) / 60000 })),
    limitStops: parsed.flatMap((p) => p.limitStops).sort((a, b) => a.at.localeCompare(b.at)),
    share: Object.entries(whole.share).sort((a, b) => b[1] - a[1]),
    concurrency: whole.concurrency,
    stages,
    build,
    rework,
    lanes: { busy: lanes.busy, concurrency: lanes.concurrency, agentHours: implement.reduce((n, l) => n + l.seconds, 0) / 3600 },
    roles,
    generation,
  };
}

function cmdSpeed({ runs }, out) {
  const rows = runs.map(speedOf);
  writeFileSync(join(out, "speed.json"), JSON.stringify(rows, null, 1));
  console.log(markdown(["run", "state", "clock h", "active h", "idle h", "gaps > 2 min", "limit stops", "gen share", "units h", "rework h", "lane h", "implement agent-h"], rows.map((r) => [r.run, r.state, hours(r.clock), hours(r.active), hours(r.idle), r.gaps.length, r.limitStops.length, `${((100 * r.share.filter(([c]) => c.startsWith("gen:")).reduce((n, [, v]) => n + v, 0)) / Math.max(r.active, 1)).toFixed(1)}%`, hours(r.build), hours(r.rework), hours(r.lanes.busy), r.lanes.agentHours.toFixed(2)])));
  const total = (pick) => rows.reduce((n, r) => n + pick(r), 0);
  const budget = {};
  for (const r of rows) for (const [label, ms] of r.budget) budget[label] = (budget[label] ?? 0) + ms;
  console.log(`total clock ${hours(total((r) => r.clock))} h · active ${hours(total((r) => r.active))} h · idle ${hours(total((r) => r.idle))} h over ${rows.length} runs`);
  console.log(markdown(["active time", "h"], Object.entries(budget).sort((a, b) => b[1] - a[1]).map(([label, ms]) => [label, hours(ms)])));
}

export function parseFixLog(text) {
  const commits = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("\u0001")) {
      const [sha, at, subject, trailer] = line.slice(1).split("\u001f");
      current = { sha, at, subject, trailer: trailer?.trim() || null, files: [] };
      commits.push(current);
    } else if (current && line.trim()) current.files.push(line.trim());
  }
  return commits;
}

function cmdEscapes({ runs }, out) {
  const log = (extra) => parseFixLog(git(["log", "origin/main", "--no-merges", "--name-only", "--format=%x01%H%x1f%cI%x1f%s%x1f%(trailers:key=Fsloop-Run,valueonly,separator=%x2C)", ...extra]));
  const fixes = log(["-E", "--grep=^fix"]).filter((c) => /^fix(\(|:)/.test(c.subject));
  const rows = [];
  const perRun = [];
  for (const run of runs) {
    const own = log(["-F", `--grep=Fsloop-Run: ${run.id}`]);
    if (!own.length) continue;
    const files = new Set(own.flatMap((c) => c.files));
    const lastAt = own.map((c) => Date.parse(c.at)).reduce((a, b) => Math.max(a, b));
    const later = fixes.filter((c) => Date.parse(c.at) > lastAt && c.trailer !== run.id).map((c) => ({ sha: c.sha, at: c.at, subject: c.subject, trailer: c.trailer, overlap: c.files.filter((f) => files.has(f)) })).filter((c) => c.overlap.length);
    rows.push(...later.map((c) => ({ run: run.id, ...c })));
    perRun.push({ run: run.id, commits: own.length, files: files.size, laterFixes: later.length });
  }
  const baseline = runs.flatMap((run) => (run.findings ?? []).filter((f) => /-map$/.test(String(f.stage)) && ["critical", "major"].includes(f.severity)).map((f) => ({ run: run.id, id: f.id, severity: f.severity, rule: f.rule, location: f.location, action: f.action, decision: f.decision })));
  writeFileSync(join(out, "escapes.json"), JSON.stringify({ laterFixes: rows, baseline }, null, 1));
  console.log(markdown(["run", "commits", "files", "later fix commits on its files"], perRun.map((r) => [r.run, r.commits, r.files, r.laterFixes])));
  console.log(`distinct later fix commits ${new Set(rows.map((r) => r.sha)).size} · baseline critical/major findings ${baseline.length}`);
}

const USAGE = `node audit.mjs runs|funnel|lines|speed|escapes [--runs a,b] [--out dir]
node audit.mjs lines --recheck <n>   also writes <n> labeled items, labels hidden, to recheck.json
node audit.mjs label <labels.json> [--compare] [--runs a,b]   labels: [{key, class, group}]; --compare reports agreement and writes nothing
node audit.mjs groups <update.md>   merges "### id" blocks into groups.md
node audit.mjs work [--classes defect,imp+] [--groups a,b] [--out dir]   writes findings.md, the goal file for /fsloop`;

export function parseArgs(argv) {
  const options = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--runs", "--out", "--recheck", "--classes", "--groups"].includes(arg) && argv[i + 1] === undefined) return { error: `${arg} needs a value` };
    if (["--runs", "--classes", "--groups"].includes(arg)) options[arg.slice(2)] = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--out") options.out = argv[++i];
    else if (arg === "--recheck") options.recheck = argv[++i];
    else if (arg === "--compare") options.compare = true;
    else options.positional.push(arg);
  }
  return options;
}

function today() {
  return new Date().toLocaleDateString("sv");
}

export function auditFolder(store = STORE, date = today()) {
  let folder = join(store, date);
  for (let n = 2; existsSync(join(folder, "report.md")); n++) folder = join(store, `${date}-${n}`);
  return folder;
}

export function main(argv) {
  const [command, ...rest] = argv;
  const options = parseArgs(rest);
  const fail = (message) => {
    console.error(`${message}\n${USAGE}`);
    return 1;
  };
  if (options.error) return fail(options.error);
  if (["label", "groups"].includes(command) && !options.positional[0]) return fail(`${command} needs a file`);
  if (command === "groups") return cmdGroups(options);
  const out = options.out ?? auditFolder();
  if (["runs", "funnel", "lines", "speed", "escapes", "work"].includes(command)) mkdirSync(out, { recursive: true });
  if (command === "work") return cmdWork(options, out);
  const scope = loadRuns(options.runs);
  if (scope.unknown.length) return fail(`no such run: ${scope.unknown.join(", ")}`);
  switch (command) {
    case "runs":
      cmdRuns(scope, out);
      return 0;
    case "funnel":
      cmdFunnel(scope, out);
      return 0;
    case "lines":
      cmdLines(scope, out, options);
      return 0;
    case "label":
      return cmdLabel(scope, options);
    case "speed":
      cmdSpeed(scope, out);
      return 0;
    case "escapes":
      cmdEscapes(scope, out);
      return 0;
    default:
      return fail("unknown command");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
