import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";

const args = process.argv.slice(2).filter(Boolean);
const shotsAt = args.indexOf("--shots");
const shotsDir = shotsAt >= 0 ? args.splice(shotsAt, 2)[1] : null;
if (!args.length) {
  console.error("usage: node spend.mjs <session-id|session-dir> [...]");
  process.exit(1);
}

const projectsRoot = join(homedir(), ".claude", "projects");

function resolveSubagentDirs(arg) {
  const direct = [join(arg, "subagents"), arg];
  for (const d of direct) if (existsSync(d) && basename(d) === "subagents") return [d];
  if (existsSync(direct[0])) return [direct[0]];
  const hits = [];
  if (existsSync(projectsRoot)) {
    for (const project of readdirSync(projectsRoot)) {
      const d = join(projectsRoot, project, arg, "subagents");
      if (existsSync(d)) hits.push(d);
    }
  }
  return hits;
}

const SHOT_TOOL = /screenshot/i;
const SHOT_INPUT = /\b(?:bun|npm run|pnpm|yarn) shot\b(?!:)|shot\.ts|shot\.mjs shoot|puppeteer|playwright screenshot|\.screenshot\(/;

function collect(path) {
  const byId = new Map();
  let lastId = null;
  const tools = new Set();
  let steps = 0;
  let shots = 0;
  let images = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    const content = Array.isArray(e.message?.content) ? e.message.content : [];
    for (const block of content) {
      if (block?.type === "tool_result" && Array.isArray(block.content))
        images += block.content.filter((c) => c?.type === "image").length;
    }
    if (e.type !== "assistant" || !e.message) continue;
    for (const block of content) {
      if (block?.type !== "tool_use") continue;
      tools.add(block.id ?? `${e.uuid}:${tools.size}`);
      if (SHOT_TOOL.test(block.name ?? "") || SHOT_INPUT.test(JSON.stringify(block.input ?? {}))) shots += 1;
    }
    const u = e.message.usage;
    if (!u) continue;
    const id = e.message.id ?? `${e.uuid}`;
    const next = {
      input: u.input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
    };
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, next);
      steps += 1;
    } else {
      for (const k of Object.keys(next)) next[k] = Math.max(prev[k], next[k]);
      byId.set(id, next);
    }
    lastId = id;
  }
  const sum = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  for (const v of byId.values()) for (const k of Object.keys(sum)) sum[k] += v[k];
  const last = lastId ? byId.get(lastId) : null;
  const window = last ? last.input + last.output + last.cacheWrite + last.cacheRead : 0;
  return { ...sum, window, steps, tools: tools.size, shots, images };
}

const rows = [];
const orchestrators = [];
for (const arg of args) {
  for (const dir of resolveSubagentDirs(arg)) {
    const session = dirname(dir);
    const main = join(dirname(session), `${basename(session)}.jsonl`);
    if (existsSync(main)) orchestrators.push(collect(main));
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".jsonl")) continue;
      const path = join(dir, file);
      let meta = {};
      try {
        meta = JSON.parse(readFileSync(path.replace(/\.jsonl$/, ".meta.json"), "utf8"));
      } catch {}
      const t = collect(path);
      const label = (meta.description ?? "").trim();
      const round = label.match(/\br(\d+)\b/i);
      const unit = label.match(/\b[uf]\d+\b/i) ?? label.match(/^assess\b/i);
      rows.push({
        started: statSync(path).birthtimeMs || statSync(path).mtimeMs,
        unit: unit ? unit[0].toLowerCase() : "—",
        role: meta.agentType ?? "—",
        round: round ? round[1] : "—",
        label,
        steps: t.steps,
        shots: t.shots,
        images: t.images,
        output: t.output,
        input: t.input + t.cacheWrite + t.cacheRead,
        window: t.window,
      });
    }
  }
}

if (!rows.length) {
  console.error(`no subagent transcripts found for: ${args.join(", ")}`);
  process.exit(1);
}

rows.sort((a, b) => a.started - b.started);

const fmt = (n) =>
  n < 1000
    ? String(n)
    : n < 1_000_000
      ? `${(n / 1000).toFixed(n < 100_000 ? 1 : 0)}k`
      : `${(n / 1_000_000).toFixed(1)}M`;

const agents = (n) => {
  const tail = n % 100;
  const one = n % 10;
  const word =
    tail >= 11 && tail <= 14 ? "агентов" : one === 1 ? "агент" : one >= 2 && one <= 4 ? "агента" : "агентов";
  return `${n} ${word}`;
};

const SUMMED =["shots", "images", "input", "output", "window"];
const total = (list) => {
  const t = Object.fromEntries(SUMMED.map((k) => [k, 0]));
  for (const r of list) for (const k of SUMMED) t[k] += r[k];
  return t;
};

const units = [];
for (const r of rows) {
  let u = units.find((x) => x.unit === r.unit);
  if (!u) units.push((u = { unit: r.unit, rows: [] }));
  u.rows.push(r);
}

const out = [
  "| Юнит | Роль | Раунд | Шаги | Снимков | Просмотров | Контекст | Вывод | Прочитано с кэшем |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const u of units) {
  for (const r of u.rows)
    out.push(
      `| ${r.unit} | ${r.role} | ${r.round} | ${r.steps} | ${r.shots} | ${r.images} | ${fmt(r.window)} | ${fmt(r.output)} | ${fmt(r.input)} |`,
    );
  if (units.length > 1 && u.rows.length > 1) {
    const t = total(u.rows);
    out.push(
      `| **${u.unit}** | | | | **${t.shots}** | **${t.images}** | **${fmt(t.window)}** | **${fmt(t.output)}** | **${fmt(t.input)}** |`,
    );
  }
}

const grand = total(rows);
out.push(
  `| **Всего** | ${agents(rows.length)} | | | **${grand.shots}** | **${grand.images}** | **${fmt(grand.window)}** | **${fmt(grand.output)}** | **${fmt(grand.input)}** |`,
);
out.push("");
out.push(
  "Контекст — токены агента в панели агентов (контекст последнего шага), «Всего» — её Σ; Вывод — всё, что модель написала; Прочитано с кэшем — справка: каждый шаг перечитывает весь контекст заново.",
);

const byRole = new Map();
for (const r of rows) byRole.set(r.role, (byRole.get(r.role) ?? 0) + r.window);
const impl = (byRole.get("fsloop-implement") ?? 0) + (byRole.get("fsloop-debug") ?? 0);
const crit = byRole.get("fsloop-critic") ?? 0;
const costliest = [...byRole.entries()].sort((a, b) => b[1] - a[1])[0];

const ratio = impl ? `${(crit / impl).toFixed(2)} : 1` : "n/a";

if (shotsDir && existsSync(shotsDir)) {
  const byStage = new Map();
  for (const f of readdirSync(shotsDir)) {
    if (!f.endsWith(".png")) continue;
    const stage = f.match(/^(p\d+-(?:baseline|final)|baseline|review|assess-p\d+|[uf]\d+(?:-r\d+)?)/)?.[1] ?? "—";
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
  }
  out.push("", "| Этап | Файлов на диске |", "| --- | --- |");
  for (const [s, n] of byStage) out.push(`| ${s} | ${n} |`);
}

out.push(
  "",
  `**Расход:** ${agents(rows.length)}, ${fmt(grand.window)} токенов контекста — Σ панели агентов. Дороже всего ${costliest[0]}: ${fmt(costliest[1])}. Ревью к реализации — ${ratio} (ревью ${fmt(crit)}, реализация ${fmt(impl)}).`,
);
for (const o of orchestrators)
  out.push(
    `**Оркестратор** (вне панели агентов, вся сессия): ${o.steps} шагов, ${o.tools} вызовов, контекст ${fmt(o.window)}, вывод ${fmt(o.output)}, прочитано с кэшем ${fmt(o.input + o.cacheWrite + o.cacheRead)}.`,
  );

console.log(out.join("\n"));
