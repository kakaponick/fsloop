// fsloopUI's one write (rules/ui → Scope, Conventions 6): the user's verdict on a finding, one JSON line appended
// to the run's human.jsonl in the form fsl.mjs reads (SKILL.md → Run folder).
import { appendFileSync, closeSync, openSync, readSync, statSync } from "node:fs";
import { join } from "node:path";
import { HUMAN_VERDICTS } from "../../skills/fsloop/fsl.mjs";
import type { UserVerdict } from "../shared/model.ts";
import type { Verdict } from "../shared/states.ts";

export const isVerdict = (v: unknown): v is Verdict => typeof v === "string" && HUMAN_VERDICTS.includes(v);

/** Whether the file ends mid-line — a writer cut short — so the next line must start on its own. */
function endsMidLine(path: string): boolean {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    return false;
  }
  if (!size) return false;
  const fd = openSync(path, "r");
  try {
    const last = Buffer.alloc(1);
    readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } finally {
    closeSync(fd);
  }
}

/** Appends `{finding, verdict, note, at}`; earlier lines stay, the latest one is the finding's verdict. */
export function appendVerdict(runDir: string, { finding, verdict, note }: { finding: string; verdict: Verdict; note?: string | null }, at = new Date().toISOString()): UserVerdict {
  if (!isVerdict(verdict)) throw new Error(`unknown verdict ${String(verdict)}`);
  const path = join(runDir, "human.jsonl");
  const line = { finding, verdict, note: typeof note === "string" && note.trim() ? note.trim() : null, at };
  appendFileSync(path, `${endsMidLine(path) ? "\n" : ""}${JSON.stringify(line)}\n`);
  return { verdict, note: line.note, at };
}
