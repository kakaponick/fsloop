// A launch's report as written, read when «Файл отчёта» opens: a run holds up to 97 reports of up to 59.8 kB, so the
// run model carries none of their text and only the opened one is read — through the API module, which reads it
// again only when the report's record in the run has changed (`Api.report`).
import { useCallback, useEffect, useState } from "react";
import { useApi } from "@/api";

export type ReportText = { status: "loading" } | { status: "ready"; text: string } | { status: "error"; cause: string };

/** The report's text: loading the first time a file opens; each newer version of the run asks again, and the text
 * already shown stays while it does (Live data 3 — the reader updates in place). `retry` asks again after a failed
 * read (p1-review cand-6): the API keeps no failure, so the server reads the file anew. */
export function useReportText(runKey: string, file: string, version: number): ReportText & { retry: () => void } {
  const api = useApi();
  const key = `${runKey}|${file}`;
  const [state, setState] = useState<{ key: string; result: ReportText }>({ key: "", result: { status: "loading" } });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ key, result: { status: "loading" } });
    setAttempt((n) => n + 1);
  }, [key]);
  useEffect(() => {
    let live = true;
    api.report(runKey, file).then(
      (text) => {
        // the same text again (the report has not changed) keeps the state, so nothing re-renders
        if (live) setState((s) => (s.key === key && s.result.status === "ready" && s.result.text === text ? s : { key, result: { status: "ready", text } }));
      },
      (e: unknown) => {
        if (live) setState({ key, result: { status: "error", cause: e instanceof Error ? e.message : String(e) } });
      },
    );
    return () => {
      live = false;
    };
  }, [api, runKey, file, key, version, attempt]);
  return { ...(state.key === key ? state.result : { status: "loading" }), retry };
}
