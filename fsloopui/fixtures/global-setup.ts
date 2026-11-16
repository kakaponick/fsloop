// Vitest's global setup: the two whole fixture roots of 63 run folders are written once per test run, before any
// test file starts, and their paths are provided to the files (`inject`). A whole root takes seconds to write; built
// in the `beforeAll` of several files at once, under the parallel load, it outran the 10 s hook limit. A file that
// needs only some folders, or writes into its root, still builds its own (`fixtureApp({ only })`).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { makeFixtureRoot } from "./make.ts";

/** «now» of the app's tests (16.11.2026 19:41 МСК) and of the fixture builder's own test (13:00 МСК). */
export const APP_NOW = Date.parse("2026-11-16T16:41:00Z");
export const MAKE_NOW = Date.parse("2026-11-16T10:00:00Z");

declare module "vitest" {
  export interface ProvidedContext {
    /** The whole root at APP_NOW: read-only, shared by every file that reads all 63 folders. */
    fixtureRoot: string;
    /** The whole root at MAKE_NOW: fixtures/make.test.ts's own, which it writes again. */
    makeFixtureRoot: string;
  }
}

export default function setup({ provide }: TestProject) {
  const temp = mkdtempSync(join(tmpdir(), "fsloopui-roots-"));
  const app = join(temp, "app");
  const make = join(temp, "make");
  makeFixtureRoot(app, { now: APP_NOW });
  makeFixtureRoot(make, { now: MAKE_NOW });
  provide("fixtureRoot", app);
  provide("makeFixtureRoot", make);
  return () => rmSync(temp, { recursive: true, force: true });
}
