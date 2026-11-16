// The report rail (surfaces/reading.md → BLOCKS 2; rules/ui → Conventions 8): one flat list with one Tab stop — ↑/↓
// move, Enter opens — of the overview, then every launch in run order, under non-focusable stage headings with
// their counts. Each item is one link as a whole: the description (truncated, whole in its title) with its kind word
// where it differs from its group's most common kind, then its state as plain text — «2 major · 5 minor», «работает ·
// 4 мин» — with a dot
// only where the state asks for the operator («нет отчёта»): severity's tones live in the reader and the overview,
// where they rank something (DESIGN.md → The Signal-Only Rule). The rail is height-bounded and scrolls inside; the
// held-order strip under it keeps its line whether anything waits or not (Strict 1).
import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Finding } from "../../../shared/model.ts";
import { count, NOUNS, num } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { copyItem, Dot, flatItem, FlatList, markProps, Menu, OutOfFilter, revealIn } from "@/ui";
import { commonKind, commonResult, groupsOf, groupTitle, itemState, type HeldItem } from "./model.ts";

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
  /** The overview's address: the rail's first item, the way back from any report. */
  overviewHref: string;
  /** The report file's full path, for «Скопировать путь к отчёту»; null while it runs. */
  pathOf: (id: string) => string | null;
  /** In the reports' place when the filters leave none: the overview item stays above it. */
  empty?: ReactNode;
  now: number;
}

export const RAIL_LABEL = "Отчёты прогона";
/** A stage heading's fixed height, sticky at the rail's top: the rail's scroller pads its top by it (`scroll-pt-7`),
 * and a reveal passes it in its gap. */
export const RAIL_HEADING = 28;
export const COPY_PATH = "путь к отчёту";
/** The rail's first item: the overview holds the surfaces' scores and the run's tokens (u6-shape cand-1); the narrow
 * view's «Отчёт» picker names the same place in lower case. */
export const OVERVIEW_ITEM = "Обзор: оценки и токены";

/** cand-8: the focus is a 2 px ring in full muted ink — the open item's mark is 1 px of ink on the muted ground, so a
 * focused open item wears both and the two never read as one. */
const ITEM_CLASS = "rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

export function Rail({ items, findings, current, outside, arrived, hrefOf, overviewHref, pathOf, empty, now }: RailProps) {
  const root = useRef<HTMLDivElement>(null);
  // The open report is in view when the rail opens on it, or a link elsewhere changes it — the rail's own scroller
  // moves, and nothing above it (`@/ui` → revealIn; Strict 1, craft-1).
  // A report above the rail's view, or one under its sticky stage heading, comes to the heading's foot, 8 px clear;
  // one past the view's end by as little as shows it — `revealIn`'s one rule under a sticky heading, `head` (design-6,
  // code-4: it sets `scrollTop` and reads no scroll padding, so the heading's height is passed).
  useLayoutEffect(() => {
    if (!current) return;
    const el = [...(root.current?.querySelectorAll<HTMLElement>("[data-flat-item]") ?? [])].find((e) => e.dataset.flatItem === current);
    const scroller = root.current?.closest<HTMLElement>("[data-slot=rail-scroll]");
    if (!el || !scroller) return;
    revealIn(scroller, el, { head: RAIL_HEADING, focus: false });
  }, [current]);
  const groups = groupsOf(items.map((h) => h.item));
  const ended = new Set(items.filter((h) => h.ended).map((h) => h.item.id));
  return (
    <div ref={root}>
      <FlatList label={RAIL_LABEL}>
        <Link
          to={overviewHref}
          {...flatItem("")}
          data-slot="rail-overview"
          aria-current={current === null ? "page" : undefined}
          className={cn("mb-1 flex h-9 shrink-0 items-center", ITEM_CLASS, current === null && "bg-muted shadow-target")}
        >
          <span className="truncate">{OVERVIEW_ITEM}</span>
        </Link>
        {empty}
        {!empty && groups.map((group, g) => {
          const title = groupTitle(group.stage);
          // the kind word only on a row whose kind is not the group's usual one; every row keeps it in its title
          const usual = commonKind(group.items);
          // likewise an implementer's result: «итог» only where it differs from the one its group shares
          const result = commonResult(group.items);
          return (
            <section key={`${group.stage}-${g}`} aria-label={[title.word, title.pass].filter(Boolean).join(", ")} className="flex flex-col">
              <h3 data-slot="rail-heading" className="sticky top-0 z-10 m-0 flex h-7 items-center gap-1.5 bg-background px-2 text-xs font-normal text-muted-foreground">
                <span className="truncate text-foreground">{title.word}</span>
                {title.pass && <span className="shrink-0">· {title.pass}</span>}
                {/* the bare number keeps the heading short; its noun is in its title (improve-10 (3)) */}
                <span data-slot="rail-count" title={count(group.items.length, NOUNS.report)} className="ml-auto min-w-count shrink-0 text-right tabular-nums">
                  {num(group.items.length)}
                </span>
              </h3>
              {group.items.map((item) => {
                const state = itemState(item, findings, now, { ended: ended.has(item.id), usual: result });
                const path = pathOf(item.id);
                const open = item.id === current;
                const marks = markProps({ edge: arrived.has(item.id) && !open }, "");
                const link = (
                  <Link
                    to={hrefOf(item.id)}
                    {...flatItem(item.id)}
                    aria-current={open ? "page" : undefined}
                    data-edge={marks["data-edge"]}
                    title={`${item.description} — ${item.kind}`}
                    className={cn("flex h-11 min-w-0 flex-col justify-center gap-0.5", ITEM_CLASS, open && "bg-muted shadow-target", marks.className)}
                  >
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="min-w-0 truncate">{item.description}</span>
                      {outside.has(item.id) ? (
                        <OutOfFilter className="ml-auto shrink-0" />
                      ) : (
                        item.kind !== usual && (
                          <span data-slot="rail-kind" className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {item.kind}
                          </span>
                        )
                      )}
                    </span>
                    <span data-slot="rail-state" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      {/* a dot only for a state that asks for the operator: on 98 rows a tone every row shares ranks nothing */}
                      {state.tone !== "neutral" && <Dot tone={state.tone} />}
                      <span className="truncate">{state.text}</span>
                    </span>
                  </Link>
                );
                // a running launch has no report yet: its copy item could never run, so it has no menu (craft-29)
                return path ? (
                  <Menu key={item.id} kind="context" groups={[[copyItem(COPY_PATH, path)]]} label={item.description}>
                    {link}
                  </Menu>
                ) : (
                  <Fragment key={item.id}>{link}</Fragment>
                );
              })}
            </section>
          );
        })}
      </FlatList>
    </div>
  );
}
