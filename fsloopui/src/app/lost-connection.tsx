// The lost connection (rules/ui → Live data 5; ui → Live data: a toolbar fact): one line in the run page's tab row,
// above every view — «Нет связи с сервером fsloopUI · данные от 19:41 МСК» — with an amber dot, because the
// operator should check the server. It sits in a row that is always there, so its arrival moves nothing; a narrow
// row reads the compact form. While connected there is neither this line nor any «live» mark.
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
      <span className="hidden truncate @min-[40rem]/tabs:inline">{full}</span>
      <span className="truncate @min-[40rem]/tabs:hidden">{lostText(at, now, { compact: true })}</span>
    </p>
  );
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
