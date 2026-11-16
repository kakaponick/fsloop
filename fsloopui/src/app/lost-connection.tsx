// The lost connection (rules/ui → Live data 5; ui → Live data: a toolbar fact): one line at the shell's top, in the
// sidebar's head beside the product's name — there in every frame of the shell, loading, not-found and errors
// included — «Нет связи с сервером fsloopUI · данные от 19:41 МСК», with an amber dot, because the operator should
// check the server. The head's row is always there, so its arrival moves nothing; the sidebar's column reads the
// compact form, the full one in its title. While connected there is neither this line nor any «live» mark.
//
// While the connection is lost nothing the stream would confirm may age: the shell's «now» stops at the data's time
// (`useShellClock`), so a run's liveness, its «идёт» and the sidebar's groups stay as last read.
import { Dot } from "../ui/index.ts";
import { cn } from "@/lib/utils";
import { useNow } from "./clock.tsx";
import { useConnection, useUpdatedAt } from "./live.tsx";
import { dataAgeText, lostText } from "./words.ts";
import { mskDateTime } from "../../shared/text.ts";

export function LostConnection({ className }: { className?: string }) {
  const connection = useConnection();
  const at = useUpdatedAt();
  const now = useNow();
  if (connection !== "lost") return null;
  const full = lostText(at, now);
  return (
    <p role="status" aria-label={full} title={full} data-slot="lost-connection" className={cn("flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap", className)}>
      <Dot tone="warning" />
      <span className="hidden truncate @min-[40rem]/sidebar:inline">{full}</span>
      <span className="truncate @min-[40rem]/sidebar:hidden">{lostText(at, now, { compact: true })}</span>
    </p>
  );
}

/** The shell's «now» for a run's liveness, ages and groups: the shared clock, or — while the connection is lost —
 * the time the shown data was read; `lost` says which. */
export function useShellClock(): { now: number; lost: boolean } {
  const connection = useConnection();
  const at = useUpdatedAt();
  const now = useNow();
  const lost = connection === "lost" && at !== null;
  return { now: lost ? at : now, lost };
}

/** The data's age for a view's status bar (the table kit's): «обновлено 5 мин назад», the full МСК time for its
 * title; it keeps counting from the last read while the connection is lost. */
export function useDataAge(): { connected: boolean; text: string | null; title: string | null } {
  const connection = useConnection();
  const at = useUpdatedAt();
  const now = useNow();
  return {
    connected: connection !== "lost",
    text: at === null ? null : dataAgeText(at, now),
    title: at === null ? null : mskDateTime(new Date(at).toISOString()),
  };
}
