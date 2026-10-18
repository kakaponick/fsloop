# fsloop

Скилл Claude Code: задача любого размера (фикс, фича, страница, сервис, воркер, крон, миграция) от промпта до коммита без надзора. Каждая единица работы — вертикальный срез через все слои, UI и бэкенд вместе. fsloop строит карту кода и неизвестных, проверяет неизвестное на живой системе (спайки), режет работу на юниты и ведёт каждый red → green в отдельном worktree, отлаживает, ревьюит (код, рантайм, UI через impeccable), коммитит по юниту, интегрирует и проверяет деплой. С `N` после этого оценивает результат и дорабатывает, пока не сойдётся.

## Состав

| Путь | Что |
| --- | --- |
| `claude/skills/fsloop/SKILL.md` | оркестратор `/fsloop [N] [jK] <goal>` |
| `claude/skills/fsloop/law/` | закон fsloop: `ux.md` (законы 0–9), `ui.md` (вёрстка, конвенции, шапка страницы, порядок приоритетов), `table.md` (таблицы #1–15), `code.md`, `tests.md` (1–12) — базовая планка для любого репо |
| `claude/skills/fsloop/inline.md` | режим inline: маленькая цель в текущей рабочей копии, без worktree |
| `claude/skills/fsloop/ui.md` | UI-часть: impeccable по стадиям, baseline, новая поверхность, кадры |
| `claude/skills/fsloop/backend.md` | сессии и живые критерии |
| `claude/skills/fsloop/spike.md` | `/fsloop spike <question>` — исследование неизвестного |
| `claude/skills/fsloop/assess.md` | оценка и повторные проходы при `N` |
| `claude/skills/fsloop/json-merge.mjs`, `merge.attributes` | merge-драйвер i18n-каталогов по ключам: юниты, дописывающие ключи в один JSON, не конфликтуют |
| `claude/skills/fsloop/spike-lease.mjs` | аренда аккаунтов из `.spike/sessions/` и зеркало `.spike/` в worktree — [опционально](#spike-lease-опционально) |
| `claude/skills/fsloop/spend.mjs` | расход токенов по сабагентам сессии, для отчёта |
| `claude/skills/fsloop/debug.md` | приёмы `fsloop-debug`: тест красный в общем прогоне и зелёный один, неверное значение глубоко в стеке |
| `claude/skills/fsloop/find-polluter.mjs` | бисекция тест-файла, который загрязняет состояние жертвы; любой раннер с JUnit-отчётом (`--run`), для bun — без настройки |
| `claude/agents/` | `fsloop-implement`, `fsloop-debug`, `fsloop-critic`, `spike-researcher`, `prod-check`, `cold-read` (холодное чтение новых UI-строк) |
| `claude/hooks/spike-guard.mjs` | блок ручных ссылок, копий сессий и удаления аренды |

## Требования

- git, Node 20+.
- Плагин `mattpocock-skills`: агенты грузят `tdd`, `diagnosing-bugs`, `codebase-design`, `code-review`.
  ```
  /plugin marketplace add mattpocock/skills
  /plugin install mattpocock-skills@mattpocock
  ```
- Для UI-юнитов — скилл [impeccable](https://github.com/pbakaus/impeccable) в `.claude/skills/` проекта или в `~/.claude/skills/`. Если в проекте есть `components.json` (shadcn/ui), пригодится и скилл `shadcn`.
- Необязательно:
  - скилл `ai-socket` — вопросы разработчику через Telegram (код входа, деньги, аккаунт). Без него такой шаг уходит в OPEN.
  - скилл `prod` (или раздел в `CLAUDE.md`) с командами чтения продакшена — для формы данных на Map и для `prod-check` после пуша. Без него форма берётся из схемы, проверки деплоя нет.
- Windows: `spike-lease` делает junction (`mklink /J`) и hardlink, прав администратора не нужно.

## Установка в проект

```
git clone https://github.com/kakaponick/fsloop
node fsloop/install.mjs <путь к репо проекта>
```

Установщик:
- копирует `claude/` в `<repo>/.claude/`;
- добавляет хук `spike-guard` в `.claude/settings.json`;
- добавляет `.spike/` в `.gitignore`, а `.claude/fsloop/` в `.git/info/exclude`;
- создаёт `.spike/{data,sessions,toolkits}` и шаблон `README.md`.

Повторный запуск обновляет файлы и не дублирует хук.

## Проект

fsloop берёт всё про проект из его `CLAUDE.md` (и файлов правил, которые тот называет) и из манифеста пакетов: установку, проверку типов, линт, тесты (один файл и весь набор), гарды каталогов, сборку, генерацию и применение миграций, запуск воркера, основную ветку, машинный лок, инструменты скриншотов, строгие правила. Всё это он записывает в `common.md` прогона, и агенты читают только его. Чего в проекте нет — решение, оно попадает в отчёт. Чем подробнее `CLAUDE.md`, тем меньше догадок.

**Файл фактов `.claude/fsloop.md`** (необязательный) закрепляет всё это явно, и прогон берёт его как есть, ничего не выводя заново: заполненную таблицу ролей-команд из SKILL.md → Project facts, карту ролей UI (`law/ui.md` → Roles: какой компонент — статус-точка, тултип-глоссарий, адаптивный тулбар, таблица…) и то, чего документация проекта не говорит, а прогон должен знать. С ним поведение fsloop в проекте одинаково от прогона к прогону.

**Закон.** fsloop несёт свою планку: `law/` — UX, UI, код, тесты. Она действует в любом репо; правила проекта (`CLAUDE.md` и файлы, которые он называет) уточняют или переопределяют её там, где говорят о том же. Ссылки в находках — по номеру: `ux 1`, `table #10`, `tests 6`, `code` → Idempotent. Правило с пометкой *default* — выбор для плотного рабочего инструмента; `PRODUCT.md` или `DESIGN.md` другого продукта может его заменить.

Кадры UI снимает только оркестратор и только дважды: baseline на Map и final на Review. Агенты не открывают ни браузер, ни dev-сервер: состояния доказывают тестами, а кадр читают по пути.

Для UI fsloop читает `PRODUCT.md` и `DESIGN.md` (это файлы impeccable), закон fsloop `law/ui.md` и `law/ux.md`, а поверх — правила UI/UX проекта, если `CLAUDE.md` их называет. Кадры снимает инструмент скриншотов проекта, если `CLAUDE.md` описывает четыре роли: поднять базу из фикстуры, запустить dev-сервер, снять кадр, погасить. Без такого инструмента — dev-сервер и `npx playwright screenshot`.

i18n-каталоги, которые сливаются по ключам, перечислены в `claude/skills/fsloop/merge.attributes` (`messages/*.json`, `locales/**/*.json` …). Если у вас другой путь — допишите его туда.

## Spike lease (опционально)

Нужен, только когда агенты работают с живыми аккаунтами — сессиями, которые нельзя поднимать из двух процессов сразу (мессенджеры, кабинеты с привязкой к IP). Если аккаунтов нет, `.spike/sessions/` пуст, `link` даёт пустое зеркало, `acquire` не вызывается — настраивать ничего не нужно.

Как работает:

- Аккаунт — папка `.spike/sessions/<name>/` в основной рабочей копии.
- Каждый worktree прогона получает зеркало `.spike/` ссылками — всё, кроме `sessions/`.
- `acquire` берёт атомарную аренду (`.lease` в папке сессии) и только тогда ссылает папку в worktree. Без аренды папки в worktree нет: скрипт или тест падает на отсутствующем пути, а не делит сессию с другим процессом.
- `spike-guard` блокирует обход: ручные ссылки в `.spike`, копирование из `sessions/`, удаление `.lease`.

```
node .claude/skills/fsloop/spike-lease.mjs link <checkout>
node .claude/skills/fsloop/spike-lease.mjs acquire <checkout> <session> [--wait s]
node .claude/skills/fsloop/spike-lease.mjs release <checkout> <session>
node .claude/skills/fsloop/spike-lease.mjs unlink <checkout>
node .claude/skills/fsloop/spike-lease.mjs status
```

Пробы в worktree не кладите под `.spike/`: это ссылка в основную копию, файл окажется там, а импорты разрешатся от её конфигурации, а не от worktree.

## Запуск

```
/fsloop <goal>              один проход: карта → юниты → ревью → фикс → интеграция
/fsloop 3 <goal>            до 3 проходов с оценкой и доработкой
/fsloop 3 j1 <goal>         последовательно, одна полоса
/fsloop resume <run id>
/fsloop spike <question>    только исследование, без коммита
```

Маленькая цель (меньше 3 юнитов) идёт в режиме inline прямо в текущей рабочей копии. Остальные — в worktree `../fsl/<run id>`, с полосами `../fsl/<run id>-u<k>` для параллельных юнитов. Состояние прогона (журнал, брифы, кадры, отчёт) лежит в `.claude/fsloop/<run id>/`.

Коммиты прогона несут трейлеры `Fsloop-Run`, `Fsloop-Step`, `Fsloop-Pass`, поэтому `git log --grep='Fsloop-Run: <id>'` показывает весь прогон. В конце fsloop пушит в основную ветку. Если `CLAUDE.md` запрещает агенту такой пуш, ветка `fsl/<run id>` уходит в origin, и отчёт называет её для слияния.

## Проверка скриптов

```
node --test claude/skills/fsloop/find-polluter.test.mjs
```
