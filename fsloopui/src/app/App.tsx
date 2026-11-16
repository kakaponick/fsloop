// A placeholder until the shell lands (u3): it reads the run list and says how many runs the server found.
import { useEffect, useState } from "react";
import { count, NOUNS } from "../../shared/text.ts";

type State = { kind: "loading" } | { kind: "ready"; runs: number } | { kind: "error"; cause: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/runs", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body: { list: unknown[] }) => setState({ kind: "ready", runs: body.list.length }))
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setState({ kind: "error", cause: e instanceof Error ? e.message : String(e) });
      });
    return () => controller.abort();
  }, []);
  return (
    <main>
      <h1>fsloopUI</h1>
      <p role="status">{state.kind === "loading" ? "Загрузка…" : state.kind === "ready" ? `Найдено: ${count(state.runs, NOUNS.run)}` : `Список прогонов не прочитан: ${state.cause}`}</p>
    </main>
  );
}
