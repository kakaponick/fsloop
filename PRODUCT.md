# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the operator who starts fsloop runs in several projects on this machine and leaves them running unattended. He opens fsloopUI to see, across projects, which runs are working, which went silent and which closed, with the settings and the state of each, and to read in comfort everything a run's critics found and what the run did about it. The interface speaks Russian. It is local and single-user: no sign-in, no roles.

In his words: «можешь написать прототип интерфейса для работающего прогона fsloop? я например хочу в удобном виде читать все находки критиков прогона»; «сделай чтобы интерфейс обновлялся в Live режиме»; «нам нужен сайдбар где мы будем видеть карточки запущенных прогонов. карточка содержит: 1. проект 2. выбранные настройки текущего прогона 3. состояние текущего прогона».

## Product Purpose

fsloopUI is the reading interface of fsloop runs. It reads the run folders under a root of projects (`.claude/fsloop/runs/<id>/` in each), and shows them live, without a reload:

- **Прогоны** — a sidebar of run cards across projects: the project, the run's settings, its state and liveness.
- **Прогон** — one run's page: what it is, where it stands, and what it produced, in its views «Находки», «Юниты», «Отчёты», «Соглашения», «Журнал».

Its one write is the operator's own verdict on a finding («оценка»), to the run's `human.jsonl`. Success is reading every finding of a run, with the run's decision on it, in comfort, and knowing at a glance what each running run is doing — without opening a run folder.

## Brand Personality

A working instrument, not a site: **clear, calm, dense**. A first-time reader meets no question about what is happening (`ux 0`); every element carries a fact, an action or the answer to a question. The voice is plain Russian, business register; what fsloop or a critic wrote is shown as written, English included, identifiers in mono (`rules/ui` → Copy 1). Numbers go with their nouns («3 находки»), times are Moscow time with the zone named («19:41 МСК»). The emotional goal is *trust*: «работает» means a fresh write, «закоммичен» means the run's own record says so.

## Anti-references

- **False states** — a guessed value, a positive word without the record behind it; an unknown field reads «не записано» with a neutral dot (`rules/ui` → Conventions 4).
- **Layout shift** — anything that moves because something else loaded, arrived or changed (`rules/ui` → Strict 1).
- **Skeletons** — a loading state is «Загрузка…» with a spinner, centred in a region already at its final size (`rules/ui` → Strict 2).
- **Coloured status badges** — a state's colour is a dot beside a plain word; work in progress is neutral, amber and red only for what waits on the operator (`rules/ui` → Conventions 2).
- **A toast for an event the operator did not start**, a tooltip holding content, a side panel holding an object.
- **The prototype's A/B/C switcher** — the three variants are the views of one interface.

## Glossary

One word per concept on every surface (`rules/ui` → Copy 2). State words come from one map each, in `fsloopui/shared/` (`states.ts`, `liveness.ts`); this table holds their meanings.

| Term | Meaning |
|---|---|
| прогон | One fsloop run: a goal, its folder `.claude/fsloop/runs/<id>/`, its passes |
| проход | One round of a run's stages; a run makes up to N of them («проход 2 из 3») |
| этап | A stage of a pass: настройка проекта, карта, разведка, декомпозиция, юниты в работе, ревью, исправление, проверка исправлений, приёмка, интеграция, завершение |
| юнит | One piece of work a run cuts from its goal, with a brief, an implementer and a commit |
| находка | One defect a critic or an implementer reported, with its rule, observation and fix |
| отчёт критика | What a critic launch wrote: its findings, scores and the other parts of the report («части отчёта»: «Не проверено», «Идеи», «План правок», «Допущения» …) |
| отчёт запуска | What any other agent launch wrote: the map, an implementer's result, research |
| запуск агента | One agent the run started: a critic, an implementer, the map, research |
| кадр | A screenshot of a surface the run took for its critics (`shots/*.png`) |
| соглашение прогона | A design decision the run's design check fixed once for every unit |
| журнал решений | The run's own decisions taken without the operator, with why (`journal.md`); each entry is one «решение», by its number («решение #12») |
| оценка | The operator's verdict on a finding: согласен, не согласен, не та серьёзность, ложная находка; «с возражением» — every verdict but «согласен», the operator disputes the finding |
| решение прогона | What the run decided about a finding: в исправление, кандидат, открыта, дубликат, отклонена, отброшена, без решения |
| critical | A finding that breaks work or data: read first |
| major | A finding that breaks a rule so that the user will notice |
| minor | A small breach of a rule, fixed when convenient |

State words:

- **Юнит** — черновик · готов к работе · пишется · проверяется · отладка · вливается · закоммичен · заблокирован · не записано.
- **Находка** — без решения · кандидат · ждёт юнита · исправляется · заблокирована · исправлена · закрыта · не исправлена · повторилась · открыта · дубликат · отклонена · отброшена.
- **Запуск агента** — работает · завершён · нет отчёта.
- **Проход** — следующий проход (the findings it took to fix go to the next pass) · нечего исправлять (it took no finding to fix: the run makes no more passes) · предел проходов (the run's last pass: the findings left stay open).
- **Активность прогона** — работает (a write in the last 5 minutes) · тихо (5–30 minutes) · молчит (over 30 minutes) · закрыт · не записано.
- **Absent values** — «—» (no value exists), «не найден» (an id the folder does not hold), «не записано» (a field the folder lacks).

## Surfaces

| Surface | What it answers |
|---|---|
| Прогоны (боковая панель) | Which of my fsloop runs across projects are working, silent or closed, with what settings and in what state |
| Прогон (страница) | What this run is, where it stands now and what it produced |
| Находки | What this run's critics found, what the run decided on each finding, and which ones I disagree with |
| Юниты | Which units are committed and with what commit, which are in work and for how long, which wait and for whom, which are blocked and why, and which findings each one closes |
| Отчёты | What each agent launch of this run wrote, and what follows from it: findings, scores, result |
| Соглашения | Which shared design solutions this run agreed for its interface |
| Журнал | What the run decided without me, why, and on what basis |
| Набор компонентов (`/kit`, dev) | How each shared part of fsloopUI looks and behaves in its states, at production's sizes |

## Success criteria

- Every finding of a run reads in comfort — with its text, the run's decision and the operator's verdict — without opening the run folder.
- The interface updates live, without a reload, and never moves what the operator reads.
- The sidebar shows, for every run across projects, its project, its settings and its state.
