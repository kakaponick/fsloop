// A launch's report as written, read when «Файл отчёта» opens (`GET /api/report?run=<key>&file=<name>`): a run
// holds up to 97 reports of up to 59.8 kB, so the run model carries none of their text and only the opened one is
// read. The reader is the server's route by default; a test passes its own through the provider.
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";

export type FetchReport = (runKey: string, file: string) => Promise<Response>;

export const httpReport: FetchReport = (runKey, file) => fetch(`/api/report?run=${encodeURIComponent(runKey)}&file=${encodeURIComponent(file)}`, { cache: "no-store" });

const Context = createContext<FetchReport>(httpReport);

export function ReportFetchProvider({ value, children }: { value: FetchReport; children: ReactNode }) {
  return createElement(Context.Provider, { value }, children);
}

export type ReportText = { status: "loading" } | { status: "ready"; text: string } | { status: "error"; cause: string };

async function causeOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.cause === "string") return body.cause;
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return `сервер ответил ${res.status}`;
}

/** The report's text: loading the first time a file opens; a newer version of the run re-reads it while the text
 * already shown stays (Live data 3 — the reader updates in place). */
export function useReportText(runKey: string, file: string, version: number): ReportText {
  const read = useContext(Context);
  const key = `${runKey}|${file}`;
  const [state, setState] = useState<{ key: string; result: ReportText }>({ key: "", result: { status: "loading" } });
  useEffect(() => {
    let live = true;
    (async () => {
      let result: ReportText;
      try {
        const res = await read(runKey, file);
        result = res.ok ? { status: "ready", text: await res.text() } : { status: "error", cause: await causeOf(res) };
      } catch (e) {
        result = { status: "error", cause: e instanceof Error ? e.message : String(e) };
      }
      if (live) setState({ key, result });
    })();
    return () => {
      live = false;
    };
  }, [read, runKey, file, key, version]);
  return state.key === key ? state.result : { status: "loading" };
}
