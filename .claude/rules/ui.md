---
paths:
  - "fsloopui/**"
  - "PRODUCT.md"
  - "DESIGN.md"
---

# fsloopUI — interface rules

## Scope

Governs everything under `fsloopui/`: the React client, the server's routes as far as they shape what the page shows, and the shared state maps and text functions both read. The base is the fsloop law — `skills/fsloop/law/ui.md`, `ux.md`, `table.md`; precedence — `law/ui.md` → Precedence. This file states only the decisions of this product: where the law is silent, or where it says otherwise and this file overrides it (marked *overrides*). Users, voice and the glossary — `PRODUCT.md`; tokens and the look of components — `DESIGN.md`. Cite a rule as `rules/ui` → <section> <number>: `rules/ui` → Live data 3.

fsloopUI is local, single-user and read-mostly: no sign-in, no roles, no money, no destructive action. Its one write is the user's verdict on a finding (Conventions 6).

Law rules with no object here, so a critic raises no finding from them: `code` → i18n (one language, no message catalogs); the «…ing» pending label of `ui` → Every async action surfaces its full lifecycle (the one write is optimistic); in `ux 1`, a setting's name and a disabled action's reason (the product has no settings and no disabled action).

## Strict

The user's own rules, stated in his words; they outrank every other rule of this file and every default of the library. A breach is a major finding, never a candidate.

1. **No layout shift** — markup that causes a layout shift is forbidden. Nothing on screen moves because something else loaded, arrived or changed state: an image, a frame thumbnail, a count, a badge, a strip, a toolbar item, a font, a scrollbar, a row's detail, a live update. Every element that appears later has its box reserved before it appears (fixed width and height or an aspect ratio; a reserved line for a strip or a status; `scrollbar-gutter: stable` on a scrolling region; tabular numerals and a fixed width for a count that changes); a loading state has the size of what replaces it; a live update changes values in place and never inserts above what the user reads (Live data 1–3). The only movement allowed is the one the user causes by their own click — expanding a row, opening a fold — and it never pushes the element they clicked.
2. **No skeletons** — a skeleton as a loading state is an anti-pattern and is never used, for a table, a card, a text or a page. A loading state is the word «Загрузка…» with a spinner, centred in the region being loaded, the region already at its final size (Strict 1), `role="status"`. The library's `skeleton` component is not imported anywhere in the product.
3. **Frames in the dark theme only** — shooting the light theme is forbidden. Every frame of the product — a baseline, a final frame, a frame after a fix, a picture for a report or a README — is taken in the dark theme: no capture command names the light theme, and a surface is judged on its dark frame. The light theme stays in the product and is held by the theme's variables and the tests (Components 3), never by a frame. A light frame taken before this rule stays in its run folder as it is; none is taken again.

## Components

1. **shadcn/ui is the component library** — fsloopUI is a shadcn project: `fsloopui/components.json`, Tailwind, every component of the library added as source under `fsloopui/src/components/ui/`. Work on a component goes through the `shadcn` skill (`~/.claude/skills/shadcn/SKILL.md` with its `cli.md`, `customization.md`, `registry.md`, `rules/`) and its CLI, `npx shadcn@latest` run in `fsloopui/` — `docs`, `search`, `view`, `add`, `diff`.
2. **A library component first** — a shared part is built from the library's component for its job (table, command, dialog, dropdown and context menu, select, combobox, tabs, tooltip, sonner, scroll area, collapsible, pagination, kbd, empty, spinner, badge, skeleton …) before anything is written by hand; a hand-made part where the library has one is a defect. A product part composes library components in its own file and never edits a file under `components/ui/` for one screen's sake.
3. **The world is the theme** — the product's look lives in the theme's variables (`DESIGN.md`): the library's semantic tokens (`background`, `foreground`, `muted`, `border`, `primary`, `destructive` …) carry the product's values, light and dark. No raw colour, radius or font in a component; no second token set beside the theme's.
4. **The law outranks the library's defaults** — where a component's default form breaks this file or the fsloop law (a status as a filled badge instead of the dot, skeleton rows where Tables 2 asks for the framed spinner, a tooltip holding content, a side sheet holding an object), the product uses the form the rule names.

## Layout

1. **The shell** — two regions: the sidebar of run cards at a fixed width, and the opened run's page in the remaining `minmax(0, 1fr)`. The shell grid owns the only viewport breakpoint: below it the sidebar becomes a band above the page with its own capped height. Every region (sidebar, run header, view body) is a size container; a component adapts by container queries to the region it sits in, never by the viewport.
2. **Every object has an address** — a run, a view of it, a critic's report with its tab, a unit and a finding open by URL. Back returns to the place in the same state: filters, search and sort from the view's persisted state (`table #7`), the open object and the page from the URL. No modal and no side panel holds an object.
3. **The run's page — `ux 9` for a run**:
   1. *Identity* — project · run id, the goal (clamped, Layout 6).
   2. *Outcome* — stage · pass k of N · since when, the run's liveness (Live data 4); a red gate or a blocked unit is an outcome row, not a fact.
   3. *Verdict* — only for a closed run: goal met or not, pushed or not. A running run has none; the row is not invented.
   4. *Facts* — the run's settings (mode, passes, units at once, models), started, agent launches, commits — label–value rows; the ones the user decides by least fold behind one «Подробнее» row at the table's end, open or closed as the user last left it.
   5. *Product* — the findings, the units, the critics' reports: the page's body, as its views (Layout 4).
   6. *Provenance* — the journal of decisions and the run's conventions: their own views, reached from the page, never in its first viewport.
4. **The views of a run** — Находки, Юниты, Отчёты, Соглашения, Журнал: one tab strip with a count on each, the chosen view in the URL (`?view=`); a report's own tabs likewise (`?tab=`). The prototype's A/B/C variants are these views, never a chooser.
5. **Running text keeps its form** — a finding's rule, observation and fix, a report's sections, a journal entry are running text: line breaks, lists and inline code kept, at a capped reading measure. `table #10` (one line, truncated) governs a row's cells, never the detail a row expands into or the report reader.
6. **Expand on click** — a clamped text (a run's goal on its card, a long observation) shows its trigger only when the clamp actually hides something; otherwise it is plain text. The expanded text lives in a region with a height cap that scrolls inside.
7. **Frames** — a thumbnail reserves its box before the image loads, so the list never shifts. A frame opens in a viewer over the page, named by its file; it steps through the frames of the same finding (report) by ‹ ›, ←/→ and the wheel (`ui` → Wheel); Escape closes it and focus returns to the thumbnail.

## Conventions

1. **A state is one map** — every enumerated state (run stage, run liveness, unit state, finding severity, the run's decision on a finding, the user's verdict) has one map beside its enum: value → label, compact and full form, tone, severity rank, glossary meaning. Every surface — card, header, cell, filter, sort, glossary — reads that map; no surface writes its own words for a state. A cell reads the compact form as the status dot + «state · age · cause», cause last so truncation cuts only it; an object page's fact reads the full form.
2. **Tones** (`ux 8` refined) — green: done (a unit committed, a closed run's goal met). Red or amber: only while the run waits for the user or the user should check it (a red gate, a blocked unit, a run silent past its threshold). Work in progress — writing, verifying, fixing, landing — is neutral: the run carries it, nothing is asked. Severity is the one category with a tone — critical red, major amber, minor neutral — because it ranks what the user reviews first.
3. **One fact, one reader** — a fact shown on several surfaces (a run's last activity, unit counts by state, a finding «fixed» when all its units are committed) is computed once, where the run folder is parsed; card, header, counts, filters and sort read that result, and the client never recomputes it.
4. **No false state** — a field the run folder lacks or the parser cannot read reads «не записано» with a neutral dot: never a guessed value, never a positive one. «закоммичен» only from the run's own record; «работает» only from a fresh write (Live data 4).
5. **Absent values** — one shared part each for «—» (no value exists) and «не найден» (an id the run names but its folder does not hold: «юнит u7 не найден»); a finding with no unit shows its decision word («кандидат», «без решения»), not «—». No surface styles its own muted span.
6. **The verdict** — the user's one write, to the run's `human.jsonl`: «согласен», «не согласен», «не та серьёзность», «ложная находка», with an optional note. It is set from the finding's row menu and from its expanded detail; on a selection the menu sets it on every selected finding with one note (`ux 6`). It is the user's own state, so it is optimistic (`ui` → Toggles): the row shows it at once, no pending label. A later verdict replaces the earlier one; the saved one reads «Ваша оценка: <value> · <time>» — in the expanded detail as the heading «Ваша оценка» with «<value> · <time>» under it, the words never repeated (`ux 2`), and as the one line only where no heading names it (the «Оценить…» dialog). In the detail a choice saves and stays, so the toggles stand under the heading and the note follows with its own save; in the dialog a choice saves and closes, so the note comes first. A failed write reverts the row, keeps the note's text in its field and raises an error toast «Оценка не сохранилась: <cause>» with «Повторить» that stays until closed.
7. **Counts that link** — a count in the run header, a run card, a report's rail or a unit row links to the findings view filtered to it only when it is above 0 and the filtered list shows the same number; otherwise it is a plain number. A zero is a muted «0» beside a neutral dot — no link, no tone, never an empty state.
8. **Lists that are not tables** — the sidebar's cards and the report rail are one flat list with one Tab stop: ↑/↓ move, Enter opens. A card or rail item with an address is one link as a whole; nothing inside it takes focus — no link inside a link, a count inside is plain text.
9. **New and changed marks** — three kinds, no fourth: a run card changed since the user last opened it («новое»), a row changed in the last minutes (an edge mark), a «●» in the tab title when the open run changed while the tab was hidden. None carries a signal tone.
10. **Time** — every wall-clock time is Moscow time with its zone named: «19:41 МСК». A moment off today's Moscow date carries its date («15.11 23:40 МСК»), off this year the year too. A column of moments may name the zone once in its header and leave the cells bare. A past moment in a narrow place reads compact («5 мин назад»), the full МСК time in its title. A duration goes through one function — the largest unit from a minute up: «3 мин», «2 ч 05 мин», «1 д 4 ч», under a minute «меньше минуты» — never raw seconds or milliseconds. Live ages tick on one shared clock.
11. **Keyboard** — shortcuts bind to the physical key (`event.code`) so they work in the Russian layout. `/` outside a text field focuses the findings search; ↑/↓ and Enter in lists and tables (`ui` → Keyboard); Escape closes the frame viewer. The conditions — not in a text field, no dialog open, not a key repeat — live once in the shortcut hook, never at a screen. A shortcut shows as `Kbd` in its control's tooltip; there is no separate shortcuts page.
12. **The URL** — holds what identifies a place: the run (project + id), the view, the report and its tab, the unit, the open finding (`finding=<id>`), the table's page. Filters, search, sort and columns are view state (`table #7`), not URL. Opening a run, a view or a report pushes a history entry; expanding a row or paging replaces it. A link to a finding opens its run, expands it, scrolls to it and marks it; when the active filters hide it, it shows anyway, marked «вне фильтра».
13. **The run page's frame** — one frame for every view: header, first-load state, «not found» («Прогон <id> не найден: его папки больше нет в <корень>»), and a read error with «Повторить».
14. **A part that failed** — a file of the run folder that cannot be read fails in its own place: «<Что> не прочитан: <причина>» («Отчёт critique-3.md не прочитан: …»); the rest of the run shows. «Повторить» stands only where a retry can change the result.
15. **Empty because not yet** — a view empty because the run has not reached the stage that fills it names that stage: «Критики ещё не писали отчётов — находки появятся на этапе «ревью»». No runs under the root says which root and that a new run appears by itself.
16. **Views of a table** — a preset of filters is one «Вид» select, first in a table's toolbar, each item with its count: in «Находки» Все · Без оценки · С возражением · В исправление · Кандидаты · Закоммичены («С возражением» is every verdict but «согласен»); in «Юниты» Все · В работе · Не начаты · Заблокированы · Закоммичены. Choosing one replaces the filters and leaves sort, columns and search alone; filters changed by hand read «Свой набор». An empty named view names itself and what fills it.

## Live data

1. **The sidebar keeps its order** — run cards are one held order (`ui` → Live data): a card's state and counts update in place; a new run and a card whose rank changed wait in a one-line strip at the sidebar's bottom («2 новых прогона · показать»), in compact forms at the sidebar's width, and are placed on click.
2. **A row that left the filter is held** — a finding that a live change takes out of the active filter or search stays where it is, marked «вне фильтра», until the strip is clicked. The strip's verb names what the click does: «показать» (new or moved only), «убрать» (left the filter only), «обновить список» (both).
3. **What the user opened survives an update** — open findings and units, the scroll position, the focus, an open menu and the text in the search keep through every refresh; the user's own verdict places its row at once, outside the strip.
4. **A run's liveness comes from time, not events** — a stopped run publishes nothing, so no event can say it stopped. The server gives each run's last write time; one function turns its age into the state on the shared clock: «работает» (fresh), «тихо · 12 мин», «молчит · 3 ч», «закрыт». The thresholds live beside that function, once.
5. **Lost connection** — one strip in the shell above every view: «Нет связи с сервером fsloopUI · данные от 19:41 МСК»; the status bar's age counts from the last update; on reconnect the open run and the run list are re-read whole. While connected the shell draws neither the strip nor a «live» mark.

## Tables

1. **A run's findings are local** (*overrides* `table` → Tables are server-side, a *default*): a run holds hundreds of findings (the largest, 555), so the run's data arrives whole and sort, filters and search run in one tested client module over the full set — never over the current page, never re-derived per view.
2. **First load is a framed spinner** (Strict 2 for a table; *overrides* `ui` → Loading for tables): in the table's place a bordered frame over the whole region with a spinner and a muted «Загрузка…» at its centre (`role="status"`); under it an empty status bar of the same height, so the loaded table lands without a shift (Strict 1).
3. **Rows expand in place** — a finding's row expands into its detail under it (rule, observation, fix, the run's decision with its units, the user's verdict, frames); a unit's row into its findings. Expanding is the default pinned action («Открыть», `table #13`); several rows may be open; the detail spans the table's width and is running text (Layout 5).
4. **The pin lives in the browser** (refines `table #13`, `#7`) — a single user without an account: the pinned row action persists with the table's view state in browser storage; nothing is persisted on the server.
5. **A cell of a variable name and a short fact** — the name truncates, the fact keeps its width; the full text is in the cell's title. An outlier cuts the name, never the fact.

## Copy

1. **Russian, plain** — the interface is Russian, business register. What fsloop or a critic wrote — a finding's text, a rule, a file path, a command, a unit's title — is shown as written (English included), identifiers in mono: never translated, paraphrased or spliced into a sentence of the interface.
2. **Where the words live** — a word's label is in `fsloopui/shared/states.ts` (Conventions 1), its meaning in `PRODUCT.md` → Glossary; a surface takes both from there. Words the map does not hold yet: этап, юнит, находка, кадр, запуск агента, соглашение прогона, журнал решений; the user's verdict — «оценка».
3. **A number goes with its noun** — number first, agreed in number by one plural function («1 находка», «3 находки», «12 находок»; «2 юнита пишутся»); one noun per fact; a compact face may shorten, its full form from the same function goes to the title. Never «находок: 3».
4. **A string built by code is tested** — a test calls the function that builds it with the widest real input and compares with a literal written in the test, plus its word count; an exported constant is never compared with itself.

## Run conventions

fsloop runs append their design-check conventions here (`fsloop/ui.md` → Design check), one line each: pattern — decision — example (file, symbol) — rule.
