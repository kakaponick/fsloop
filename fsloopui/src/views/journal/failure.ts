// What a reading view («Журнал», «Соглашения») could not read (rules/ui → Conventions 4, 14): a file of the run folder
// named in `run.errors`, or the run folder itself when no run.json stood behind it — then the server served an empty
// model (server/run.ts → readRun), and an empty list there is a false state, never «ещё нет» or «не было».
import { RUN_FOLDER, type FileError, type Run } from "../../../shared/model.ts";

/** The live parse failed and no run.json backed it: every list of the run is empty because nothing was read. */
export const folderFailure = (run: Pick<Run, "errors" | "source">): FileError | null => (run.source === "live" ? (run.errors.find((e) => e.file === RUN_FOLDER) ?? null) : null);

/** A file of the run folder by its name at the end of the path: «journal.md», «reports/p1-decompose-design-check.md». */
export const fileFailure = (run: Pick<Run, "errors">, file: string): FileError | null => {
  const want = file.replace(/\\/g, "/");
  return run.errors.find((e) => e.file.replace(/\\/g, "/").endsWith(want)) ?? null;
};

/** A file's name without its folders: «p1-decompose-design-check.md». */
export const baseName = (file: string): string => file.split(/[\\/]/).pop() ?? file;
