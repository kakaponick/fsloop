import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `usage: node find-polluter.mjs [--run '<command>'] [--skip <regex>]... <victim test file> [path prefix ...]
In the tree the cwd is in, finds the test file that, run before the victim in one process, turns it red.
--run   the runner's command for a list of files in one process, writing JUnit XML: {files} expands to the
        files, {junit} to the report path. Default with a bun lockfile:
        bun test {files} --reporter=junit --reporter-outfile={junit}
--skip  a candidate path matching it stays out unless named as a file (live, browser, database tests).
Candidates: the tracked test files under the prefixes (every one by default) without the victim.
Exit 0 no polluter · 1 polluter found · 2 the victim is red alone · 3 inconclusive · 4 usage`;
const MAX_COMMAND = { win32: 8_000, other: 30_000 };
const TEST_FILE = /([._-](test|spec)\.[cm]?[jt]sx?|(^|\/)test_[^/]*\.py|_test\.py)$/;
const BUN_RUN = "bun test {files} --reporter=junit --reporter-outfile={junit}";

function halves(set) {
  const half = Math.ceil(set.length / 2);
  return [set.slice(0, half), set.slice(half)];
}

async function redPart(set, isRed) {
  const red = await isRed(set);
  if (red === true) return set;
  if (red === false || set.length < 2) return null;
  const [first, second] = halves(set);
  return (await redPart(first, isRed)) ?? (await redPart(second, isRed));
}

export async function findPolluter(candidates, isRed) {
  let set = candidates;
  while (set.length > 1) {
    const [first, second] = halves(set);
    const next = (await redPart(first, isRed)) ?? (await redPart(second, isRed));
    if (!next) return { polluter: null, set };
    set = next;
  }
  return { polluter: set[0] ?? null, set };
}

function normalize(path) {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function attr(attrs, name) {
  return attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

// A case belongs to the victim when its file, its class name or its suite names the victim's path —
// as a path (bun, vitest, jest) or as a dotted module (pytest).
export function victimCases(xml, victim) {
  const module = victim.replace(/\.[^./]+$/, "").replaceAll("/", ".");
  const names = (value) => {
    const v = value ? normalize(value) : "";
    return v !== "" && (v.endsWith(victim) || v === module || v.endsWith(`.${module}`));
  };
  const cases = [];
  for (const [, suiteAttrs, suiteBody] of xml.matchAll(/<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g)) {
    const suiteNames = names(attr(suiteAttrs, "file")) || names(attr(suiteAttrs, "name"));
    for (const [, attrs, close, body] of suiteBody.matchAll(/<testcase\b([^>]*?)\s*(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      if (suiteNames || names(attr(attrs, "file")) || names(attr(attrs, "classname"))) {
        cases.push({ failed: close !== "/>" && /<(failure|error)\b/.test(body ?? "") });
      }
    }
  }
  return cases;
}

function quote(arg) {
  return /[\s"]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
}

export function command(template, files, junit) {
  return template
    .trim()
    .split(/\s+/)
    .flatMap((part) => (part === "{files}" ? files : [part.replaceAll("{junit}", junit)]));
}

export function commandFits(line, platform) {
  return line.length <= (platform === "win32" ? MAX_COMMAND.win32 : MAX_COMMAND.other);
}

export function refusedAsTooLong(output, error) {
  return /command line is too long/i.test(output) || ["E2BIG", "ENAMETOOLONG"].includes(error?.code);
}

function runner(root, template, victim, logs) {
  let step = 0;
  return (files) => {
    const [bin, ...args] = command(template, [...files, victim].map((file) => `./${file}`), "{junit}");
    const xml = join(logs, `${step + 1}.xml`);
    const argv = args.map((arg) => arg.replaceAll("{junit}", xml));
    const line = [bin, ...argv].map(quote).join(" ");
    if (!commandFits(line, process.platform)) {
      console.log(`- ${files.length} files + victim — too long for one command, split`);
      return null;
    }
    step += 1;
    const log = join(logs, `${step}.log`);
    const windows = process.platform === "win32";
    const run = spawnSync(windows ? line : bin, windows ? [] : argv, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 << 20,
      shell: windows,
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}${run.error ? `\n${run.error.message}` : ""}`;
    writeFileSync(log, output);
    if (refusedAsTooLong(output, run.error)) {
      console.log(`${step} ${files.length} files + victim — refused as too long, split — ${log}`);
      return null;
    }
    const cases = existsSync(xml) ? victimCases(readFileSync(xml, "utf8"), victim) : [];
    const red = cases.length === 0 || cases.some((result) => result.failed);
    console.log(`${step} ${files.length} files + victim — ${red ? "red" : "green"} — ${log}`);
    return red;
  };
}

function parseArgs(argv) {
  const skips = [];
  const rest = [];
  let run = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--run") run = argv[++i];
    else if (argv[i] === "--skip") skips.push(new RegExp(argv[++i]));
    else rest.push(argv[i]);
  }
  return { run, skips, victimArg: rest[0], prefixArgs: rest.slice(1) };
}

async function main() {
  const { run, skips, victimArg, prefixArgs } = parseArgs(process.argv.slice(2));
  if (!victimArg || victimArg.startsWith("-")) {
    console.error(USAGE);
    process.exit(4);
  }
  const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
  const template = run ?? (["bun.lock", "bun.lockb"].some((lock) => existsSync(join(root, lock))) ? BUN_RUN : null);
  if (!template) {
    console.error(`no --run and no bun lockfile in ${root}: pass the runner's command\n${USAGE}`);
    process.exit(4);
  }
  if (!template.includes("{files}") || !template.includes("{junit}")) {
    console.error(`--run needs {files} and {junit}\n${USAGE}`);
    process.exit(4);
  }
  const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 }).stdout.split("\0");
  const victim = normalize(victimArg);
  if (!tracked.includes(victim)) {
    console.error(`${victim}: not a tracked file of ${root}\n${USAGE}`);
    process.exit(4);
  }
  const prefixes = prefixArgs.map(normalize);
  const underPrefixes = (path) => prefixes.length === 0 || prefixes.some((prefix) => path.startsWith(prefix));
  const skipped = (path) => skips.some((skip) => skip.test(path));
  const candidates = tracked.filter(
    (path) => TEST_FILE.test(path) && path !== victim && (prefixes.includes(path) || (!skipped(path) && underPrefixes(path))),
  );
  const logs = mkdtempSync(join(tmpdir(), "find-polluter-"));
  console.log(`victim ${victim} · ${candidates.length} candidates · logs ${logs}`);
  const isRed = runner(root, template, victim, logs);

  if (isRed([])) {
    console.log(`BROKEN: ${victim} is red alone — not a polluter case; debug it alone`);
    process.exit(2);
  }
  if (candidates.length === 0 || isRed(candidates) === false) {
    console.log(
      `NO POLLUTER: ${victim} stays green after ${prefixes.length > 0 ? "the candidates under these prefixes in one process — widen them" : "every candidate in one process — look at concurrency or time"}`,
    );
    process.exit(0);
  }
  const { polluter, set } = await findPolluter(candidates, isRed);
  if (polluter) {
    console.log(`POLLUTER: ${polluter}\nLOOP: ${command(template, [`./${polluter}`, `./${victim}`], join(logs, "loop.xml")).join(" ")}`);
    process.exit(1);
  }
  console.log(`INCONCLUSIVE: neither half of ${set.length} files turns ${victim} red alone — two files together do, or none\nSET: ${set.join(" ")}`);
  process.exit(3);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
