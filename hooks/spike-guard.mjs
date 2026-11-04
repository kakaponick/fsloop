import { existsSync, lstatSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { commandSegments, verbOf } from "./shell-text.mjs";

const ROOT = String.raw`(?:\.claude[\\/]fsloop[\\/]spike|\.spike)`;
const SPIKE = new RegExp(String.raw`(^|[\\/])${ROOT}([\\/]|$)`, "i");
const SESSIONS = new RegExp(String.raw`(^|[\\/])${ROOT}[\\/]sessions([\\/]|$)`, "i");
const LEASE = new RegExp(String.raw`(^|[\\/])${ROOT}[\\/]sessions[\\/][^\\/]+[\\/]\.lease$`, "i");
const SPIKE_HOMES = [join(".claude", "fsloop", "spike"), ".spike"];
const atSpikeRoot = (p) => new RegExp(String.raw`(^|[\\/])${ROOT}$`, "i").test(p);
const LINK_VERBS = /^(ln|mklink)$/i;
const COPY_VERBS = /^(cp|copy|xcopy|robocopy|Copy-Item|rsync|mv|move|Move-Item)$/i;
const DELETE_VERBS = /^(rm|del|Remove-Item|unlink)$/i;
const LINK_ITEM = /^(Junction|SymbolicLink|HardLink)$/i;
const RECURSIVE_DELETE_VERBS = /^(rm|rmdir|Remove-Item|rd)$/i;
const RECURSIVE_FLAG = /^(-[a-z]*r[a-z]*|--recursive|-Recurse|\/s)$/i;

function isReparse(p) {
  try {
    if (lstatSync(p).isSymbolicLink()) return true;
    if (process.platform !== "win32") return false;
    const r = spawnSync("cmd", ["/c", "dir", "/AL", "/B", dirname(p)], { encoding: "utf8" });
    return r.status === 0 && r.stdout.split(/\r?\n/).includes(basename(p));
  } catch {
    return false;
  }
}

function mirrorOnDisk(p) {
  const homes = atSpikeRoot(p) ? [p] : SPIKE_HOMES.map((home) => join(p, home));
  return homes.some((spike) => {
    if (!existsSync(spike)) return false;
    try {
      return readdirSync(spike).some((name) => isReparse(join(spike, name)));
    } catch {
      return false;
    }
  });
}

function linksOnDisk(dir) {
  if (atSpikeRoot(dir) || !existsSync(dir)) return [];
  try {
    if (process.platform === "win32") {
      const r = spawnSync("cmd", ["/c", "dir", "/AL", "/B", dir], { encoding: "utf8" });
      return r.status === 0 ? r.stdout.split(/\r?\n/).filter(Boolean) : [];
    }
    return readdirSync(dir).filter((name) => lstatSync(join(dir, name)).isSymbolicLink());
  } catch {
    return [];
  }
}

function removalTargets({ verb, args }) {
  if (/^git$/i.test(verb)) {
    const at = args.indexOf("worktree");
    if (at < 0 || args[at + 1] !== "remove") return [];
    const c = args.indexOf("-C");
    const base = c >= 0 && c < at ? args[c + 1] : process.cwd();
    return args.slice(at + 2).filter((a) => !a.startsWith("-")).map((a) => resolve(winPath(base), winPath(a)));
  }
  if (RECURSIVE_DELETE_VERBS.test(verb) && args.some((a) => RECURSIVE_FLAG.test(a))) {
    return args.filter((a) => !a.startsWith("-") && !/^\/[sq]$/i.test(a)).map((a) => resolve(winPath(a)));
  }
  return [];
}

function copySources({ verb, args }) {
  const slashFlags = /^(xcopy|robocopy|copy|move)$/i.test(verb);
  const positional = [];
  let destinationNamed = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (/^(-Destination|-t|--target-directory)$/i.test(a)) {
      destinationNamed = true;
      i++;
      continue;
    }
    if (/^--target-directory=/i.test(a)) {
      destinationNamed = true;
      continue;
    }
    if (a.startsWith("-") || (slashFlags && /^\/[a-z]+(:.*)?$/i.test(a))) continue;
    positional.push(a);
  }
  return destinationNamed ? positional : positional.slice(0, -1);
}

function winPath(p) {
  const m = /^\/([a-z])(\/|$)/i.exec(p);
  return m && process.platform === "win32" ? `${m[1].toUpperCase()}:/${p.slice(m[0].length)}` : p;
}

const RULES = [
  {
    hit: (call, mirrorAt) => removalTargets(call).some((p) => mirrorAt(p)),
    why: "removing a checkout over a standing .claude/fsloop/spike mirror walks its junctions and empties the main one; run spike-lease.mjs unlink <checkout> first",
  },
  {
    hit: (call, _mirrorAt, linksAt) => {
      const found = removalTargets(call).flatMap((p) => linksAt(p).filter((n) => !/^\.spike$/i.test(n)).map((n) => join(p, n)));
      return found.length > 0 && found;
    },
    why: (found) =>
      `removing a checkout walks the junction ${found.join(", ")} and empties the real folder; take the link out first: cmd //c rmdir "<path>"`,
  },
  {
    hit: ({ verb, args }) =>
      (LINK_VERBS.test(verb) && args.some((a) => SPIKE.test(a))) ||
      (/^New-Item$/i.test(verb) && args.some((a) => LINK_ITEM.test(a)) && args.some((a) => SPIKE.test(a))),
    why: "a hand-made link into .claude/fsloop/spike bypasses the session lease; use ~/.claude/skills/fsloop/spike-lease.mjs link / acquire",
  },
  {
    hit: (call) => COPY_VERBS.test(call.verb) && copySources(call).some((a) => SESSIONS.test(a)),
    why: "copying or moving a session out of .claude/fsloop/spike/sessions makes a second usable copy; spike-lease.mjs acquire links it under a lease",
  },
  {
    hit: ({ verb, args }) => DELETE_VERBS.test(verb) && args.some((a) => LEASE.test(a)),
    why: "a lease is released with spike-lease, never deleted by hand",
  },
];

export function spikeViolation(command, { mirrorAt = mirrorOnDisk, linksAt = linksOnDisk } = {}) {
  const text = String(command ?? "");
  if (!text || /spike-lease\.mjs/.test(text)) return null;
  for (const tokens of commandSegments(text)) {
    const call = verbOf(tokens);
    for (const rule of RULES) {
      const found = rule.hit(call, mirrorAt, linksAt);
      if (found) return { why: typeof rule.why === "function" ? rule.why(found) : rule.why };
    }
  }
  return null;
}

if (import.meta.main) {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const hit = spikeViolation(payload?.tool_input?.command);
  if (!hit) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `Blocked by spike-guard: ${hit.why}.`,
      },
    }),
  );
}
