// The addresses of fsloopUI (rules/ui → Layout 2, Conventions 12): a run is /r/<project>/<id>, its view and the
// object a view opens are query keys — `view`, then `finding`, `unit`, `report` with `tab`, `entry`. A project
// name may hold a slash (two projects of one name), so the run id is the last segment and the rest is the project.
import { VIEW_IDS, DEFAULT_VIEW, type ViewId } from "../views/ids.ts";

export type RunParams = Partial<Record<"view" | "finding" | "unit" | "report" | "tab" | "entry" | "page", string>>;

/** The address of a run, with the query keys given (empty ones left out). */
export function runPath(key: string, params: RunParams = {}): string {
  const path = `/r/${key.split("/").map(encodeURIComponent).join("/")}`;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) query.set(k, v);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The run key of an address, or null when it is not a run's. */
export function runKeyOf(pathname: string): string | null {
  if (!pathname.startsWith("/r/")) return null;
  const parts = pathname.slice(3).split("/").filter(Boolean).map(decode);
  return parts.length >= 2 ? parts.join("/") : null;
}

/** The project and the id a key names: the id is its last segment. */
export function splitKey(key: string): { project: string; id: string } {
  const at = key.lastIndexOf("/");
  return { project: key.slice(0, at), id: key.slice(at + 1) };
}

/** The view the query names; «Находки» when it names none or an unknown one. */
export function viewOf(search: string): ViewId {
  const v = new URLSearchParams(search).get("view");
  return (VIEW_IDS as readonly string[]).includes(v ?? "") ? (v as ViewId) : DEFAULT_VIEW;
}
