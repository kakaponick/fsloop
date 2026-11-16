---
name: fsloopUI
description: A calm, dense reading instrument for fsloop runs — warm greys, ink as the one primary, colour only for signal.
colors:
  paper: "#fbfbfa"
  ink: "#1b1b1a"
  on-ink: "#ffffff"
  popover: "#ffffff"
  muted: "#f0f0ed"
  muted-ink: "#6d6d69"
  hairline: "#e2e2dd"
  code-ground: "#efefec"
  signal-danger: "#c4372c"
  signal-warning: "#b17716"
  signal-success: "#2c8a4b"
  signal-info: "#2b68c9"
typography:
  body:
    fontFamily: "system-ui, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  small:
    fontFamily: "system-ui, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  title:
    fontFamily: "system-ui, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "normal"
  heading:
    fontFamily: "system-ui, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "10px"
spacing:
  dot: "7px"
  thumb-w: "118px"
  thumb-h: "74px"
  count: "3ch"
  strip: "1.75rem"
  measure: "75ch"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "28px"
    padding: "0 10px"
  input-default:
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "28px"
    padding: "0 8px"
  status-dot:
    backgroundColor: "{colors.muted-ink}"
    rounded: "{rounded.xl}"
    size: "{spacing.dot}"
  frame-thumb:
    backgroundColor: "{colors.muted}"
    rounded: "{rounded.sm}"
    width: "{spacing.thumb-w}"
    height: "{spacing.thumb-h}"
  table-row:
    height: "32px"
    padding: "0 8px"
  table-header:
    textColor: "{colors.muted-ink}"
    typography: "{typography.small}"
    height: "32px"
    padding: "0 8px"
  status-bar:
    textColor: "{colors.muted-ink}"
    typography: "{typography.small}"
    height: "32px"
  inline-code:
    backgroundColor: "{colors.code-ground}"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
---

# Design System: fsloopUI

Visual system only: tokens, colour, type, depth and the look of the shared components. Who the product is for, its voice and its glossary live in `PRODUCT.md`; how to build UI — `.claude/rules/ui.md` (the project's rules) over fsloop's `skills/fsloop/law/ui.md`, `ux.md`, `table.md`. The theme is `fsloopui/src/styles/index.css`; the shared components are `fsloopui/src/ui/`, built on the shadcn/ui library in `fsloopui/src/components/ui/` (style `radix-nova`, base `neutral`); every part in its states is on the kit page, `/kit` in dev.

## Overview

**Creative North Star: "The Reading Desk"**

A desk where one operator reads what his unattended runs did: a warm-grey sheet, ink for words, and nothing else asking for attention unless it waits on him. The world is the prototype's (`tga/.claude/fsloop/prototype-viewer/template.html`), kept and written down: its twelve colours, its system faces, its 13 px text at 1.45, its 8 px radius. fsloopUI adds no brand and no new direction.

Two jobs shape it. Scanning — many runs, hundreds of findings — wants density: one line per row, tabular numerals, fixed widths so nothing jitters. Reading — a finding's rule, a report, a goal of 8 617 characters — wants measure: running text keeps its paragraphs, lists and code at a 75-character line. Light and dark are equal surfaces and follow the system.

**Key Characteristics:**
- Warm-grey surface; colour only for signal (red, amber, green), shown as a 7 px dot beside a plain word.
- 13 px body at 1.45, 12 px mono for identifiers, tabular numerals for every count.
- Flat: depth is a hairline or a 1 px ring; the one shadow is the toast's.
- Nothing moves on its own: every late part has its box reserved, a live list holds its order.
- Russian interface; what fsloop or a critic wrote is shown as written.

## Colors

The chrome is greys with a faint warm cast; hue appears only where it carries a state the operator should act on.

| Token (theme variable) | Light | Dark | Role |
|---|---|---|---|
| Paper (`--background`, `--card`) | `#fbfbfa` | `#101111` | The page and its regions |
| Ink (`--foreground`, `--primary`) | `#1b1b1a` | `#e8e8e4` | Text, the primary button, the selected tab's underline |
| On ink (`--primary-foreground`) | `#ffffff` | `#111111` | Text on a primary button |
| Popover (`--popover`) | `#ffffff` | `#171818` | Menus, selects, dialogs: one step off the page |
| Muted (`--muted`, `--secondary`, `--accent`) | `#f0f0ed` | `#1b1c1c` | Hover rows, the target mark's ground, inert fills |
| Muted ink (`--muted-foreground`, `--ring`) | `#6d6d69` | `#98988f` | Labels, meta, a zero, the neutral dot, the edge mark |
| Hairline (`--border`, `--input`) | `#e2e2dd` | `#2b2c2c` | Dividers, field strokes |
| Code ground (`--code`) | `#efefec` | `#1c1d1d` | Inline code and code blocks |
| Signal danger (`--destructive`) | `#c4372c` | `#f0655b` | critical; a destructive control |
| Signal warning (`--warning`) | `#b17716` | `#dfa53d` | major; a red gate, a blocked unit, «молчит», a part that failed |
| Signal success (`--success`) | `#2c8a4b` | `#57b979` | A committed unit, a finding fixed, a met goal |
| Signal info (`--info`) | `#2b68c9` | `#6ba3f6` | Chart series only |

### Named Rules

**The Signal-Only Rule.** A hue is a state the operator should act on (red, amber) or a thing done (green); work in progress — writing, verifying, landing — is neutral, because the run carries it and nothing is asked (`rules/ui` → Conventions 2). Severity is the one category with a tone: critical red, major amber, minor neutral.

**The Dot Rule.** A state's colour is a dot, never a fill, a badge, a border or coloured text (`ui` → Status color is a dot).

**The Contrast Floor.** Text tokens hold 4.5:1 on every ground they sit on (paper, muted, popover, code) in both themes; a signal tone, used only as a dot, holds 3:1 — `fsloopui/src/ui/tokens.test.ts` computes both from the token values.

## Typography

**Body / UI font:** the platform sans (`system-ui, "Segoe UI", sans-serif`). **Mono:** `ui-monospace, "Cascadia Mono", Consolas, monospace`. No web fonts: the instrument loads nothing it does not need, and every glyph is on first paint.

### Hierarchy
- **Heading** (600, 17 px / 1.35): a report's title, the kit's page title.
- **Title** (600, 14 px / 1.45): a section heading inside a page, a card's project.
- **Body** (400, 13 px / 1.45, `text-sm`): the default — rows, facts, running text, menus, buttons.
- **Small** (400, 12 px / 1.4, `text-xs`): meta lines, a column header, a strip, a caption.
- **Mono** (400, 12 px, `font-mono text-xs`): ids, paths, shas, commands, file names; never as a costume.

### Named Rules

**The Tabular Rule.** Every number that changes or aligns — a count, a tab's count, a time, a duration — is set in tabular numerals, and a count that changes keeps a box three digits wide (`min-w-count`).

**The Measure Rule.** Running text stops at 75 characters (`max-w-measure`); a table or a code block inside it scrolls sideways in its own bordered box instead of widening the column.

## Layout

The shell's grid owns the only viewport breakpoint (980 px): above it, a 316 px sidebar and the run page in `minmax(0, 1fr)`; below it, the sidebar becomes a band above the page whose run list is a fixed 128 px from the first paint — four whole 32 px rows, a fold's header counting as one. The band's column takes its height from its content, so the list's own size is its flex basis (`flex-none` with `h-32`; a `flex-1` basis of 0% falls back to the content there); every row of the band is one 32 px line, a closed run's too, with no padding under the last, and the list's scroll snaps to a row's top, so no stop slices a row. Every region — sidebar, run header, view body — is a size container, and a component adapts by container query to the region it sits in (`rules/ui` → Layout 1); a view's own columns follow the view's width the same way — from 52 rem «Журнал» sets a 14 rem stage rail beside its list (the list column `minmax(0, 75ch + 9.5rem)`, the measure plus the scroll gutter), each column scrolling on its own with a stable gutter, and below 52 rem the rail is hidden and the list takes the width. Components are sized by their content: triggers hug their value, tabs stay content-width and left-aligned, a fact list takes one label column and one value column.

Spacing follows Tailwind's 4 px scale. Rows breathe at 4–8 px vertical padding, groups at 12–16 px, sections at 32 px.

**The Reserved-Box Rule.** Anything that appears after first paint has its box before it appears: a frame thumbnail (118 × 74), a count (three digits), the held-order strip's line (28 px), a loading state the size of the region it fills, `scrollbar-gutter: stable` on a scrolling region (`rules/ui` → Strict 1).

## Elevation & Depth

Flat. Regions separate by a hairline or by the one step from paper to popover; menus, selects and dialogs carry the library's 1 px ring. The toast is the only element with a soft shadow. The dialog's overlay dims the page; the frame viewer's ground is muted so a screenshot reads as an object.

### Shadow Vocabulary
- **Edge mark** (`shadow-edge`: `inset 3px 0 0` muted ink) — a row changed in the last minutes; in the sidebar, a mini row whose run changed since the operator last opened it — the mini row's «новое», which its name and title also say.
- **Target mark** (`shadow-target`: `inset 0 0 0 1px` ink, on the muted ground) — the object a link opened.

Both are inset, so marking a row moves nothing; neither takes a signal hue (`rules/ui` → Conventions 9).

## Shapes

`--radius` 8 px: buttons, fields, cards and the frame viewer's stage at 6–8 px, a thumbnail and inline code at 4 px, a dialog at 10 px. The status dot is round. Pills appear nowhere: a state is never a badge.

## Components

Each shared part below lives in `fsloopui/src/ui/` (exported from `src/ui/index.ts`) and composes the library's component for its job; a part is hand-made only where the library has none. Every part has a test of its states and its keyboard beside it.

### Status Dot — `StatusDot`, `Dot`
A 7 px dot in the state's tone, then the word in regular text; the tone comes from the shared state map entry (`fsloopui/shared/states.ts`, `liveness.ts`), never from a caller's colour. A cell reads the compact form «state · age · cause», truncated at the end with the whole in its title; a fact reads the full form. Serves `rules/ui` → Conventions 1, 2; `ui` → Status color is a dot.

### Absent Values — `Dash`, `NotFound`, `NotRecorded`
«—» in muted ink where no value exists; «юнит u7 не найден» / «находка … не найдена» / «решение #12 не найдено» / «соглашение 99 не найдено», the id in mono, where the run names an id its folder lacks — the noun and its agreement from one map (`OBJECT_WORDS`; a journal entry is «решение», as everywhere in the journal), an object a list numbers written as that list writes it (`NUMBERED`, `numberText`: a decision «#12» everywhere — its head, its range, its «не найдено» —, a convention its bare ordinal), and the id wearing the search's mark where the view searches it (`highlight`); «не записано» with a neutral dot (and its cause) where the folder lacks the field. An address that names an object its list lacks reads one line on every such list, `MissingLine`: «Решение #999 не найдено: в этом прогоне решения #1–#143.» or «Соглашение 99 не найдено: в этом прогоне соглашения 1–26.» — what is missing, the numbers the run holds — then «Закрыть», which drops the address and puts focus on the list; a polite status. Serves Conventions 4, 5, `ux 1`.

### Count — `CountLink`
The number first, its noun agreed («3 находки»), tabular. A link (thin underline, ink) only above 0 and only when the list it opens shows the same number; a zero is a muted «0» beside a neutral dot. Serves Conventions 7, Copy 3.

### Tabs with Counts — `CountTabs`
The library's tabs in their line variant, content-width and left-aligned; each tab carries its count in a three-digit box, a zero muted; the active tab keeps the weight of the others — its ink and underline mark it, so choosing a tab shifts nothing. ←/→ move. `sticky` is the one sticky form of the strip — the run's views and a report's parts both take it: the list pinned to the top of whatever scrolls it, 40 px on the page's ground with a hairline under it, the active tab's underline sitting on that hairline, scrolling sideways when the tabs outgrow it; the root then draws no box, so the strip sticks within the region that scrolls its panels, or the page. A sticky strip given `overflow` (`{label, keep}` — a report's parts) never scrolls sideways: it measures its room and its tabs before the frame paints and folds what does not fit, from the right, through the toolbar's one packing module, into «Ещё N» — a 64 px box on the strip's ground beside the list, drawn only while a tab is folded, opening a menu of the folded tabs with their counts; the open tab and the `keep` tabs («Файл отчёта») never fold, and every label left in the strip is whole. Serves Layout 4, Conventions 7, Strict 1, `table #14`.

### Fact List — `FactList`
One label–value table: muted labels in one column, values in the other, one fact to a row. Outcome rows open it, facts follow, and the facts decided by least fold behind one «Подробнее» row at its end, open or closed as last left (browser storage). The label column is as wide as every label, the folded ones included — each folded label holds its room invisibly in the first label's cell — so opening «Подробнее» moves no value. A label that names a term a new user cannot read alone carries its glossary (`glossary`): the label is the dotted term, the value reads plain. The fold is one part, `FoldTrigger` — a chevron and «Подробнее» in muted ink on the library's Collapsible — that FactList's last row draws and `Fold` draws for whole sections: its trigger on its own reserved 28 px line, what it opens under it, so opening moves nothing above it and not the trigger; its open state in `fold:<key>`, as last left. A committed unit's «Запуски агентов» and «Проверки юнита» sit behind one `Fold` under its facts (`ux 9` → Provenance); while the unit is in work, waits or is blocked they stay open, and a unit committed under an open detail folds nothing until it is opened again. Serves `ux 9`, Layout 3, `ui` → Glossary, Strict 1.

### Running Text — `RunningText`
Paragraphs with their line breaks, bullet and numbered lists, headings, inline code on the code ground, bold; a markdown table or a code block in its own bordered box that scrolls sideways; ids linked only through the caller's resolver; a caller that draws a code span its own way passes `renderCode(body, code)` — «Соглашения» makes each place of an example its copy button — and returns null to leave the span to the resolver or plain code. Punctuation right after inline code keeps to it — the code drops its right padding and the two never part at a line end — so «`ux 1`,» reads with no gap. A view that searches the text passes the search's painter (`highlight`): its hits wear the table's one mark in paragraphs, bold, lists, tables and code alike. Parsed into elements, never HTML: a tag in the text shows as text. At the 75-character measure. Serves Layout 5, `table #12`.

### Clamp — `Clamp`
Two lines (one to four), cut at that many line heights; «… развернуть» shows only when the clamp hides text, as a float that takes its own width at the end of the last line — the line's words wrap around it, so the line ends on a whole word and nothing is drawn over a glyph. Expanded, the text scrolls inside a 20 rem region and «свернуть» returns. A card's clamp has no trigger and keeps the library's ellipsis. Serves Layout 6.

### Frames — `FrameThumb`, `FrameStrip`, `FrameViewer`
A 118 × 74 thumbnail on the muted ground, its box fixed before the image loads, up to 16 then «ещё N кадров». The viewer is a dialog over the page titled by the file name, «3 из 8 кадров», a fixed stage (90 vw × 78 vh) so stepping never moves ‹ ›; ‹ ›, ←/→ and the wheel step one frame per gesture and stop at the ends; Escape returns focus to the thumbnail. Serves Layout 7, `ui` → Wheel.

### Flat List — `FlatList`, `flatItem`
Every list that is not a table: the sidebar's runs, the report rail, the findings listed outside «Находки» (`ExpandingFindings`, the rows' chevrons), the journal's entries and its stage rail, the run's conventions. One Tab stop — the focused item, else the open one — then ↑/↓, Home/End; an item with an address is one link as a whole, and Enter follows it; Enter on an item that is not a link opens it (a finding row expands or closes; a journal's decision or a convention opens its address menu, `openItemMenu`), while Enter on a link or a button inside such an item is that control's own; headings are not stops. An item that holds links, buttons or scroll boxes of its own — a journal's decision, a convention — is gated (`gate`): those take Tab only while focus is inside the item, so the list stays one stop however much its items hold; the focused item wears the inset ring. Serves Conventions 8.

### Object Address — `useReveal`, `AddressLink`, `AddressMenu`
An object a list holds by its number — a journal's decision, a run's convention — has one address form on every such list. Its number is a link to its address (`AddressLink`: tabular, underlined like every link, in the ink around it), opened in place with the key replaced; a right click, the menu key or Enter on the object opens its menu, «Скопировать адрес решения» / «адрес соглашения», which copies the whole URL (`AddressMenu`). An address brings its object to the top of the list's own scroller, 8 px under its top — under a sticky heading in that scroller (a convention's group, 32 px), the heading's height + 8 px, passed as `useReveal`'s `gap`, since `revealIn` sets `scrollTop` and reads no scroll padding; the scroller carries that height as `scroll-padding-top` for the focus ↑/↓ moves alone —, marks it with the target mark and moves focus to it (`useReveal`, `revealIn`): only that scroller moves — never `scrollIntoView`, which scrolls every scrolling ancestor up to the page's body and takes the toolbar out of view — and an address the user set by clicking the object's own number leaves the object where it stands. «Отчёты» brings things into view the same way: the rail's open report by as little as shows it (`nearest`) — one above the rail's view or under its sticky 28 px stage heading to the heading's foot, 8 px clear (`gap` 28 + 8, the rail's scroller padded the same) —, a heading of the report's outline under the parts' sticky strip (`gap`), and «Расход токенов» from the overview's lead, 8 px under the reader's top. A list's scroller is `SCROLLER`, `relative` among its classes, so it is the containing block of everything in it: an absolutely placed part deep in the list (the screen reader's «нет значения» under «—») is clipped and scrolled with the list and never hangs below the view to give the page's body an overflow. Serves Strict 1, Layout 2, Conventions 12.

### In-View Strip — `InView`, `useInView`
«на экране #40–#42» in «Журнал», «на экране 12–17» in «Соглашения»: which items of a numbered list its own scroller shows — the first and the last a line of which (20 px) shows, below the list's sticky heading where it has one — in the list's own number form (`numberRange`), in the status bar's `counts` slot. The items are the elements marked `data-<kind>`, measured before paint and on every scroll and resize. Its box is reserved from the first paint at the widest form the list can take — its highest number at both ends, plus 2 ch — so nothing beside it moves when the range is known or changes; nothing in view leaves it empty in that box. Serves `table #8`, Strict 1.

### Held-Order Strip — `HeldStrip`
One line at a live list's end, its 28 px always reserved: «2 новых прогона · 1 прогон сместился · показать», the verb naming the click — «показать», «убрать», «обновить список»; a narrow host (below 28 rem) reads the compact form without the noun. A row that left is named in the host's word (`leftKind`): «вне фильтра» where a filter or a search took it out, «пропал» — agreed, «1 прогон пропал», «3 прогона пропали» — where the list has no filter (the sidebar's runs). Muted ink, a hairline above, a polite live region. A unit's open detail in «Юниты» holds a strip per list — the findings it closes, its launches, its checks — in that section's 28 px heading line, beside the heading and without the hairline: the lines it opened with update in place, a new one waits there («1 новый запуск агента · показать») until the click places it. Serves Live data 1–2, Conventions 4.

### Change Marks — `markProps`, `OutOfFilter`, `useEdgeMarks`
The edge mark and the target mark (Elevation), and «вне фильтра» in muted small text on a row the filters hide but a link or a live change keeps. Which rows carry the edge mark is one hook, `useEdgeMarks(version, rows, id, sign, now)`: a view passes its own sign (what a change of the run moves on its rows); the first read marks nothing, and a mark ages out after the fresh write's «last minutes». The open row's frame is one export beside them, `OPEN_FRAME`: a 1 px inset frame in muted ink (`muted`; ink on a link's target, `target`), the open row drawing its top and sides (`row`), its detail its sides and bottom (`detail`), the theme's `--shadow-open-row` and `--shadow-open-detail` beside `--shadow-edge` and `--shadow-target` — read by the data table and by `ExpandingFindings`. Serves Conventions 9, 12.

### Loading — `Loading`
«Загрузка…» in muted ink with the library's spinner, centred in the region it fills, `role="status"`; a table's first load draws it in a bordered frame over the whole region. Never a skeleton. Serves Strict 2, Tables 2.

### Empty State — `EmptyState`
The library's empty, unbordered, muted: «Юнитов ещё нет — они появятся на этапе «декомпозиция»» (the stage word from the shared map), «В этом прогоне не было находок», or «Нет находок, подходящих под фильтры» with the active filters and «Сбросить фильтры»; under a named «Вид» with filters of its own (`view`), the view names itself and what fills it — «В виде «Заблокированы» нет юнитов», «В вид входят: заблокирован. Фильтры: Поиск: «…»» — its states its own `detail`, else its filters' values in their options' words (`presetFills`), then the search and «Сбросить фильтры» (Conventions 16). Which of the first two a view shows is one rule, `emptyWhen(run, step)`: a closed or init run never had it, otherwise it is still to come at the stage that fills it — and a list its stage fills once a pass (the conventions) never comes once the run is past that stage; the stage order is `STEPS`, read from `fsloopui/shared/states.ts`, its one home. Serves `ui` → Empty states, Conventions 15.

### Part Failed — `PartFailed`
The library's alert, content-width: an amber dot, «Отчёт critique-3.md не прочитан: <причина>», and «Повторить» only where a retry can change the result. What a reading view could not read comes from one module beside it, `src/ui/failure.ts` (exported from `@/ui`): `fileFailure` — a file of the run named in its errors, `folderFailure` — a run folder with no `run.json` behind it, whose empty lists are a failure and never «ещё нет», and `baseName` — the file's name for the message. Serves Conventions 4, 14.

### Select and Combobox — `CountSelect`, `CountCombobox`
A select (at most 7 options) and a combobox (popover + command, searched in its field, 10 rows in view) whose triggers read «Поле: значение» and nothing else, and whose options carry their count in a right-aligned tabular slot, a zero muted — in the open list only, never copied into the closed trigger. An option whose label carries more than the trigger should repeat gives the trigger its short form (`short`): the narrow «Отчёт» picker's options name each report with its stage and state, its trigger the report alone — «Отчёт: critic craft» — and, with nothing chosen, «Отчёт: обзор». An option may carry a muted second part (`detail`) after its label and « — », in the open list only: one line, cut at 18 rem with its whole text in its title, never part of the label — a highlighted option takes the library's ink throughout. Serves `ui` → Choosing from a list, Widths; `table #11`; `ux 2`.

### Choice Toggles — `ChoiceToggles`
One of a few words to pick — the user's verdict, a report's severity filter: the library's outline toggle group, 28 px, one Tab stop and ←/→ between the choices, its words in regular weight. The pressed item is filled in ink with paper text, its hover too; the style is keyed on the item's own `aria-checked`, because a tooltip around an item writes its own `data-state` over the item's. A choice with a key (`keyCode`) shows its cap in that toggle's own tooltip, opened by its own hover and focus — a verb and its object, then the cap: «Оценить клавишей 1»; a group without keys has no tooltip. Pressing the pressed choice again is a choice of it (a verdict saves its note). Serves `ui` → Tooltip, `rules/ui` → Conventions 11, Strict 1.

### Menu — `Menu`, `copyItem`, `copyLabel`
The one menu of the product, the table's row menu included: the library's dropdown and context menu over one item set. An optional header names what the menu acts on — one muted line, truncated, the full text in its title — then the groups, split by a rule; items read «Открыть <объект>» and «Скопировать <что>» (one builder, `copyLabel`); a shortcut sits at the item's end as `Kbd`; a choice of one value is a submenu of radio items; an item that cannot run now but may later stays listed, disabled, its reason in its title. Serves `table #4`.

### Dialog — `AppDialog`
The library's dialog: a title always, the body scrolling inside an 85 vh cap, the footer's actions at content width on the right, ✕ last in the focus order; focus returns to the opener. Serves `ui` → Dialogs, `ux 7`.

### Tooltip and Glossary — `Hint`, `GlossaryTooltip`
The library's tooltip, ink ground, plain text only: an icon-only control's name with its shortcut as `Kbd`, or a glossary on a term's dotted label — at most 8 entries of at most 80 characters, «value — meaning». Serves `ui` → Tooltip, Glossary.

### Toast and Copy — `notify`, `copyText`, `AppToaster`
Sonner at the bottom right: a success leaves on its own; a failure stays until closed, its cause under the title and one action beside it. Titles stop at 60 characters. `copyText` copies (a selection joined by newlines) and says «Скопировано: <что>». Serves `ui` → Toast.

### Keys — `Keys`, `useShortcut`
`Kbd` caps named from the physical key code («/», «Esc», «←»); the shortcut hook binds by `event.code` and stays off in a text field, with a dialog open, on a key repeat and with a modifier. Serves Conventions 11.

### Browser Storage — `usePref`, `readPref`, `writePref`
One module, read synchronously so a persisted value is on first paint, every access guarded; it holds folds, «Подробнее», the pin and view state. Serves `ui` → Persisted preferences, Tables 4.

### Data Table — `DataTable` (`fsloopui/src/table/`, exported from `src/table/index.ts`)
One table for every list of a run, built on the library's table with `@tanstack/react-table` as its column model; a view passes columns, filters, «Вид» presets, the search's fields and row actions as module-level configuration. Density is set here once: header and row 32 px, cells 8 px across, the header in small muted type, sticky on the table; one line per cell, truncated, the full text in the cell's title. A fixed layout: each column a fixed width that clears its header, its sort icon and its widest ordinary value, one width-free column taking the slack, a 32 px checkbox column first; the table's floor is their sum, and a narrower region scrolls sideways in the table's own bordered, height-bounded box with `scrollbar-gutter: stable`. A variable column carries a resize handle — a permanent hairline at its edge that thickens on hover, focus and drag; ←/→ nudge 16 px, a double click resets. A sortable header's icon stands in the header's muted ink at full strength, idle or not, so every sortable column reads as one. Rows: hover and the row a menu opened on take the muted ground, a selected row the muted ground, the focused row an inset 2 px ring in muted ink — on every focus, a mouse click's too, so the row the verdict keys 1–4 will rate is always marked; ↑/↓ move that focus inside the table's own box through `revealIn` — a row under the sticky header to 8 px below it, a row past the box's end by as little as brings it in, a row in view not at all — never `scrollIntoView`, which would scroll the page around the table; the edge and target marks as above; a row the filters hide but a link or a live change keeps reads «вне фильтра» at the end of its width-free cell. A row that expands shows it: a chevron before its name (in the width-free cell, or at the row's end when that column is hidden) turns as the detail opens, a click on it opens the detail whatever action is pinned, and the row's cursor is the pointer. A row expands in place under itself across the table's width on the muted ground; the open row and its detail are one block inside a 1 px frame of muted ink — `@/ui`'s one `OPEN_FRAME` (Change Marks), the frame `ExpandingFindings` draws too; the row draws its top and sides, the detail its sides and bottom — because the muted ground alone is about 1.1:1 on the dark paper, and the frame clears 3:1 on both; a link's target keeps its ink mark on the row, and the ink frames its detail too. Several stay open. A row a link names, and a row the user expands — or the caller opens, as the verdict keys open the next row — whose detail would run past the box's end, is scrolled to the top of the table's own box, under the sticky header, once its detail renders — the page around it stays put. A link's row is placed again on the final layout: «по экрану» measures the box only after the first render, so the page first formed at 50 rows re-forms around the link's row — never around the page's first row — and the row is scrolled under the header once more. While rows or a detail run past the box's bottom edge — the box scrolls (`scrollHeight > clientHeight`) and is not at its end — a hairline of muted ink marks that edge, an inset shadow drawn over the box (`overflow-cue`), never a border or padding, so it takes no room. A list's one-line notice — its not-found line — has its slot under the toolbar (`notice`), 28 px reserved while it holds one. Below the table: the held-order strip's reserved line, then the status bar. First load: the framed spinner in the table's place; empty: the empty state centred in the same bordered box — under a named «Вид» with filters of its own, the view's form (Empty State). The query — sort by a column's rank, filters with counts over the set without their own filter, search with identifier tokens OR-matched and free text AND-matched, paging — runs in `query.ts`, never in a view. Serves `table #1–15`, `rules/ui` → Tables 1–5, Live data 2–3.

### Adaptive Toolbar — `AdaptiveToolbar`
One 28 px line: «Вид», the search (flexible, at most 20 rem — or its floor where that is wider), the filters, then the right cluster — a view's own pinned end (`toolbarEnd`: the toolbar facts), then, in a table whose rows expand, the kit's «Свернуть все <noun>» (`CollapseAll`, `src/table/collapse-all.tsx`; the table's `collapseAll` names the rows: «Свернуть все находки», «Свернуть все юниты»), an icon-only 28 px button always shown in its box — while no row is open the blocked action, dimmed, focusable, inert, its tooltip the one reason «Нет открытых строк — откройте строку» — then the columns menu. It measures its own box — a container, never the viewport — and the pure `pack.ts` folds ordinary items right to left into «…», then sticky ones; pinned ones never fold. The search counts at its floor (`flexFloor`): its chrome plus its placeholder whole, measured on the field's invisible copy of it, never under 12 rem; a floor past the 20 rem cap raises the field's cap to it — so the filters fold into «…» before the placeholder is cut, and a placeholder longer than the cap («Задача, решение, пример, правило») is still whole. A filter's trigger hugs the value the user picked — «Поле: значение», no count — so «Серьёзность: все» carries no empty interior; the change it makes is the user's own. «Вид» alone keeps a box, because a filter changed by hand turns it «Свой набор» and would otherwise push the filter clicked: the widest of its values, measured by the browser — each value an invisible sizer in the trigger's chrome — and its trigger fills that box. «…» opens a popover of full-width rows (↑/↓, Home/End) and carries a neutral dot while a folded filter holds a value. Serves `table #14`, `ui` → Widths.

### Search with History — `SearchBox`
The library's input group: a search icon, the field whose placeholder names the fields searched, the `/` cap where `/` focuses the field — none in the sidebar, where `/` stays the view's search — (hidden, its box kept, while the field is focused or filled), a clear button (its box kept when empty) and the history button; an invisible, unread copy of the placeholder (`data-flex-sizer`) gives the toolbar the field's floor; Enter or leaving the field keeps the term in the table's history of eight, ↓ opens it. A hit has one painter, `Highlight` — a `mark` on the muted ground, underlined, its corners rounded, so nothing moves — used by a table's cells and by every view that searches running text, through the text's `highlight`, in all the text the search looks in and nowhere else. Serves `table #12`, `rules/ui` → Conventions 11.

### Filters, Columns Menu, Row Menu
A filter over at most six values is u2's `CountSelect` with «все», a longer one u2's `CountCombobox` of several values; «Вид» is a `CountSelect` of presets with «Свой набор» while the filters match none; a preset that holds several states names them as its option's muted second part (`Preset.detail`, from the view's own state map: «В работе — пишется, проверяется, отладка, вливается», «С возражением — не согласен, не та серьёзность, ложная находка»), while its trigger and its box's sizers read the labels alone. The columns menu is an icon-only trigger to a popover: a list (`role="list"`) of a checkbox row per column (the primary one «всегда виден»), drag or Alt + ↑/↓ to reorder, «Делить строки на страницы», and «Сбросить столбцы и страницы» only while something differs. The row menu is u2's `Menu` as a context menu over the body: a header naming the row or the selection («12 находок», «28 из 30 находок»), the view's items marked single or multi — an item whose object can never exist on the rows (no unit, no report) is not listed at all — then «Действие по клику» — the pin a left click and Enter run, kept in the browser. Serves `table #3`, `#4`, `#11`, `#13`.

### Status Bar — `StatusBar`
The bottom strip of every view, 32 px, small muted type with tabular numerals: the pager («‹ стр. 3 из 15 ›» and «Строк: по экрану / 50 / 100 / все» — «по экрану», the default, holds as many collapsed rows as the table's box shows, measured from a collapsed row before the first paint and on every resize, keeping the page's first row in view — a link's row instead, while it is on the page) or the counts strip, then «128 из 723 находок» (the noun genitive after «из»; «723 находки» when nothing is filtered out), then a list's selection «Выбрано 3 находки» in ink, in a place as wide as its widest three-digit form — measured by invisible sizers of «Выбрано 111 / 222 / 555 <noun>» under the text — and reserved before anything is selected — only in a list that selects — then «обновлено 5 мин назад» at the right end with the full МСК time in its title. That order is the default; a view passes its own as `order` — the slots from the start, then the slots packed at the right end («Юниты»: the total, the strip, then the selection and the age at the end) — and never reaches into the bar's slots. The age and the totals never shrink. The counts strip (`strip`: its forms, `StripForms`) goes compact by one rule, `stripFit`, on its own room — the bar less its other slots, measured with the selection's reserve and the age — against its forms' widths, measured on invisible sizers before the frame paints: every state when they fit whole; else the view's groups («Юниты»: the «Вид» presets — «заблокированы 1 · в работе 2 · не начаты 9 · закоммичены 30», each titled by the states it holds); else the leading groups that fit and «ещё N <noun>» for the rest, fitted at its widest three-digit form and titled by what it folds. Every entry (`StripCount`) is always its dot, its word and its count — nothing is clipped and nothing goes wordless; at 1440 px and at 1280 px «Юниты» reads the groups, at 900 px the fold. A view's own strip (`counts`: «на экране …» in «Журнал» and «Соглашения», the shared `InView`) clips in its own box. Each number keeps a three-digit box. Serves `table #8`, `#10`, `ui` → Page chrome.

### View State — `useTableView`, `useRunView`
Through the one storage module: sort, columns, widths, page size, the page split, the pin and the search history per table id; filters and search per table id and run. The page and the open rows live in the URL, owned by the caller; the selection in memory. Serves `table #7`, `rules/ui` → Tables 4, Conventions 12.

### Finding Row — `FindingRow` and the cells (`fsloopui/src/finding/`, exported from `src/finding/index.ts`)
A finding reads the same on every surface. In «Находки» it is a table row: «Серьёзность» (dot + word, «не записано» with a neutral dot when the critic named none), «ID» (the local id in mono, the full id in the title), «Находка» (the first sentence as written, the width-free column; a loose line's raw text; on a row with frames, a picture icon and their number right after the sentence — «2 кадра» in its title and for a screen reader — which keeps its width while the sentence truncates), «Отчёт» (the compact launch name, «прогон» for the run's own finding; sorting by it reads the run's reports in order — the stage's rank, then the run's own order), «Состояние» (the state's dot and word, then its unit: «исправляется · u3»), «Оценка» (the user's verdict, «—» before one). «Место», «Уверенность», «Охват», «Этап» are in the columns menu, hidden by default. Elsewhere — a report's findings and each group of its «Сравнение», the findings a unit closes — the same parts make `FindingRow`, one 32 px line: severity · id as a link to the finding · sentence · state, in fixed widths so rows align; such a list is one shared part, `ExpandingFindings` (`src/finding/expanding.tsx`): each row behind a chevron, a flat list with one Tab stop on the chevrons (↑/↓, Enter opens or closes; the id's link leaves the Tab order), a click on the row's own text toggles it, and an open row expands in place under itself into «Открыть в находках» and the finding article, read-only, several open at once; an id the run lacks reads «находка … не найдена» with no chevron. An open row and its detail sit in the table's 1 px frame (`OPEN_FRAME`), in every host, never on a ground of their own. `ruled` — a report's list on the page's paper — draws a hairline between rows and a muted hover; a unit's detail, already on the muted ground, draws no hairline, and its row's hover (ink at 4 %) and the chevron's hover and open ground (ink at 8 %) step off that muted, where the ghost button's own muted would show nothing. In a unit's own detail a row's state leaves that unit out — «исправлена», not «исправлена · u22» (`unit`). Serves `rules/ui` → Conventions 1, 4, 8, Tables 3, 5.

### Finding Article — `FindingArticle`
What a finding's row expands into, on every surface: a fact line split by «·», each «·» ending the fact before it inside that fact's unbreakable box, so a wrapped line opens with a fact, never «·» — the severity in full only where no row above shows it (a row's detail leaves it out), the critic's enums in Russian words that name what they are («критик скорее уверен», «правка в общем компоненте»; the raw value and its meaning in the title), «отчёт» and the report as a link, «этап» and the stage with its pass, «место» and the place in mono with a copy button («не записано» where the line named none) — then the text as the critic wrote it: «Наблюдение», «Правка» (its `/impeccable` command as code), «Вопрос, который закрывает правка», «Правило», or one «Текст находки» where the line has no split; never a section twice. Beside it, from a 52 rem container, a second column: «Решение прогона» (the state in full, the run's decision where it reads otherwise, each unit as «u3 «title» — закоммичен» linked to the unit, a duplicate's or a repeat's finding, the run's why), then «Ваша оценка» — the verdict control in «Находки», elsewhere the saved verdict read-only («согласен · 19:41 МСК»), nothing before one. «Кадры находки» last, as the frame strip. Section headings are small muted type; the text keeps its measure. Serves `rules/ui` → Tables 3, Layout 5, 7, `ux 0`, `ux 2`.

### Verdict Control — `VerdictControl` (`fsloopui/src/views/findings/verdict.tsx`)
The user's one write, one control in two orders. In the detail, under the article's heading «Ваша оценка»: a reserved one-line status — the saved verdict «согласен · 19:41 МСК», or «Оценки ещё нет — выберите одну» — then the four verdicts as the shared choice toggles (`ChoiceToggles`), the pressed one filled in ink, then the note «Заметка к оценке» (a fixed 64 px field that the user may drag taller, up to 160 px; its placeholder says it is optional) and under it a reserved 24 px status line: «Заметка не сохранена» with «Сохранить заметку» while its text differs from the saved one, or «… — она сохранится вместе с оценкой» before any verdict. Keys 1–4 set the verdict of the finding in focus — its row or anything in its detail — with its note, then move focus to the next row of the page with no verdict, opening its detail in place of the rated one's when that was open; each key's cap shows in its own toggle's tooltip, «Оценить клавишей 1» … «Оценить клавишей 4», opened by that toggle's hover and focus. The «Оценить…» dialog, over one finding or a selection, is note-first: the note, then the status line («Ваша оценка: согласен · 19:41 МСК» or what choosing does) and the toggles; a choice saves and closes; it has no keys — its note takes them. Choosing a verdict is the save: optimistic, no pending state; choosing the pressed one again saves a changed note. A failed write puts the row back, keeps the note and raises the failure toast with «Повторить». Serves `rules/ui` → Conventions 6, 11, Strict 1, `ux 4`, `ux 6`.

### Sidebar — `Sidebar`, `RunCard`, `MiniRow` (`fsloopui/src/app/`)
Under the head, the shared search over project, id and goal — every word must match; placeholder «Проект, id, цель»; no `/` cap, `/` stays the view's search — its terms in a history, the query itself kept for the visit; no match is the filtered empty state with «Сбросить фильтры». The running runs are full cards; the long-silent, closed and unrecorded ones are folds of mini rows, each fold's header one 32 px row with its hairline on the trigger, open or closed as last left. A mini row is one 32 px line — project · id · its state, 4 px apart — with no clock time on its face (the time, named, is in its title). The project keeps its whole word and gives way only past 35 % of the line, an outlier; the state reads «fact · cause» — the liveness or the outcome kept whole, what waits after it («молчит · 7 ч · красный гейт · заблокирован u23») cut at its end; each on the dot of its own tone, the liveness's as the run header's «Активность» shows it, the wait's amber where the wait begins («● работает · ● красный гейт · заблокирован u23»), the « ·» and that dot keeping their place — so at the 316 px sidebar the widest project of this machine's runs, the id and «цель не достигнута» stand whole on one line. A closed run's mini row is two reserved lines, 48 px, its height from whether the run is closed: the goal's outcome alone («цель достигнута» / «цель не достигнута»; the push when no goal was judged), then «коммиты не отправлены» when they were not (a pushed run's push is in its title), «<N назад> · <goal>» — no «закрыт», which the fold's header «Закрытые» says, so the goal keeps its first words at 316 px — muted and truncated; in the narrow band it is one 32 px line, that second line following the outcome as its cause. A run changed since the operator last opened it reads «новое» in a full card's reserved slot, and on a mini row as the edge mark. Serves Conventions 8, 9, Strict 1.

### Run Page Header — `RunPage`, `Identity`, the run's facts (`fsloopui/src/app/`)
The identity, the goal clamped, and one `FactList`: the outcome rows (Этап; Активность and «Ждёт вас» while the run is open; Юниты; Итог once it closed), Настройки, then behind «Подробнее» — Начат, Длительность, Запуски агентов, Токены (the agents' launches and the run's sessions together, compact, the split in the title), Проходы (only where the run has N passes, the finished passes read from the card, so the row stands whole from the first paint and never loads), Коммиты, Зеркало .spike, Рабочая копия, Сессии, Папка прогона, Версия run.json. «Активность», «Ждёт вас», «Настройки» and «Проходы» carry their glossary on the label. «Ждёт вас» is a box at least two lines and at most six high, its height set from what it first holds and kept through live changes; the causes that start past its last line are counted on that line, «ещё N · показать», a button that releases the height and moves focus to the box, which then scrolls. A run that closes while its page is open keeps the header at the height it had running, until the operator's «Подробнее» or a new width. Serves `ux 9`, Layout 3, Strict 1, `ui` → Glossary.

### Role Map

The roles of `law/ui.md` → Roles, as fsloopUI fills them:

| role | component |
|---|---|
| primitives | the shadcn/ui library, `fsloopui/src/components/ui/` |
| status dot | `StatusDot` (`src/ui/status-dot.tsx`) |
| glossary tooltip | `GlossaryTooltip` (`src/ui/tooltip.tsx`) |
| blocked action | `Hint` holding the reason, on a control that stays focusable |
| confirm dialog / confirm button | — (fsloopUI has no destructive action) |
| toast | `notify`, `AppToaster` (`src/ui/toast.tsx`) |
| empty state | `EmptyState` (`src/ui/empty-state.tsx`); a table's variant — the same part centred in the table's bordered box, «Сбросить фильтры» resetting filters and search — is `DataTable`'s |
| fact list | `FactList` (`src/ui/fact-list.tsx`) |
| page header | the run page frame (`src/app/`, u3) |
| adaptive toolbar | `AdaptiveToolbar` (`src/table/toolbar.tsx`, packing `src/table/pack.ts`) |
| status bar | `StatusBar` (`src/table/status-bar.tsx`), on every view, with a table or without |
| data table | `DataTable` (`src/table/data-table.tsx`): query `query.ts`, columns `columns.ts` and `columns-menu.tsx`, row menu `row-menu.tsx`, search `search.tsx`, filters `filters.tsx`, view state `view-state.ts` |
| what's-new registry | — (none kept) |

## Do's and Don'ts

### Do:
- **Do** take a state's word and tone from its shared map, through `StatusDot`.
- **Do** reserve every late part's box: a count's three digits, a strip's line, a thumbnail's 118 × 74.
- **Do** show «Загрузка…» with a spinner, centred, in a region already at its final size.
- **Do** keep running text at its measure, and let a table inside it scroll sideways.
- **Do** set ids, paths and commands in mono, and what a critic wrote as written.

### Don't:
- **Don't** use a skeleton, anywhere; the library's `skeleton` is never imported.
- **Don't** colour a state as a badge, a fill, a border or a word; never a pulse on «работает».
- **Don't** write a raw colour, radius or size in a component; the theme's token is the answer.
- **Don't** bold the active tab or anything that toggles: a weight change shifts its neighbours.
- **Don't** put content in a tooltip, an object in a side panel, or an event the operator did not start in a toast.
