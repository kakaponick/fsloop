// The run folders under the roots the server was given. A root is a run folder, a project (it holds
// .claude/fsloop/runs), or a folder of projects. Every run folder is listed — one without run.json too.
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

export interface FoundRun {
  /** Unique across the roots: `<project>/<run id>`. */
  key: string;
  /** The project folder's name; with its parent folder's name when two projects share it. */
  project: string;
  projectDir: string;
  id: string;
  dir: string;
}

const runsOf = (project: string) => join(project, ".claude", "fsloop", "runs");
const isDir = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const subdirs = (p: string) => {
  try {
    return readdirSync(p, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => join(p, e.name))
      .sort();
  } catch {
    return [];
  }
};
const real = (p: string) => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};
const isRunFolder = (p: string) => basename(dirname(p)) === "runs" && basename(dirname(dirname(p))) === "fsloop" && basename(dirname(dirname(dirname(p)))) === ".claude";

export function discover(roots: string[]): FoundRun[] {
  const found: { projectDir: string; dir: string }[] = [];
  const seen = new Set<string>();
  const add = (projectDir: string, dir: string) => {
    const key = real(dir).toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ projectDir, dir });
  };
  const project = (p: string) => {
    for (const d of subdirs(runsOf(p))) add(p, d);
  };
  for (const r of roots.map((x) => resolve(x))) {
    if (!isDir(r)) continue;
    if (isRunFolder(r)) add(dirname(dirname(dirname(dirname(r)))), r);
    else if (existsSync(runsOf(r))) project(r);
    else for (const c of subdirs(r)) if (existsSync(runsOf(c))) project(c);
  }

  // A project's name is its folder's; two projects of one name take their parent folder's name too.
  const dirsByName = new Map<string, Set<string>>();
  for (const f of found) (dirsByName.get(basename(f.projectDir)) ?? dirsByName.set(basename(f.projectDir), new Set()).get(basename(f.projectDir)))?.add(f.projectDir);
  const nameOf = (projectDir: string) => ((dirsByName.get(basename(projectDir))?.size ?? 0) > 1 ? `${basename(dirname(projectDir))}/${basename(projectDir)}` : basename(projectDir));

  const keys = new Set<string>();
  return found
    .map(({ projectDir, dir }) => {
      const project = nameOf(projectDir);
      const id = basename(dir);
      let key = `${project}/${id}`;
      for (let k = 2; keys.has(key); k++) key = `${project}/${id}~${k}`;
      keys.add(key);
      return { key, project, projectDir, id, dir };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
