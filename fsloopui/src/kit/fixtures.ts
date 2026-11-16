// The kit's data, shaped after the real run folders (common.md → Map, production shape): 63 runs, a goal of
// 8 617 characters over 50 lines, a finding of 1 920 characters, a report file with a table, 8 and 19 frames.
import { livenessOf, type LivenessValue } from "../../shared/liveness.ts";

const NOW = "2026-11-16T07:00:00Z";

const PROJECTS = ["db.ren.net", "max-auto", "tga", "tgtrigger", "fsloop"];

export const RUNS: { key: string; project: string; id: string; liveness: LivenessValue }[] = Array.from({ length: 63 }, (_, i) => {
  const project = PROJECTS[i % PROJECTS.length];
  const id = ((0x9e3779b1 * (i + 1)) >>> 0).toString(16).padStart(8, "0").slice(0, 8);
  const minutesAgo = [1, 12, 47, 300, 9000][i % 5];
  const last = new Date(Date.parse(NOW) - minutesAgo * 60_000).toISOString();
  return { key: `${project}/${id}`, project, id, liveness: livenessOf(last, NOW, { closed: i > 9 }) };
});

const GOAL_LINE =
  "Довести интерфейс TGA до прод-версии: каждый экран читается без вопросов, таблицы держат объём production, состояния загрузки, ошибки и пустоты названы словами пользователя, а живые обновления не двигают то, что он читает";

/** 8 617 characters over 50 lines. */
export const GOAL = (() => {
  const lines: string[] = [];
  for (let n = 1; n <= 50; n++) lines.push(`${n} ${GOAL_LINE}`.slice(0, 171));
  const text = lines.join("\n");
  return text + "…".repeat(Math.max(0, 8617 - text.length));
})().slice(0, 8617);

/** A finding's rule and action as a critic writes them, 1 920 characters. */
export const FINDING_TEXT = (() => {
  const head = [
    "`launchErrorCause` passes the uncoded **lastError** through as is, so a failed launch reads «Error: spawn EPERM» in the cell.",
    "",
    "rules/ui → Conventions 14: a part that failed names what failed and why, in the user's words. Seen in u3 and in p1-review-critic-craft#craft-4:",
    "  - the cell shows the raw error text of the process;",
    "  - the toast repeats it without a cause or a next step;",
    "    and the status bar keeps «обновлено» from before the failure.",
    "",
    "1. Map the known codes (EPERM, EBUSY, ENOENT) to a sentence.",
    "2. Keep the raw text in the title for the operator.",
    "",
  ].join("\n");
  const filler = " The same holds on every surface that reads a launch's error: the rail, the reader and the unit row.";
  let text = head;
  while (text.length < 1920) text += filler;
  return text.slice(0, 1919) + ".";
})();

export const REPORT_TEXT = [
  "## RESULT",
  "done — the shell and its sidebar land; see u3.",
  "",
  "### Building blocks",
  "",
  "| need | candidate | path |",
  "|---|---|---|",
  "| Design tokens, light | `--f-bg #fbfbfa`, `--f-fg #1b1b1a`, `--f-muted #f0f0ed`, `--f-mfg #6d6d69`, `--f-border #e2e2dd` | template.html:8 |",
  "| Status dot | `.dot` 7px with `--tone`; pulse animation 1.6 s, off under reduced motion | template.html:18, 20, 60-62 |",
  "| Lightbox | `.lb` full-screen overlay, `img.th` thumbnails `.ths`, 74 px | template.html:103-106 |",
  "",
  "```",
  "cd fsloopui && npx vitest run src/ui",
  "```",
].join("\n");

/** Frames as neutral placeholders named like a run's shots: the kit has no run folder of its own. */
export function frames(n: number): { src: string; name: string }[] {
  return Array.from({ length: n }, (_, i) => {
    const name = `p1-final-${["shell", "findings", "units", "reports"][i % 4]}-${i + 1}.png`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1440' height='900' viewBox='0 0 1440 900'><rect width='1440' height='900' fill='%23f0f0ed'/><rect x='0' y='0' width='316' height='900' fill='%23e2e2dd'/><text x='720' y='470' font-family='system-ui' font-size='56' text-anchor='middle' fill='%236d6d69'>${name}</text></svg>`;
    return { src: `data:image/svg+xml;utf8,${svg}`, name };
  });
}
