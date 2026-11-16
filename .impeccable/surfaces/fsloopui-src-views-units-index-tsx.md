---
version: 1
slug: "fsloopui-src-views-units-index-tsx"
primary_target: "fsloopui/src/views/units/index.tsx"
related_targets: []
---

LENS: shape
JUDGED:
- —
SHAPE:
- ANSWERS: «Что прогон делает сейчас и что уже сделал». The view answers it with the run's units: which are committed and with what commit, which are in work and for how long, which wait and for whom, which are blocked and why, and which findings each one closes. It also says which findings no unit takes. This is the run's Product (`rules/ui` → Layout 3.5, Layout 4; `ux 9`.5). The purpose is stated only by the prompt and by Reading's «the units», so it is an ASSUMPTION until u2 writes the Surfaces row in `PRODUCT.md` (`law/ui` → The law grows with the code).
- WALK: (1) The user opens the tab «Юниты» or a link `?view=units&unit=<id>`. (2) First load shows a framed spinner with «Загрузка…» and no skeleton rows (`rules/ui` → Tables 2). (3) The rows are read: state, what the unit does, commit, counts. The status bar's counts strip gives the distribution by state. (4) Expand a row with a click, Enter or the pinned «Открыть». It expands in place into facts, the findings it closes, its agent launches and its checks. Several rows can be open. The unit goes into the URL with replace (`rules/ui` → Tables 3, Conventions 12, Layout 2). (5) A finding in the detail expands in place into the shared finding article, read-only, with «Открыть в находках» above it, which opens its own address in «Находки». A count goes to «Находки» filtered by that unit (Conventions 7). (6) A live update arrives. A changed row keeps its place and gets the edge mark. New units (a new pass, new f<k>) and rows whose sort place changed wait in the strip «N новых юнитов · показать». Inside an open detail, the fact rows it opened with stay (a value that emptied reads «—»), each list keeps its lines and updates them in place, and a new line waits in its section's heading line («1 новый запуск агента · показать»). Open rows, scroll, focus and search survive (`rules/ui` → Live data 2–3, Conventions 9; `ui` → Live data). States on the walk:
  - not yet: «Юнитов ещё нет — они появятся на этапе «декомпозиция»» (Conventions 15);
  - none ever: a closed or init run with 0 units reads «В этом прогоне не было юнитов»;
  - filtered to none: names the active filters and offers «Сбросить» (`ui` → Empty states);
  - a part that failed: «Список юнитов не прочитан: <причина>» in the table's place. A missing brief reads «Бриф units/u3/brief.md не прочитан: …» inside the detail only (Conventions 14);
  - unknown ids: «юнит u7 не найден» for a blockedBy id, «находка <id> не найдена» for a closes id (Conventions 5);
  - an absent field reads «не записано», never a guess (Conventions 4);
  - a linked unit hidden by the filters shows anyway, marked «вне фильтра» (Conventions 12 applied to units);
  - lost connection is the shell's strip, not this view's (Live data 5).
- RANGES (Map table 5 and all 60 `run.json` on this machine):
  - units per run: 0 / median 14 / max 42. A run is mostly committed; drafted, ready and implement appear in live runs. 415 of 867 units are f<k> fix units, across passes 1–2;
  - per unit: title up to 287 characters; closes up to 28; launches up to 6; checks up to 31; a tree path in 107 of 867 units, «—» in the rest;
  - empty is 0 units (before decompose, init runs). Typical is a row like `u3 · 1 · committed 4c5237ca · Chat Creator campaign and page`, closes 8, blocked by u2. Volume is 42 rows with no pagination split (see ASSUMPTIONS).
- LEADS: the current pass's units first. The default sort is «Проход» descending, with ties in `units.md` order (u before f). A state change then updates a row in place and never moves it, so the live list stays still (`ui` → Live data). In each row the eye reads the state cell first: a status dot plus «состояние · возраст · причина», cause last (Conventions 1). The distribution sits in the status bar.
- ACTIONS:
  - Page main actions: none. The view is read-only, and live data makes Refresh dead chrome (`table` → Contract vs. chrome; `rules/ui` → Scope).
  - Toolbar: the adaptive toolbar holds the «Вид» select (Все · В работе — пишется, проверяется, отладка, вливается · Не начаты — черновик, готов к работе · Заблокированы · Закоммичены; Conventions 16), a «Состояние» filter (combobox, multi; counts over the unfiltered set; 8 states is more than 7, so a combobox per `ui` → Choosing from a list) and a «Проход» select, shown only when the run has more than one pass (`ux 2`). Then the shared search with history over id, sha and commits (identifier fields, OR-matched) and the title (free text), placeholder «Юнит, коммит, что делает» — each field by its column's header; a finding's id is searched in «Находки», whose row names its units. The toolbar folds the filters into «…» before the placeholder is cut. Then the columns menu (`table` #3, #11, #12, #14).
  - Toolbar facts on the right: «N кандидатов» and «N без решения». Each count is a link to «Находки» filtered to that decision when above 0, otherwise a muted 0 (`rules/ui` → Conventions 7; `ui` → Page chrome). This is how the view says what no unit takes.
  - Row context menu: header is the unit's id and title. Items: «Открыть» (the default pin, kept in the browser per `rules/ui` → Tables 4); «Находки юнита» (when it closes more than 0); «Копировать id», «Копировать коммит» (only with a sha), «Копировать путь брифа» and «Копировать рабочую копию» (only when tree ≠ «—»).
  - Selection: multi-select; copying ids or shas joins them by newlines (`table` #4, #5).
  - Destructive actions: none.
- ENTRY: nav group is the run page's tab strip (u3), label «Юниты», with the unit count on the tab (`rules/ui` → Layout 4).
  - Links in: the run header's unit squares and unit counts (u3) → `?view=units&unit=<id>` or `?view=units`; a finding's unit tag in «Находки» (u4) → `?view=units&unit=<id>`; the sidebar card's unit bar (u3) → the run's «Юниты».
  - Links out: each finding in a unit's detail → `?view=findings&finding=<id>`; the major+/minor counts → «Находки» filtered by unit and severity (Conventions 7, 12).
- BLOCKS:
  - toolbar: the adaptive toolbar, search with history, combobox and select primitives, the columns menu (`table` #14, #12, #11, #3);
  - table:
    - the shared data table, one for u4 and u5 (`ui` → Existing component first). Columns, each width fixed to its widest ordinary value unless noted:
      - «Юнит», mono, always visible;
      - «Проход», numeric, right-aligned;
      - «Состояние», status dot plus the compact form from the unit-state map, with a glossary for «готов», «проверяется», «чинится», «вливается» (≤ 8 entries);
      - «Что делает», the title: resizable, the width-free slack column, truncates with the full text in its title (`rules/ui` → Tables 5);
      - «Коммит», mono sha, 8 characters, «+N» when there are more commits, the shared «—» when none;
      - «major+» and «minor», numeric counts of the findings it closes, with a glossary on «major+»;
      - «Запуски», a numeric count;
    - per `table` #9, #10, #15 and `ui` → Glossary;
  - status bar: the total («42 юнита», or «N из M юнитов» when filtered), then the counts strip in the first form that fits its own room whole (`stripFit`): every state; else the «Вид» groups («заблокированы · в работе · не начаты · закоммичены», each titled by its states); else the leading groups that fit and «ещё N юнитов», titled by what it folds — every entry always its dot, word and count, nothing clipped or wordless (at 1440 and 1280 px the groups, at 900 px the fold) — then, at the right end, the selection and the data's age. This is the distribution (`table` #8);
  - expanded detail, in a capped region that scrolls (`rules/ui` → Layout 5–6):
    - the fact list (`ui` → Roles): Что делает (full title) · Вид (kind) · Ждёт (blockedBy, each id with its state, linking to that unit's address) · Причина (blockedWhy) · Рабочая копия · Коммиты · Бриф (path, mono);
    - each section's heading in the Title type in a 28 px line that also holds its held-order strip;
    - «Закрывает N находок»: the findings the run assigned to the unit — the brief's ids in order (an id the run lacks reads «не найдена»), then each finding whose units name it — the same set the row's counts and «Находки» under the unit's filter show. The shared `ExpandingFindings` list (`src/finding/expanding.tsx`), unruled on the detail's muted ground: u4's compact finding row behind a chevron, one Tab stop, ↑/↓ and Enter, a click on the row's text toggles it, an open row expands into «Открыть в находках» and the finding article, read-only and with no verdict menu (the verdict stays in «Находки»);
    - «Запуски агентов»: agent and description, model, start time in МСК, the state with its time through `launchState` («завершён за 9 мин», «работает · 12 мин» while running; the header «Состояние» carries their glossary), tokens as the compact number under «Токены», the split in its title;
    - «Проверки юнита»: grouped by log, each group headed «лог verify», «лог land», «лог debug». Each label is shown once with its last outcome and «N попыток» when retried; «Строка лога» is the line as fsloop wrote it, in mono, with its header's glossary; an empty cell is the shared «—». A failed exit is neutral unless the unit is blocked on it (Conventions 2);
    - provenance (`ux 9`.6): for a committed unit «Запуски агентов» and «Проверки юнита» fold behind one «Подробнее» (the shared `Fold`) under the facts; in work, waiting or blocked they stay open; the choice is made once per open (Strict 1);
    - a finding row of «Закрывает» leaves out the unit the detail is about («исправлена», not «исправлена · u22»);
  - shared parts: the empty-state table variant, the framed spinner (Tables 2), the part-failed message (Conventions 14), the «—» and «не найден» parts (Conventions 5), the unit-state map, the plural, duration and МСК-time functions (u2; Conventions 1, 10; Copy 3);
  - new components: none. The prototype's distribution bar is dropped because it repeats the counts strip (`ux 2`). The squares are u3's.
- OPTIONS:
  - (A) A full data table of units whose rows expand in place into the unit's detail; the distribution in the status bar's counts strip; unassigned findings as two linking toolbar facts. Serves `rules/ui` → Tables 3, Layout 2, Conventions 7; `table` #1–15; `ux 2`, `ux 6`; `ui` → Live data.
  - (B) A board of state columns (ждут · готовы · в работе · закоммичены) with a unit card each. It shows «now» at a glance, but it strains `table` #1–15 (no sort, search or columns), `ui` → Live data (a state change moves the card under the pointer) and `ux 6` (at 42 cards, about 30 committed fill one column).
  - (C) Master and detail: the unit list on the left and the selected unit's full detail on the right. It reads one unit well, but it breaks `rules/ui` → Layout 2 («no side panel holds an object») and Tables 3 (rows expand in place), and it shows only one unit's findings at a time.
- CHOSEN: (A). It is the only option inside `rules/ui` → Layout 2 and Tables 3, which settle in-place expansion for «a unit's row into its findings». It keeps the prototype's variant B functions (Map rows 47–50) and adds the `run.json` facts the prototype never showed (launches with model, duration and tokens; checks; sha and commits; kind; pass). It replaces the prototype's pseudo-rows «Кандидаты» and «Без юнита или без решения» with counts that link to «Находки», so findings show in one place and the units table keeps a row kind of its own (`ux 2`; `table` #4, #5 — a pseudo-row cannot be sorted, selected or menued). It turns the distribution bar into the status bar strip the law already requires (`table` #8).

ASSUMPTIONS:
- What is this surface for (shape Round 1)? — «что прогон делает сейчас и что уже сделал», by its units — the prompt and `rules/ui` → Layout 3.5. No `PRODUCT.md` exists (`NO_PRODUCT_MD`, j11), so impeccable `init` was not run; u2 writes the Surfaces row from ANSWERS.
- Who arrives, and in what state of mind? — The run's operator, the user alone, on a live run to see progress or on a closed run to see what landed — the user's words («читать все находки», live, sidebar of running runs) — assumed for the units view.
- Which structure, given that concept-seed and the decision page cannot run (`IMPECCABLE_QUESTION_DISABLED=1`, unattended)? — The three structures above were judged by rule. The world is the prototype's, kept (Reading line 2; new-work §3, world fixed) — `fsloop/ui.md` → Unattended.
- Is the unit table client-side? — Yes: sort, filter and search run in one tested client module over the run's whole unit list. `rules/ui` → Tables 1 names only findings, but its reason (the run arrives whole) covers units — assumed; the design check should state it once for both tables.
- Pagination default? — Off, so the counts strip shows the distribution. At most 42 rows fit one bounded scroll, and the toggle stays in the columns menu (`table` #1) — assumed.
- Default sort? — «Проход» descending, ties in `units.md` order. It puts current work first, and live state changes never move rows — assumed from `ui` → Live data and `ux 9` («what next»).
- Does the state cell's age exist? — `units[]` has no time for a state change. The age is the running launch's `startedAt` (`run.json` → `running[]` and `launches[].unit`), else the last check's `endedAt`, computed once in u1's model (Conventions 3). Without either there is no age, never a guess (Conventions 4) — assumed.
- Compact state words? — «ждёт · u2, u3» for drafted (the prototype's «ждёт другие юниты» is too wide for a cell), «заблокирован · <blockedWhy>», «пишется · 12 мин». The words come from u2's unit-state map, not this view — assumed.
- Where is the user's verdict set? — Only in «Находки»; the finding rows in a unit's detail are read-only links (Conventions 6 names the finding's row and detail). This keeps one write place — assumed.
- Does «Находки» (u4) accept the filters these links need — by unit, by severity, by decision «кандидат» and «без решения»? — Required by Conventions 7 for every count here to link. «без решения» is not among Conventions 16's presets — assumed u4 adds the decision filter; flag for the design check.
- Tokens per launch? — One compact count, input + output + cacheWrite + cacheRead, with the split in the title. Map table 4 gives the fields but no reading — assumed.
- Checks volume (up to 31 per unit)? — Each label once with its last outcome and attempt count. Checks are provenance (`ux 9`.6); the full log lines are not shown — assumed.
- Should «Вид» (kind) be a column? — No. It is a detail fact: it is free text up to about 300 characters in real runs and nobody decides by it — assumed (`ux 2`, `table` #10).
- Do the two toolbar facts collide with u3's header? — If u3's header also counts candidates, one place must go (`ux 2`). Assumed the header does not (`rules/ui` → Layout 3.4 lists none); flag for the design check.
CANDIDATES:
- `fsl.mjs` could record when each unit entered its state (`units[].since`), so the state cell's age comes from the run's own record and not from launches or checks.
- `fsl.mjs` could normalize `units[].kind`: 10 of 867 real units carry brief prose in it («backend. Shared rules: …»).
