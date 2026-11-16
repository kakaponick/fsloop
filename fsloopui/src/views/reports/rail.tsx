// The report rail (surfaces/reading.md → BLOCKS 2; rules/ui → Conventions 8): one flat list with one Tab stop — ↑/↓
// move, Enter opens — of every launch in run order, under non-focusable stage headings with their counts. Each
// item is one link as a whole: the description (truncated, whole in its title) with its kind word, then its state —
// «2 major · 5 minor» in the worst severity's tone, or a neutral «работает · 4 мин». The rail is height-bounded and
// scrolls inside; the held-order strip under it keeps its line whether anything waits or not (Strict 1).
import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Finding } from "../../../shared/model.ts";
import { num } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { copyItem, Dot, flatItem, FlatList, markProps, Menu, OutOfFilter, type MenuItem } from "@/ui";
import { groupsOf, groupTitle, itemState, type HeldItem } from "./model.ts";

export interface RailProps {
  items: readonly HeldItem[];
  findings: readonly Finding[];
  /** The open report's id. */
  current: string | null;
  /** Items the filters hide but the URL opened: shown anyway, «вне фильтра». */
  outside: ReadonlySet<string>;
  /** Placed by the strip: the edge mark. */
  arrived: ReadonlySet<string>;
  hrefOf: (id: string) => string;
  /** The report file's full path, for «Скопировать путь к отчёту»; null while it runs. */
  pathOf: (id: string) => string | null;
  now: number;
}

export const RAIL_LABEL = "Отчёты прогона";
export const COPY_PATH = "путь к отчёту";

export function Rail({ items, findings, current, outside, arrived, hrefOf, pathOf, now }: RailProps) {
  const root = useRef<HTMLDivElement>(null);
  // The open report is in view when the rail opens on it, or a link elsewhere changes it.
  useLayoutEffect(() => {
    if (!current) return;
    const el = [...(root.current?.querySelectorAll<HTMLElement>("[data-flat-item]") ?? [])].find((e) => e.dataset.flatItem === current);
    el?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const groups = groupsOf(items.map((h) => h.item));
  const ended = new Set(items.filter((h) => h.ended).map((h) => h.item.id));
  return (
    <div ref={root}>
      <FlatList label={RAIL_LABEL}>
        {groups.map((group, g) => {
          const title = groupTitle(group.stage);
          return (
            <section key={`${group.stage}-${g}`} aria-label={[title.word, title.pass].filter(Boolean).join(", ")} className="flex flex-col">
              <h3 data-slot="rail-heading" className="sticky top-0 z-10 m-0 flex h-7 items-center gap-1.5 bg-background px-2 text-xs font-normal text-muted-foreground">
                <span className="truncate text-foreground">{title.word}</span>
                {title.pass && <span className="shrink-0">· {title.pass}</span>}
                <span className="ml-auto min-w-count shrink-0 text-right tabular-nums">{num(group.items.length)}</span>
              </h3>
              {group.items.map((item) => {
                const state = itemState(item, findings, now, { ended: ended.has(item.id) });
                const path = pathOf(item.id);
                const menu: MenuItem[] = [path ? copyItem(COPY_PATH, path) : { label: `Скопировать ${COPY_PATH}`, onSelect: () => {}, blocked: "Отчёта ещё нет: запуск работает — путь появится, когда он закончит" }];
                const open = item.id === current;
                const marks = markProps({ edge: arrived.has(item.id) && !open }, "");
                return (
                  <Menu key={item.id} kind="context" groups={[menu]} label={item.description}>
                    <Link
                      to={hrefOf(item.id)}
                      {...flatItem(item.id)}
                      aria-current={open ? "page" : undefined}
                      data-edge={marks["data-edge"]}
                      title={`${item.description} — ${item.kind}`}
                      className={cn(
                        "flex h-11 min-w-0 flex-col justify-center gap-0.5 rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                        open && "bg-muted shadow-target",
                        marks.className,
                      )}
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="min-w-0 truncate">{item.description}</span>
                        {outside.has(item.id) ? <OutOfFilter className="ml-auto shrink-0" /> : <span className="ml-auto shrink-0 text-xs text-muted-foreground">{item.kind}</span>}
                      </span>
                      <span data-slot="rail-state" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                        <Dot tone={state.tone} />
                        <span className="truncate">{state.text}</span>
                      </span>
                    </Link>
                  </Menu>
                );
              })}
            </section>
          );
        })}
      </FlatList>
    </div>
  );
}
