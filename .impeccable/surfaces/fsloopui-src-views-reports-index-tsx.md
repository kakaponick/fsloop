---
version: 1
slug: "fsloopui-src-views-reports-index-tsx"
primary_target: "fsloopui/src/views/reports/index.tsx"
related_targets: []
---

LENS: shape
SHAPE:
- ANSWERS: one question for the surface: «Что написал каждый запуск агента этого прогона и что прогон решил сам? Прочитать целиком и дойти до источника». Each view answers part of it. «Отчёты»: what did this launch write, and what follows from it (findings, scores, result). «Соглашения»: which shared design solutions this run agreed for its interface. «Журнал»: what the run decided without the user, why, and on what basis. Source: `## Reading` 1 («the critics' reports, the conventions and the journal») and the user's words «в удобном виде читать все находки критиков прогона». `PRODUCT.md` has no Surfaces row yet; u2 adds these three rows from this line (`law/ui.md` → The law grows with the code).
- WALK, «Отчёты»:
  1. The user arrives from the tab strip, the «N запусков агентов» fact in the header, a finding's «Отчёт» link (u4) or a journal ref. The view opens on the rail of launches and the overview: no report chosen, the surfaces ranked by critical + major.
  2. The user narrows the rail by search, «Агент», «Линза» and «Раздел». Filtered to none, the view names the active filters and offers «Сбросить».
  3. The user picks a report (click, or ↑/↓ then Enter). This pushes `?view=reports&report=<launch id>`.
  4. The user reads the facts, then switches section tabs. Each tab has a count, and the tab is in the URL (`&tab=`).
  5. The user follows a finding to «Находки» (`finding=`), a unit to «Юниты», or a frame to the viewer.
  6. Back returns to the same report, tab and scroll position (`rules/ui` → Layout 2, Conventions 12).
- WALK states, «Отчёты»:
  - first load: the run page frame of u3;
  - empty, not yet: «Агенты ещё не отчитывались — первый отчёт пишет карта на этапе «карта и исходная оценка»» (Conventions 15);
  - filtered to none;
  - launch still running (`run.json` → `running[]`): neutral «пишет отчёт · 4 мин», and the reader shows its facts plus «Отчёт появится, когда запуск закончит»;
  - report file missing or unreadable: «Отчёт <file> не прочитан: <причина>» in the reader's place, with the rest of the run shown (Conventions 14);
  - report partly parsed (`unparsed` lines): one line «N строк не разобраны — они на вкладке «Файл отчёта»»;
  - a report with no sections (the map, a free-form report): only «Файл отчёта»;
  - an unknown id in the URL: «Отчёт <id> не найден» (Conventions 5);
  - live, a new launch arrives: it waits in the rail's strip;
  - live, the open report is rewritten: the reader updates in place and keeps scroll and tab (Live data 3);
  - connection lost: u3's strip.
- WALK, «Соглашения»:
  - the user arrives from the tab, or from the CONVENTIONS tab of a design-check report;
  - conventions are grouped by design-check launch, with a link to its report;
  - not yet: before decompose, «появятся на этапе «декомпозиция»»;
  - never: past decompose, or the run closed, with no design check: «В этом прогоне проверки дизайна не было», plus one sentence on when it runs (ux 0).
- WALK, «Журнал»:
  - the user arrives from the tab, or from a ref on another surface (`#j<n>`: the page scrolls to the entry and marks it);
  - the user filters by search and «Этап»; filtered to none offers «Сбросить»;
  - a ref goes to a finding, unit, launch, another entry, judge or pass;
  - a ref whose object is gone reads «не найден»; a `—` ref shows nothing;
  - live: new entries wait in a strip at the list's end.
- RANGES (measured over 60 `run.json`s on 16.11.2026):
  - launches per run: 0 / 34 / 97 (`tga/5a1d6ca5`: 32 critics, 62 implementers, 11 stage groups from p1-map to p2-assess). Critics per run 0 / 12 / 47; implementers 0 / 17 / 62.
  - report file: 60 B / 5.7 kB / 59.8 kB.
  - surfaces per run: up to 28 (`tga/a098a7d4`); stages per surface 1 / 1 / 5.
  - conventions per run: 0 / 11 / 26.
  - journal entries per run: 5 / 36 / 143; the longest entry is 2123 characters.
  - ref kinds: launch, unit, finding, journal, judge, pass, text, none.
  - empty: 3 init runs with 0 launches.
  - the overview at 28 surfaces × 5 stages.
- LEADS:
  - «Отчёты», report open: the report's title, then its outcome row. For a critic: findings by severity (critical red, major amber, minor neutral; `rules/ui` → Conventions 2). For an implementer: its RESULT. For a verdict launch: resolved / partial / unresolved.
  - «Отчёты», no report open: the surfaces ranked by critical + major, the way the prototype's rail ranked them (Map 51).
  - «Журнал»: each entry's question, the decision under it.
  - «Соглашения»: each convention's pattern, as written.
  - Rule: `ux 9`, Done when; `ux 0`.
- ACTIONS:
  - No page main action and no destructive action. The views are read-only (`rules/ui` → Scope; `table` → Contract vs. chrome: no dead chrome).
  - «Отчёты» toolbar: search over description, launch id and surface; «Агент» select (critic, implementer, map, research, other: at most 7 options); «Линза» and «Раздел» comboboxes (sets that grow with the data: `ui` → Choosing from a list). Filter counts are over the unfiltered set. Filters persist in the browser as view state, not in the URL (`rules/ui` → Conventions 12, Tables 4).
  - Rail item: Enter or click opens it (Conventions 8). Context menu: «Скопировать путь к отчёту».
  - Location in a finding: copy on click (Map 38).
  - «Журнал» toolbar: search plus a «Этап» combobox.
  - Selection actions: none. The only write, the user's verdict on a finding, is u4's (Conventions 6).
- ENTRY:
  - u3's tab strip: «Отчёты N» (launches), «Соглашения N», «Журнал N», in the order Layout 4 fixes.
  - The header's «N запусков агентов» links to «Отчёты» when it equals the rail's total (Conventions 7).
  - A finding's detail (u4) has «Отчёт: <launch id>», which opens that report on «Находки».
  - A unit's row (u5) links to its implement and fix launches.
  - u4's surface group header opens that surface's latest craft report; it replaces Map 35, «opens the report in C».
  - Journal refs and ORDER, VERDICT and JUDGED items link to their objects. A design-check report's CONVENTIONS tab links to «Соглашения».
  - Neither «Соглашения» nor «Журнал» is in the run page's first viewport (Layout 3.6).
- BLOCKS, «Отчёты» region by region:
  1. View toolbar: the adaptive toolbar role holding search plus «Агент», «Линза» and «Раздел» (`table #14`, `ui` → Widths).
  2. Rail: one flat list with one Tab stop (`rules/ui` → Conventions 8). The keyboard part is shared with u3's sidebar card list, not re-written. The rail is height-bounded and scrolls inside. It has non-focusable stage headings (stage word from the shared stage map, «проход k», a count) and launches in run order. Each item shows the description (truncates; full text in its title) and a kind word from one agent-kind map (Conventions 1). Each item also shows either the status dot + «2 major · 5 minor» or a neutral state («пишет отчёт · 4 мин»). A held-order strip at the bottom reads «2 новых отчёта · показать» (Live data 1, `ui` → Live data). The edge mark for a fresh item follows Conventions 9.
  3. Reader header: identity is the description as title, the launch id in mono, and the report path as a copy button. Then the fact-list role (`ux 9`):
     - Outcome: finished or running with its age, then findings by severity or the RESULT.
     - Verdict, craft reports only: «аудит 17/20 · критика 28/40» per surface the report scores, with the series across stages from `run.json` → `surfaces[key]`. Each stage's score links to that stage's report.
     - Facts: agent, model, stage · pass, unit (a link), start time in МСК, duration through the shared duration function, and spend in tokens (input / output).
     - «Подробнее», open state persisted (Layout 3.4): cache read/write, boot, child launches, agent id, and the transcript path or «удалён».
  4. Frames of the report's surface: thumbnails (up to 16, then «ещё N») with boxes reserved before load. They open in the shared frame viewer (Layout 7). This keeps Map 46.
  5. Section tabs: the tabs primitive, content width. The set is fixed per agent kind, so two reports of one kind never shift the strip. Each tab has a count; a zero is a muted «0», and its body reads «Критик ничего сюда не записал.» (Map 55).
     - Critic: Находки · Не проверено · Идеи вне прогона · Порядок правок · Допущения, then the sections its lens adds (JUDGED, VERDICT, ROWS, CONVENTIONS, SHAPE).
     - Implementer: its RESULT … VERIFY sections.
     - Every kind ends with «Файл отчёта», the whole `.md` rendered. This is the debug view `ux 9` keeps, so no fact is lost.
  6. Section bodies, at a capped reading measure of about 75 characters (Layout 5; impeccable `mode-read`):
     - «Находки»: a severity segmented filter (Map 54), then the shared finding article. It is the same component as u4's expanded detail (rule, observation, fix, operator's question, decision, frames), plus «Открыть в находках».
     - Other sections: numbered running-text items. Finding ids, unit ids and launch ids become links.
     - Markdown tables in «Файл отчёта» (the map has eight) scroll sideways in their own bounded container.
  7. Overview (no report chosen): the surfaces ranked by critical + major. Each is one running-text line: the key in mono, then «аудит 16 → 17 → 16 из 20 · критика 27 → 27 → 29 из 40», each number a link to its stage's report.
  8. Status bar role: «97 запусков · показано 12 · данные от 19:41 МСК».
- BLOCKS, «Соглашения»: one reading column. An intro line: «Одно решение на задачу, которую юниты решали бы по-разному; в конце прогона попадают в `.claude/rules/ui.md`». Then a heading per design-check launch, linking to its report, followed by an ordered list of conventions as written (Copy 1; the shared markdown renderer, Map 65); the empty state; the status bar.
- BLOCKS, «Журнал»:
  - Toolbar: search plus a «Этап» combobox.
  - One reading column of entries in `#` order. Each entry is an article with an anchor `#j<n>`: a header «#n · <stage word>», the question as its heading, labelled blocks «Решение» and «Почему» as running text (Layout 5), and «Ссылки».
  - Each ref is rendered by one shared ref-link part. It resolves the kind to an address (finding → `?view=findings&finding=`, unit → `?view=units&unit=`, launch or judge → `?view=reports&report=`, journal → `#j<n>`, pass, text → plain). A missing object gets the «не найден» part (Conventions 5).
  - A held-order strip: «3 новых решения · показать».
  - The status bar.
- BLOCKS, new components (none of these exists in the repo; shared with u4 or u3, never one-offs, recorded in `DESIGN.md`):
  - markdown renderer
  - finding article
  - frame viewer
  - ref link
  - agent-kind map
  - section-label map
- OPTIONS:
  1. Rail of launches + reader in one view (prototype C, the rail now lists launches grouped by stage, not surfaces). Serves: Conventions 8 (the rules name a report rail), Layout 2 (a report is addressed, not a panel), and the reading walk (↑/↓ between reports, `ux 0`). It takes the same-surface-in-several-reports gap (Map 3) by making surface a filter. Strains: 97 items need filters and an inside scroll. The rail costs about 240 px of a 964 px page at 1280 wide, which leaves about 700 px, enough for a 75-character measure.
  2. A launches data table (stage, agent, lens, surface, findings, model, duration, spend; sortable), with each report as its own page and Back. Serves: `ux 6` volume, and sorting by spend or time. Strains: Conventions 8 (no rail), a second full table contract beside u4's (`table` #1–15, duplication), back-and-forth reading, and `table #10` cutting the description that tells reports apart.
  3. One continuous document per stage: every report of the stage one after another, with a contents list. Serves: «read in full». Strains: `ux 6` (up to 97 × 5.7 kB in one scroll); Layout 4 (`?tab=` report tabs) is lost; a report has only an anchor, not a place with its tab (Layout 2).
  4. «Журнал» as a table `# / Этап / Вопрос / Решение / Почему` (Map 57) or as a reading list of entries. The table either wraps cells (`table #10` defect) or truncates the text the user came to read (Layout 5) and needs the full table contract for 143 rows. The list keeps running text at a measure and needs only search and a stage filter.
- CHOSEN:
  - Option 1, with the journal as a reading list. It is the one structure the project's UI rules already name (Conventions 8, Layout 4 `?tab=`). It keeps each report a place with an address and its tabs. It reads in full at a capped measure, and it puts volume into filters plus stage grouping instead of a second table machine.
  - Conscious replacements of Map 51/57: surfaces leave the rail and become a filter and the overview, because a surface spans reports and code/runtime/parity critics have none. Conventions and the journal become their own views (Layout 4). The journal table becomes entries (`table #10` vs Layout 5).
  - Kept as is: Map 35, 46, 52–56 and 65, as BLOCKS says.
  - Below the view's container width for rail + column, the rail folds into a «Отчёт» combobox above the reader (`ui` → Layout Paradigm 2: a container query, not a viewport query).
JUDGED:
- —
ASSUMPTIONS:
- Product context, users and voice. No `PRODUCT.md` or `DESIGN.md` exists (impeccable `context`: NO_PRODUCT_MD, PRODUCT_INIT_REQUIRED). The context is one operator who runs fsloop and reads a run's critics, from the user's words, plus `.claude/rules/ui.md` (j11).
- Visual direction and concept round. The prototype's world is kept: a Read-mode surface, code-led, no `concept-seed` and no decision page. Sources: `## Reading` 2 and `law/ui.md` → Precedence (a new direction only with the user at the keyboard). `IMPECCABLE_QUESTION_DISABLED=1` makes the decision page exit 2, so the structures are judged here by rule.
- Which reports «Отчёты» lists. Every launch in `run.json` → `launches[]` (critics of every lens, implementers, map, research, verdicts), read through `fsl.mjs`'s model, plus running ones from `running[]`. Source: the prompt and Map table 4. That `running[]` is filled while a launch runs is assumed (Map table 8: «not tried»).
- Russian names of report sections and agent kinds. The prototype's five tab names are kept: Находки, Не проверено, Идеи вне прогона, Порядок правок, Допущения. These are assumed: JUDGED «Решённые вопросы», VERDICT «Вердикты», ROWS «Строки паритета», CONVENTIONS «Соглашения», SHAPE «Форма раздела»; implementer RESULT «Итог», CHANGED/CREATED «Файлы», RED/GREEN «Тесты», NOTES «Заметки», PARITY «Паритет», VERIFY «Проверка»; fsloop-critic «критик», fsloop-implement «исполнитель», Explore map «карта», spike-researcher «разведка», others as written. They are assumed; u2 puts them in one map and in `PRODUCT.md` → Glossary (`rules/ui` → Copy 2).
- What an implementer's or the map's report is called, given that Copy 2 names only «отчёт критика». Assumed: «отчёт запуска». The view label «Отчёты» is settled by Layout 4.
- How a surface is named when the AUDIT label is a file path (Map gap 3.13). Assumed: by its key in `run.json` → `surfaces` (mono, as written); the AUDIT text is shown whole in the report.
- How spend is shown. Assumed: as tokens (input / output, cache under «Подробнее»), no money; no price exists in `run.json`.
- What «Отчёты» shows with no report in the URL. Assumed: the overview of surfaces ranked by critical + major, not an auto-opened report.
- Rail and journal order. Assumed: run order (chronological), with new items held in a strip at the end (`ui` → Live data).
- Report tab sets. Assumed: fixed per agent kind, so the strip does not shift; empty sections stay with a muted 0 (Map 55).
- A journal entry's address. Assumed: the fragment `#j<n>`; Conventions 12 names no journal key, and Layout 2 asks for an address.
- Whether the user can give a verdict on a journal entry or a launch, which `human.jsonl` can hold. Not here. Source: `rules/ui` → Scope and Conventions 6 (the one write is on a finding).
- Stage words for fix, assess, verdict and integrate, absent from the prototype's `STAGES`. Assumed: the shared stage map (u2/u3) gains them; u6 only reads it.
- Who owns the finding article, the frame viewer, the markdown renderer and the ref link when u4 and u6 run in parallel. Assumed: u2 or the design check assigns one owner. Two copies would break `code` → No duplication and Consistency (impeccable critique heuristic 4).
- Whether the overview of surface scores is a data table under `law/table.md`. Assumed: no, a running-text list (at most 28 lines), so it takes no table contract.
CANDIDATES:
- Spend totals per stage and per agent kind in the «Отчёты» status bar or overview: tokens by stage, which the run already records (`spend`).
- Verdicts on journal entries and launches through `human.jsonl`, which `fsl.mjs` already reads; it needs a rules change (Conventions 6).
- Compare a surface's two craft reports (p1-map against p2-assess) section by section: findings that disappeared or appeared.
- Sort the rail by spend or duration, to find the costly launches; it needs option 2's table, so it waits for evidence of the need.
