---
version: 1
slug: "fsloopui-src-views-findings-index-tsx"
primary_target: "fsloopui/src/views/findings/index.tsx"
related_targets: []
---

LENS: shape
SHAPE:
- ANSWERS: «Что нашли критики этого прогона, что прогон решил по каждой находке и с чем я не согласен?» This question asks for every finding of one run from every source: 723 of 723 in `tga/a098a7d4`, where the prototype showed 555. Each finding comes with its text, the run's decision and the user's own verdict. Sources: Reading 1 («the findings of a run with search and filters»), the user's words «в удобном виде читать все находки критиков прогона», and `rules/ui` → Conventions 6 for the verdict. The surface's `PRODUCT.md` Surfaces row is written from this line.
- WALK:
  1. **Enter.** The user opens the «Находки» tab (`?view=findings`). The first load is a framed spinner in the table's place with «Загрузка…» (`rules/ui` → Tables 2).
  2. **Nothing to show.** If the run has no findings yet, the empty state names the stage that fills it: «Критики ещё не писали отчётов — находки появятся на этапе «<next stage that launches a critic>»» (Conventions 15).
  3. **Read the list.** The typical state is the full table, sorted by severity rank. The user reads the rows, narrows them with «Вид», the search (`/` focuses it) or a filter, and gets either the narrowed rows or the filtered-to-none empty state. That state names the active filters and offers «Сбросить фильтры» (`ui` → Empty states).
  4. **Expand a finding.** A click or Enter expands the row in place (Tables 3). Several rows may be open at once, and open rows survive refreshes (Live data 3).
  5. **Look at a frame.** A thumbnail opens the frame viewer: ‹ ›, ←/→ and the wheel step through it; Escape returns focus to the thumbnail (Layout 7).
  6. **Set a verdict.** The user sets it in the detail, or through «Оценить…» in the row menu, where it applies to one row or to a selection with one note. It shows at once («Ваша оценка: согласен · 19:41 МСК»). In the detail, keys 1–4 set the verdict of the finding in focus and move focus to the next row of the page with no verdict, its detail opening in place of the rated one's when that was open; the caps show in the tooltip «Выбрать клавишами 1 2 3 4» over the toggles, and the dialog has no keys. If the write fails, the row reverts, the note text stays in its field, and a toast «Оценка не сохранилась: <причина>» with «Повторить» stays until closed (Conventions 6).
  7. **Live update.** A changed row updates in place with an edge mark (Conventions 9). New findings, and rows a live change moves, gather in one strip at the table's end: «12 новых находок · показать». A row that left the filter stays where it was, marked «вне фильтра», and the strip says «убрать» or «обновить список» (Live data 2).
  8. **Link to a finding.** `?finding=<id>` opens the run, goes to that finding's page, expands, scrolls to and marks the row. If the filters hide it, it shows anyway, marked «вне фильтра». An id the run does not hold reads «Находка <id> не найдена» (Conventions 5 and 12).
  9. **Shell states.** The lost-connection strip and the read errors belong to the shell and the run frame (u3: Live data 5, Conventions 13). This view adds no copy of them.
- RANGES:
  - **Empty:** 0 findings, in init runs and in a run before its first critic.
  - **Typical:** 130 findings per run (the median). The text (rule + action) has a median of about 230 characters.
  - **Volume:** 723 findings in `tga/a098a7d4`:
    - 32 source reports, including 2 implementer launches (`open-N` lines);
    - 2 critical, 205 major, 513 minor, and 3 with no severity;
    - 193 parsed `loose` (27%), which hold only `raw` and no rule, action or location;
    - status: 506 candidate, 163 in-progress, 54 fixed.
  - **Other limits:** text up to 1920 characters. Across all runs, 13 status words (`statusOf`). Units per run 0/14/42. Frames per run 0/8/289, with up to 8 linked to one finding.
  - **Pagination:** 50 rows a page by default, so the volume run is 15 pages (`table #1`). The whole run's data reaches the client and is filtered there (`rules/ui` → Tables 1).
  - **Width budget at 1280 px,** taking the prototype's 316 px sidebar:
    - fixed columns: checkbox 32, «Серьёзность» 116, «ID» 112, «Отчёт» 200 (resizable; it clears «runtime · проход 1 · приёмка», the widest launch name of the 723-finding run), «Состояние» 156 (it clears «не исправлена · f10»), «Оценка» 136 (it clears «не та серьёзность»);
    - «Находка» keeps a floor of 154 px, so 1280 px holds the table whole (924 of 924 px); at 1440 it gets about 322 px.
    - «Место» (location) is therefore off by default, but searchable and shown in the detail (`table #10`, Tables 5).
- LEADS:
  - Before any filter, the user first reads the critical and major rows that still need someone, in this sort order:
    1. severity rank, descending;
    2. state rank: blocked / not resolved / repeated, then queued / in progress, then undecided, candidate, fixed / closed;
    3. report order.
  - Each row reads: severity dot + word · id · the finding's first sentence · its report · its state · the user's verdict.
  - In the first viewport the «Вид» select names the slice and its count («Все · 723»). Sources: `ux 0`, `ux 9` (the product leads), `rules/ui` → Conventions 2 (severity is the one toned category) and Conventions 16.
- ACTIONS:
  - **Toolbar:** no main action. The view's object is a read-only list, and its one write is per finding (`table` → Contract vs. chrome: no dead chrome; no Refresh, because the data is live).
  - **Toolbar controls, in this order (`table #14`):**
    1. «Вид» select with counts (Conventions 16): Все · Без оценки · С возражением (every verdict but «согласен») · В исправление · Кандидаты · Закоммичены;
    2. search with history, pinned. Identifier tokens (id, location, unit ids, report) are OR-matched; free-text tokens (rule, action, why, raw) are AND-matched. Placeholder «Текст, файл, id, юнит» (`table #12`);
    3. filters, each with counts over the unfiltered set (`table #11`): «Серьёзность» select · «Состояние» select · «Отчёт» combobox (up to 32 reports) · «Юнит» combobox (up to 42) · «Оценка» select (its first option «с возражением», explained in the header's glossary) · «Охват» select · «Правка» select (the `/impeccable` verb; keeps map row 33). The last two collapse first into `…`;
    4. «Свернуть все находки» — an icon-only 28 px button in the right cluster, its box always held, invisible while no row is open; a click closes every open detail;
    5. the columns menu (`table #3`).
  - **Row context menu (`table #4`):**
    - «Открыть» (expand/collapse; the default pin, Tables 3);
    - «Оценить…» — single and multi; a dialog with the four verdicts and one note; on a selection its title is «Оценка для 12 находок» (Conventions 6, `ux 6`);
    - «Скопировать ссылку» — single;
    - «Скопировать id» — multi, joined by newlines;
    - «Скопировать путь»;
    - «Открыть отчёт» — single; goes to `?view=reports&report=…`;
    - «Открыть юнит uN» — single, one item per unit.
  - **Destructive actions:** none (`rules/ui` → Scope).
- ENTRY:
  - **Tab:** the «Находки» tab of the run's tab strip, with its count (Layout 4, owned by u3). Assumed to be the default view when `?view=` is absent.
  - **Counts that link here, when above 0** (Conventions 7):
    - in the run header: critical, major, minor, «в исправление», «кандидатов», «закоммичено»;
    - a run card's counts;
    - a report's count on the «Отчёты» rail (u6);
    - a unit row's finding count in «Юниты» (u5).
  - **Links to one finding** (`?finding=<id>`, Conventions 12): from a report article (u6), a unit's expanded findings (u5) and a journal ref (u6).
- BLOCKS:
  - **Shared, from u2 (the role map):**
    - the data table (`table #1–15`, filtering on the client per Tables 1);
    - the adaptive toolbar;
    - search with history;
    - select and combobox with a count slot;
    - the columns menu and the row context menu;
    - the status dot and the glossary tooltip;
    - the dialog;
    - the table's empty state;
    - the status bar: pagination, «{shown} из {total}» and the data age (`table #8`);
    - the toast;
    - the «—» and «не найден» parts;
    - the plural and time functions;
    - `Kbd`;
    - the state maps for severity, finding status, decision and verdict (Conventions 1).
  - **Shared, but not yet owned by any unit** (each also serves u3, u5 or u6, so none may be built in u4 alone, `ui` → Existing component first):
    - the running-text renderer (Layout 5; the prototype's `md`, map row 65);
    - the frame viewer and thumbnails (Layout 7; also used in «Отчёты»);
    - the held-order strip «N новых · показать / убрать / обновить список» (Live data 1–2; also used in the sidebar).
  - **New in u4:**
    - **`FindingRow` cells:**
      - «Серьёзность»: dot + word, with a glossary;
      - «ID»: mono;
      - «Находка»: the first sentence as written, width-free; for a loose finding, its `raw`; on a row with frames, a picture icon and their number after the sentence («2 кадра» in its title);
      - «Отчёт»: compact launch name such as «craft · notifications» or «u2 · реализация»; sorting by it reads the run's reports in order (the stage's rank, then the run's order);
      - «Состояние»: the compact form from Conventions 1, e.g. «в работе · u3» or «кандидат»; with a glossary of at most 8 entries for the values that leave a question;
      - «Оценка»: the compact verdict or «—»;
      - hidden by default: «Место», «Уверенность», «Охват» (each with a glossary), «Этап».
    - **`FindingDetail`:**
      - a fact line: severity · уверенность · охват · отчёт as a link · этап и проход · место with a copy button;
      - then running-text sections: «Наблюдение», «Правка» (with its command), «Вопрос, который закрывает», «Правило»;
      - «Решение прогона»: the full status form, each unit as «u3 «title» — закоммичен» linked to `?view=units&unit=u3`, then the why;
      - «Оценка», using `VerdictControl`;
      - «Кадры».
    - **`VerdictControl`:** four options and a note, with the saved line. One component, used by both the detail (the choices first, keys 1–4) and the dialog (the note first, no keys).
- OPTIONS:
  - **A. One flat findings table** under the full table contract, rows expanding in place. It serves `table #1–15`, `rules/ui` → Tables 1/3/5, Conventions 16 and `ux 6`. It strains one prototype function: map row 35, the group header by surface with its scores. That function moves to the «Отчёт» column and filter plus the «Открыть отчёт» item; the scores live on the «Отчёты» rail (`ux 2`).
  - **B. The same table grouped by report,** with group header rows showing count and scores (the prototype's «Лента»). It serves reading by critic. It strains `table #2`, because sorting crosses groups; `#1`, because pages split groups; `#5`, because a group row is not selectable; and `ux 2`, because the scores repeat «Отчёты».
  - **C. Master–detail,** with the list on the left and a finding reader in a side panel. It suits long texts, but it breaks `rules/ui` → Layout 2 («no side panel holds an object») and Tables 3 (rows expand in place).
- CHOSEN: **A.** It is the only structure the project's rules allow without an override. Its sort, filters, «Вид» and selection work across all 723 rows of every source. The one function it drops (grouping by surface, with scores) has a home one step away: the «Отчёт» filter, column and menu item, and the scores on the «Отчёты» rail. Option B can come back later as a sort by «Отчёт» without group rows.

JUDGED:
- —

ASSUMPTIONS:
- impeccable `context`: NO_PRODUCT_MD / PRODUCT_INIT_REQUIRED, "finish init for PRODUCT.md" — init was not run; the product context is the user's words plus `.claude/rules/ui.md`, and u2 writes PRODUCT.md — journal j11
- new-work §1, "Which visual authority applies?" — the established world is the prototype's tokens and components (map table 7), kept and written down; this is not a new direction — Reading 2
- new-work §3, concept-seed and the decision page — not run: the decision page is disabled (IMPECCABLE_QUESTION_DISABLED) and the launch is unattended. Structures were judged by rule into OPTIONS — `fsloop/ui.md` → Unattended
- Shape round 1, "What is the surface for, and who reaches it?" — the single local user (the fsloop operator), during or after a run, reading every finding and judging some — the user's words; `rules/ui` → Scope
- Shape round 2, "What content and ranges?" — `run.json` → `findings[]` as `fsl.mjs` builds it, at the counts in RANGES — map tables 4–5 and a measured `tga/a098a7d4`
- "How are rule, observation, fix and question separated?" — u1's server splits `rule` and `action` once (Conventions 3). Where the split fails, the detail shows the text unsplit under one «Текст находки» heading and never repeats a section (parse gap 3.2). A loose finding shows `raw` alone. A missing severity or location reads «не записано» with a neutral dot and sorts last (Conventions 4) — assumed
- "How are a finding's frames found?" — `run.json` has no per-finding frame field, so u1 matches frame names cited in the text across every pass (not just `p1-`), at most 8, and serves the list with the finding — assumed (parse gap 3.12)
- "Does a verdict survive a refresh before `fsl.mjs build` runs?" — yes: u1's server reads the latest `human.jsonl` line per finding on every read, so the saved verdict does not wait for the orchestrator. It is written as `{finding, verdict, note, at}`, the shape `fsl.mjs:817` accepts — assumed (map 8: the write contract has 0 samples)
- "Can a verdict be set on a closed run?" — yes: `human.jsonl` is read on the next build whatever the state — assumed
- "Can a verdict be cleared?" — no: `fsl.mjs`'s list has no empty value, and a later verdict replaces an earlier one (Conventions 6) — assumed
- "Does a rated row move while «Без оценки» is the active view?" — the verdict shows at once (Live data 3). A row the verdict takes out of the filter stays in place, marked «вне фильтра», until the strip is clicked, so the open detail never jumps away (`ui` → Live data: rows never move under the focus) — assumed reading of Live data 3
- "How does a count elsewhere link to a filtered list when filters are not in the URL?" — the link writes the findings view's persisted filters (`table #7`) and navigates to `?view=findings`, which resolves Conventions 7 against Conventions 12. The resulting filter reads «Свой набор», or the matching «Вид» — assumed
- "What does the column holding the source of an `open-N` or `-own#` finding say?" — the header is «Отчёт» (not «Критик», which would not cover implementer and orchestrator lines, `ux 1`). Cells: «craft · notifications», «u2 · реализация», «прогон»; «не записано» when `launch` is absent (1 row in `a098a7d4`) — assumed
- "What is the default page size?" — 50, not Fill: expanded details break Fill's row-height measurement — assumed
- "Which surface-scoped prototype functions are not this view's?" — map row 46 (frames in a report header) belongs to «Отчёты» (u6). Map row 59 (filters in the hash) is replaced by view state plus `finding=` and the page in the URL (Conventions 12) — the prompt's scope; `rules/ui` → Conventions 12
- "Who builds the data table, the running-text renderer, the frame viewer and the held-order strip?" — u2, as shared components, because u4, u5 and u6 run in parallel and each needs them. Otherwise two units build them twice — assumed (journal j10 makes u2 the design system); the design check should confirm it

CANDIDATES:
- (Built in pass 2: «Свернуть все находки» in the toolbar's right cluster.)
- (Built in pass 2 as a sort, not a preset: sorting by «Отчёт» brings back the prototype's reading order without group rows — Conventions 16 leaves the sort alone when a «Вид» is chosen.)
- Withdrawing a verdict («снять оценку»), which would need a new verdict value in `fsl.mjs`'s `HUMAN_VERDICTS`
- (Built in pass 2: a per-row count of frames in the «Находка» cell.)
