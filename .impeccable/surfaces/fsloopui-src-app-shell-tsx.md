---
version: 1
slug: "fsloopui-src-app-shell-tsx"
primary_target: "fsloopui/src/app/shell.tsx"
related_targets: []
---

SHAPE:
- ANSWERS: «What is each of my fsloop runs across projects doing right now, and what did the run I opened produce?» — two questions in one shell. The sidebar answers which runs are running, silent or closed, and in what state with what settings. The run page answers what this run is, where it stands and what it produced. Source: the user's words («сайдбар где мы будем видеть карточки запущенных прогонов… проект, настройки, состояние»; «в удобном виде читать все находки критиков») and `## Reading` 1. No `PRODUCT.md` Surfaces row exists yet; u2 writes it from this line (j11).
- WALK: (1) `/` opens. The sidebar shows its first-load spinner frame, then the list arrives. The URL is replaced (not pushed) with the most recently active open run, else the most recently updated run, else the empty root state. `ux 3`; `rules/ui` → Conventions 12.
  (2) The run page loads. The page header and the identity, outcome and facts rows draw at once from the card the list already holds; the view body shows the framed spinner with «Загрузка…». `rules/ui` → Tables 2, Conventions 3.
  (3) Loaded: the tab strip with counts, the default view Находки.
  (4) Live: cards update in place. A new run, or a card whose group or rank changed, waits in the bottom strip until the user clicks it. The open run re-reads in place, and «●» shows in the tab title while the tab is hidden. `rules/ui` → Live data 1, 3, Conventions 9.
  (5) Open another card or tab: pushes a history entry; Back restores the run and view. `rules/ui` → Layout 2.
  (6) Lost connection: one strip above every view, «Нет связи с сервером fsloopUI · данные от 19:41 МСК», with ages counting from the last update. On reconnect the list and the open run are re-read whole. `rules/ui` → Live data 5.
  (7) The open run's folder vanishes: the page frame turns to not-found, «Прогон <id> не найден: его папки больше нет в <корень>», and the card stays marked until the strip is clicked.
  (8) Read error: «Прогон <id> не прочитан: <причина>» with «Повторить». A single unreadable file fails in its own place. `rules/ui` → Conventions 13, 14.
  (9) A run folder without `run.json`: it opens. Identity shows, the outcome row reads «не записано: в папке нет run.json» with a neutral dot, and the views show «empty because not yet». `rules/ui` → Conventions 4, 15.
  (10) Narrow viewport: below the shell's one breakpoint the sidebar becomes a band above the page; its run list is a fixed 128 px from the first paint, four whole 32 px rows (a fold's header is one). Every row of the band is one 32 px line — a closed run's too, its second line following the outcome as its cause — with no padding under the last, and the list's scroll snaps to a row's top, so no stop slices a row. `rules/ui` → Layout 1, Strict 1.
  (11) No runs under the root: «В <корень> нет прогонов fsloop. Новый появится здесь сам, когда fsloop создаст его папку». `rules/ui` → Conventions 15.
- RANGES: production has 5 projects and 63 run folders: 3 live (full cards), 4 open and silent for 6–25 days, 53 closed, 3 without `run.json`. Empty: 0 runs (the root empty state) and 0 running (one muted line in the running group, the folds still below).
  Volume: the closed group shows all 53 mini rows (the prototype's first-40 cap is dropped, `ux 6`) and scrolls inside the sidebar.
  The goal is median 1543 and up to 8617 characters, multi-line in 51 of 57 runs. The card clamps it to 2 lines with newlines collapsed. The header clamps it to 2 lines with an expand trigger, shown only when the clamp hides text; expanded, it is running text with its line breaks in a capped region that scrolls inside (`rules/ui` → Layout 5, 6).
  Units on a card go up to 42 (one distribution bar plus counts). Header facts: about 5 outcome and verdict rows plus about 8 facts, half of them folded.
  Same-named projects: no collision today, but the key is made unique by construction (see ASSUMPTIONS).
- LEADS: on the sidebar, the running group's cards first; per card: project · id · liveness, then the state row (stage · проход k из N · step, a red gate or blocked unit as an amber outcome line). On the run page: identity (project · id, goal), then the outcome rows of the fact list (stage, liveness, a gate or blocked unit), then the Находки tab. State, next step and product all sit in the first viewport. `ux 9` (Done when); `rules/ui` → Layout 3.
- ACTIONS: none destructive (`rules/ui` → Scope: read-mostly). There is no page-level toolbar action for a run, and a card has no row actions: the card is one link (`rules/ui` → Conventions 8).
  Controls: the sidebar's search over project, id and goal (placeholder «Проект, id, цель», every word AND-matched, its terms in a history; no `/` cap — `/` is the view's search); open a run (card or mini row; ↑/↓ and Enter, one Tab stop); fold and unfold «Не закрыты и давно молчат» and «Закрытые» (state kept in browser storage); the strip's verb «показать» (held order); «Подробнее» in the facts (open or closed as last left); expand the goal; the view tabs (←/→ inside the tab strip); «Повторить» on a read error.
  Consciously dropped: the variant switcher and its ←/→ (Map #22, #58; they become the tabs); the snapshot auto-refresh (#60); the footer hint (#61).
- ENTRY: the app root `/` at 127.0.0.1:4747. The sidebar is the navigation; its head reads «fsloopUI», then «Прогоны» with «3 прогона идут» (`rules/ui` → Copy 3). The run page is at `/r/<project>/<id>?view=<view>` (plus `tab`, `unit`, `finding`, page from u4–u6). It is entered from a card, a mini row, a pasted URL, or a link to a finding. Its tab counts are the counts that link into the views (`rules/ui` → Conventions 7, 12). The tab title is `fsloopUI · <project> · <id> · <stage>`, with «● » prefixed on a hidden change.
- BLOCKS:
  - Shell: a grid of a fixed sidebar column (316 px, the prototype's) and `minmax(0,1fr)`. The one viewport breakpoint is 980 px. Sidebar, header and view body are each a size container, and each region scrolls on its own (replaces Map #64).
  - Sidebar head: the product name and the running count, then the search; no match reads the filtered empty state «Нет прогонов, подходящих под фильтры» with «Сбросить фильтры».
  - Running group: full cards. Card (prototype `.card`) layout:
    - Top line: project bold · id mono · «новое» (neutral) · liveness status dot + label.
    - Goal: a 2-line clamp with no tooltip and no trigger; the full goal is on the page it opens (`ui` → Truncation, Tooltip).
    - «Настройки» row: mode · проходы · до K юнитов сразу · models · зеркало .spike.
    - «Состояние» row: stage · проход k из N · step, «с 19:41 МСК»; the unit distribution bar plus «2 из 20 юнитов закоммичено · 3 в работе»; «идёт 2 ч 05 мин · 34 запуска агентов · 2 коммита».
    - Outcome lines: «красный гейт: …» and «заблокирован u7 — …», read from `now.waitingOn.lastRedGate` (fixes Map gap 3.11).
  - Folds «Не закрыты и давно молчат · 4», «Закрытые · 53» and «Без записи о прогоне · 3», each header one 32 px row with its hairline on the trigger: mini rows (prototype `.mini`) of project · id · state, 4 px apart, no clock time on the face (it is in the row's title, named: «последняя запись 12:41 МСК», «закрыт 15.11 23:40 МСК»). The project keeps its whole word and gives way only past 35 % of the line; the state reads «fact · cause» — the liveness or the outcome kept whole, what waits after it cut at its end — each on the dot of its own tone: the liveness's, as the run header's «Активность» shows it, then the wait's amber where the wait begins («● работает · ● красный гейт · заблокирован u23») — so at the 316 px sidebar the widest project, the id and «цель не достигнута» stand whole. A closed run's mini row reads the goal's outcome alone («цель достигнута» / «цель не достигнута»; the push when no goal was judged) and has a second reserved line: «коммиты не отправлены» when they were not, «<N назад> · <goal>» — no «закрыт», which the fold's header «Закрытые» already says. A run changed since it was last opened wears the edge mark, «новое» in its name and title.
  - Held-order strip: one shared component with u4's «вне фильтра» strip (`ui` → Live data). It is new; no component exists.
  - Run page frame:
    - Page header role: identity only, «project · id».
    - Then a head band: the goal (clamped) and the fact list side by side above the narrowest supported width, stacked below it. The fact list is a new shared component for an empty role (`ui` → Roles: fact list): outcome rows (Этап, Активность, a gate or blocked row, Юниты), the verdict row for closed runs only («цель достигнута · отправлен»), then facts (Настройки), then «Подробнее» (Начат, Длительность, Запуски агентов, Токены, Проходы — only where the run has N passes, read from the card, whole from the first paint — Коммиты, Зеркало .spike, Рабочая копия, Сессии, Папка прогона, Версия run.json). «Ждёт вас» holds two to six lines; causes past its last line read «ещё N · показать». A run that closes while open keeps the header's running height.
    - Then the tab strip (primitives tabs, content-width, a count on each, a muted «0»).
    - Then the view body (u4–u6), the lost-connection strip above it, and the status bar (data age).
  - Shared blocks: tokens `--f-*` (template.html:8–9), the status dot with tones from one state map (`rules/ui` → Conventions 1), the empty-state role, the framed spinner, and the one duration and time function (`rules/ui` → Conventions 10).
- OPTIONS:
  - (A) The prototype's frame kept: stacked header, KPI strip, unit squares, events strip, tabs. It strains `ux 9` (counts as a KPI row, not a fact list), `ux 2` (KPI counts repeat the tab counts) and `rules/ui` → Conventions 9 (the events strip is a fourth change mark). Unit squares are 11 px targets for up to 42 units.
  - (B) Two-region shell. Sidebar: full cards for running runs, mini-row folds for silent and closed runs, held order with a bottom strip. Run page: identity toolbar, then the goal and an outcome-first fact list side by side, then the tab strip with counts, then the body. It serves `rules/ui` → Layout 1, 3, 4, Live data 1, and `ux 9` first viewport.
  - (C) The sidebar as mini rows only, with the selected run's facts only in the header. It serves `ux 2` (no card and header overlap), but it breaks the user's words: a card holds the project, settings and state of every running run at a glance across projects.
- CHOSEN: B. It is the only structure that keeps the card contents the user named, puts the run page in `ux 9` order (outcome before facts, product in the first viewport), and turns the A/B/C variants into views (`rules/ui` → Layout 4).
  - Unit squares → the Юниты view, where each unit has its own URL.
  - Events strip → the edge marks on changed rows plus the journal.
  - KPIs → the tab counts plus the Юниты outcome row.
  - The card and header overlap for the open run is accepted: the card is a cross-run summary, not a page.

ASSUMPTIONS:
- impeccable context reported NO_PRODUCT_MD and PRODUCT_INIT_REQUIRED. Answer: the product context is the user's words plus `.claude/rules/ui.md`; `init` was not run. Source: j11.
- The visual world: the prototype's (tokens, system fonts, 13 px base, cards), inherited as an established world (new-work §1). Source: `## Reading` 2.
- concept-seed and the decision page were not run (`IMPECCABLE_QUESTION_DISABLED=1`, subagent). The structures were judged by rule into OPTIONS and CHOSEN. Source: `fsloop/ui.md` → Unattended.
- Liveness thresholds: «работает» under 5 min, «тихо · N» 5–30 min, «молчит · N» over 30 min, and the long-silent group from 6 h. These are the prototype's numbers, kept once beside the liveness function, with age from `running[].lastAt` and the transcript and folder mtimes. Source: assumed (Map #7, #4; j9).
- Tones:
  - neutral: «работает» (no pulse) and «тихо», plus in-progress unit states;
  - amber: «молчит», a red gate, a blocked unit;
  - green: committed units and a closed run whose goal was met;
  - neutral: a closed run whose goal was not met, and «новое».
  Source: `rules/ui` → Conventions 2, 9. Leaving «цель не достигнута» neutral is assumed (no action to name, `ux 8`).
- Sidebar order:
  - running group: by start time, newest first — stable under activity, so the held order rarely needs the strip;
  - long-silent: by last activity;
  - closed: by `updatedAt`, newest first.
  A group move waits in the strip as a rank change. Source: assumed (`rules/ui` → Live data 1).
- Strip wording for mixed changes: «2 новых · 1 перемещён · показать». Source: assumed (`rules/ui` → Live data 1, 2).
- The 3 folders without `run.json` are listed in a third fold «Без записи о прогоне · 3», not guessed into running or closed. They open into the not-recorded frame. Source: assumed (`rules/ui` → Conventions 4; Map gap 3.7).
- Project key: the folder basename; when two projects share it, the server suffixes the parent folder (`dev~tga`), and the card shows the disambiguating path segment in mono. Source: assumed (Map gap 3.8).
- Default URL `/`: replaced (not pushed) by the most recently active open run. Source: assumed (`ux 3`; Map #67).
- Facts ranking and what folds behind «Подробнее» (mirror, worktree path, sessions, run folder, `run.json` version). Source: assumed (`rules/ui` → Layout 3.4).
- Card goal: newlines collapsed, a 2-line clamp, the full text only on the run page. The run-number prefix («1 Цель прогона — …») is shown as written, not stripped. Source: assumed (`rules/ui` → Copy 1; `ui` → Tooltip).
- The root of projects appears only in the empty-root and not-found texts, nowhere else in the chrome. Source: assumed (`ux 2`).
- The head band shows the goal and the fact list side by side down to 1280 px and stacks below it. Source: assumed (`ui` → Page chrome, narrowest desktop 1280 px when `DESIGN.md` names none).
- A vanished run's card stays, marked «папки больше нет», until the strip is clicked. Source: assumed (`rules/ui` → Live data 1).

CANDIDATES:
- Group or filter the 53 closed runs by project in the sidebar once the count passes about 100.
- (Built in pass 2: «Токены» in «Подробнее», the run's spend from its launches and sessions.)
