// The kit page, /kit in dev: every shared component of src/ui in its states, over fixture data at production's
// sizes, for frames and review. A unit that adds a shared part adds its section to SECTIONS.
import { CopyIcon, EllipsisIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LIVENESS } from "../../shared/liveness.ts";
import { DECISION, FINDING_STATUS, LAUNCH_STATE, SEVERITY, UNIT_STATE, VERDICT, type StateEntry } from "../../shared/states.ts";
import { NOUNS } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AppDialog,
  Clamp,
  copyItem,
  CountCombobox,
  CountLink,
  CountSelect,
  CountTabs,
  Dash,
  EmptyState,
  FactList,
  flatItem,
  FlatList,
  FrameStrip,
  GlossaryTooltip,
  glossaryFrom,
  HeldStrip,
  Hint,
  Keys,
  Loading,
  markProps,
  Menu,
  NotFound,
  notify,
  NotRecorded,
  OutOfFilter,
  PartFailed,
  RunningText,
  StatusDot,
  copyText,
  type HeldCounts,
} from "@/ui";
import { FINDING_TEXT, frames, GOAL, REPORT_TEXT, RUNS } from "./fixtures.ts";

function Section({ id, title, rule, children }: { id: string; title: string; rule: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={`${id}-title`} className="m-0 text-base font-semibold">
          {title}
        </h2>
        <p className="m-0 text-xs text-muted-foreground">{rule}</p>
      </div>
      {children}
    </section>
  );
}

function Case({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Dots({ title, map }: { title: string; map: Record<string, StateEntry> }) {
  return (
    <Case label={title}>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {Object.entries(map).map(([key, entry]) => (
          <li key={key}>
            <StatusDot state={entry} />
          </li>
        ))}
      </ul>
    </Case>
  );
}

function StatesSection() {
  return (
    <Section id="dots" title="Статусная точка" rule="Тон из общей карты состояний, слово рядом; цвет — только точка (rules/ui → Conventions 1, 2)">
      <div className="grid grid-cols-2 gap-6 @3xl:grid-cols-4">
        <Dots title="Юнит" map={UNIT_STATE} />
        <Dots title="Серьёзность" map={SEVERITY} />
        <Dots title="Решение прогона" map={DECISION} />
        <Dots title="Состояние находки" map={FINDING_STATUS} />
        <Dots title="Оценка" map={VERDICT} />
        <Dots title="Запуск агента" map={LAUNCH_STATE} />
        <Dots title="Активность прогона" map={LIVENESS} />
        <Case label="В ячейке: состояние · возраст · причина">
          <div className="flex w-48 flex-col gap-1">
            <StatusDot state={UNIT_STATE.blocked} detail={["2 ч", "ждёт решения по красному гейту на этапе ревью"]} truncate />
            <StatusDot state={LAUNCH_STATE.running} detail="12 мин" truncate />
          </div>
        </Case>
      </div>
    </Section>
  );
}

function AbsentSection() {
  return (
    <Section id="absent" title="Отсутствующие значения" rule="«—», «не найден», «не записано» — по одной общей части (Conventions 4, 5)">
      <div className="flex flex-wrap gap-8">
        <Case label="Значения нет">
          <Dash />
        </Case>
        <Case label="Id без объекта">
          <div className="flex flex-col gap-1">
            <NotFound kind="unit" id="u7" />
            <NotFound kind="finding" id="p1-review-critic-craft#craft-12" />
          </div>
        </Case>
        <Case label="Поле не записано">
          <div className="flex flex-col gap-1">
            <NotRecorded />
            <NotRecorded cause="в папке нет run.json" />
          </div>
        </Case>
      </div>
    </Section>
  );
}

function CountsSection() {
  const [view, setView] = useState("findings");
  const tabs = [
    { value: "findings", label: "Находки", count: 723 },
    { value: "units", label: "Юниты", count: 42 },
    { value: "reports", label: "Отчёты", count: 97 },
    { value: "conventions", label: "Соглашения", count: 0 },
    { value: "journal", label: "Журнал", count: 143 },
  ];
  return (
    <Section id="counts" title="Счётчики и вкладки" rule="Ссылка — только выше нуля и когда список покажет то же число; ноль — приглушённый «0» (Conventions 7, Layout 4)">
      <CountTabs value={view} onValueChange={setView} tabs={tabs} label="Разделы прогона" />
      <div className="flex flex-wrap items-center gap-6">
        <CountLink count={2} tone="danger" suffix="critical" href="#counts" onOpen={() => notify.success("Открыты находки: critical")} />
        <CountLink count={205} tone="warning" suffix="major" href="#counts" onOpen={() => notify.success("Открыты находки: major")} />
        <CountLink count={0} tone="danger" suffix="critical" href="#counts" />
        <CountLink count={34} noun={NOUNS.launch} linkable={false} />
        <CountLink count={21} noun={NOUNS.finding} href="#counts" onOpen={() => notify.success("Открыты находки юнита u3")} />
      </div>
    </Section>
  );
}

function FactsSection() {
  return (
    <Section id="facts" title="Список фактов" rule="Сначала исход, потом факты, редкие — под «Подробнее», которое помнит своё состояние (ux 9, Layout 3)">
      <FactList
        foldKey="kit"
        label="Прогон tga · a098a7d4"
        className="max-w-xl"
        facts={[
          { label: "Режим", value: "worktree" },
          { label: "Этап", value: <StatusDot state={{ tone: "neutral", label: "проход 1 · юниты в работе" }} detail="с 03:04 МСК" />, outcome: true },
          { label: "Активность", value: <StatusDot state={LIVENESS.working} />, outcome: true },
          { label: "Гейт", value: <StatusDot state={{ tone: "warning", label: "красный гейт: типы" }} detail="u7 — tsc упал на fsloopui/src/app" />, outcome: true },
          { label: "Юниты", value: "2 из 20 закоммичено · 3 пишутся", outcome: true },
          { label: "Модели", value: "claude-opus-5-5" },
          { label: "Начат", value: "16.11 03:04 МСК" },
          { label: "Запуски агентов", value: <CountLink count={34} noun={NOUNS.launch} href="#facts" /> },
        ]}
        more={[
          { label: "Рабочая копия", value: <span className="font-mono text-xs">C:/Users/kakaponick/Desktop/dev/fsl/a098a7d4</span> },
          { label: "Сессии", value: "3" },
          { label: "Версия run.json", value: "4" },
        ]}
      />
    </Section>
  );
}

function TextSection() {
  const resolve = (token: string) => (/^u\d+$/.test(token) ? `#unit-${token}` : /#[\w-]+$/.test(token) && token.startsWith("p1-") ? `#finding-${token}` : null);
  return (
    <Section id="text" title="Текст и обрезка" rule="Текст держит форму на мере чтения; «развернуть» — только когда обрезка что-то прячет (Layout 5, 6)">
      <div className="grid gap-6 @4xl:grid-cols-2">
        <Case label="Цель прогона, 8 617 символов, 50 строк — обрезана до двух строк">
          <Clamp what="цель прогона">
            <RunningText text={GOAL} measure={false} />
          </Clamp>
        </Case>
        <Case label="Короткая цель — без триггера">
          <Clamp what="цель прогона">Довести интерфейс TGA до прод-версии</Clamp>
        </Case>
        <Case label="Цель на карточке — без триггера, переносы схлопнуты">
          <Clamp what="цель прогона" expandable={false} className="w-72 text-muted-foreground">
            {GOAL.replace(/\s+/g, " ")}
          </Clamp>
        </Case>
      </div>
      <Case label="Находка, 1 920 символов, со ссылками на id">
        <RunningText text={FINDING_TEXT} resolve={resolve} />
      </Case>
      <Case label="Файл отчёта с таблицей">
        <RunningText text={REPORT_TEXT} resolve={resolve} />
      </Case>
    </Section>
  );
}

function ListsSection() {
  const [held, setHeld] = useState<HeldCounts>({ fresh: 2, moved: 1, left: 0 });
  const [current, setCurrent] = useState(RUNS[0].key);
  return (
    <Section id="lists" title="Плоский список и удержанный порядок" rule="Одна остановка Tab, ↑/↓ и Enter; новое ждёт в строке внизу (Conventions 8, Live data 1–2)">
      <div className="grid gap-6 @3xl:grid-cols-[19.75rem_minmax(0,1fr)]">
        <div className="flex h-96 flex-col overflow-hidden rounded-lg border">
          <div className="min-h-0 flex-1 overflow-y-auto p-1 [scrollbar-gutter:stable]">
            <FlatList label="Прогоны">
              {RUNS.map((run, i) => (
                <a
                  key={run.key}
                  href={`#lists`}
                  aria-current={run.key === current ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    setCurrent(run.key);
                  }}
                  {...flatItem(run.key)}
                  {...markProps({ edge: i === 2, target: run.key === current }, "grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2 rounded-md px-2 py-1 text-foreground no-underline outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50")}
                >
                  <span className="font-medium">{run.project}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{run.id}</span>
                  <StatusDot state={run.liveness} />
                </a>
              ))}
            </FlatList>
          </div>
          <HeldStrip counts={held} noun={{ forms: NOUNS.run, gender: "m" }} onApply={() => setHeld({ fresh: 0, moved: 0, left: 0 })} />
        </div>
        <div className="flex flex-col gap-3">
          <Case label="Строка удержанного порядка: три глагола">
            <div className="flex max-w-xl flex-col gap-2">
              <HeldStrip className="rounded-md border" counts={{ fresh: 12, moved: 0, left: 0 }} noun={{ forms: NOUNS.finding, gender: "f" }} onApply={() => {}} />
              <HeldStrip className="rounded-md border" counts={{ fresh: 0, moved: 0, left: 3 }} noun={{ forms: NOUNS.finding, gender: "f" }} onApply={() => {}} />
              <HeldStrip className="rounded-md border" counts={{ fresh: 1, moved: 2, left: 1 }} noun={{ forms: NOUNS.finding, gender: "f" }} onApply={() => {}} />
              <HeldStrip className="rounded-md border" counts={{ fresh: 0, moved: 0, left: 0 }} noun={{ forms: NOUNS.finding, gender: "f" }} onApply={() => {}} />
            </div>
          </Case>
          <Case label="Метки строк">
            <div className="flex max-w-xl flex-col">
              <div {...markProps({ edge: true }, "px-3 py-1.5")}>Изменилась в последние минуты</div>
              <div {...markProps({ target: true }, "flex items-baseline gap-2 px-3 py-1.5")}>
                Открыта по ссылке <OutOfFilter />
              </div>
              <div className="px-3 py-1.5">Обычная строка</div>
            </div>
          </Case>
        </div>
      </div>
    </Section>
  );
}

function StatesOfAViewSection() {
  return (
    <Section id="view-states" title="Состояния области" rule="Загрузка — слово и спиннер в области её размера; пусто — почему и что дальше; сбой — на своём месте (Strict 2, Conventions 14, 15)">
      <div className="grid gap-4 @3xl:grid-cols-2">
        <Case label="Первая загрузка таблицы">
          <div className="h-40">
            <Loading framed />
          </div>
        </Case>
        <Case label="Ещё нет">
          <EmptyState form="not-yet" noun={NOUNS.unit} step="decompose" />
        </Case>
        <Case label="Не было">
          <EmptyState form="never" noun={NOUNS.finding} />
        </Case>
        <Case label="Отфильтровано до нуля">
          <EmptyState form="filtered" noun={NOUNS.finding} filters={["Серьёзность: major и выше", "Юнит: u3"]} onReset={() => notify.success("Фильтры сброшены")} />
        </Case>
        <Case label="Часть не прочитана" className="@3xl:col-span-2">
          <div className="flex flex-col gap-2">
            <PartFailed what="Отчёт p1-review-critic-craft.md" cause="файл занят другим процессом" onRetry={() => notify.success("Отчёт прочитан")} />
            <PartFailed what="Бриф units/u3/brief.md" cause="файла нет" />
          </div>
        </Case>
      </div>
    </Section>
  );
}

function FramesSection() {
  return (
    <Section id="frames" title="Кадры" rule="Миниатюра держит свой размер; просмотр листает ‹ ›, ←/→ и колесом, Esc возвращает фокус (Layout 7)">
      <FrameStrip frames={frames(8)} />
      <Case label="Больше шестнадцати — «ещё N»">
        <FrameStrip frames={frames(19)} />
      </Case>
    </Section>
  );
}

function OverlaysSection() {
  const [view, setView] = useState("all");
  const [units, setUnits] = useState<string[]>(["u3"]);
  const [open, setOpen] = useState(false);
  return (
    <Section id="overlays" title="Выбор, меню, подсказки, диалог, уведомления" rule="Select до 7 вариантов, дальше — combobox; подсказка — только текст; ошибка остаётся до закрытия (ui → Choosing from a list, Tooltip, Toast)">
      <div className="flex flex-wrap items-center gap-2">
        <CountSelect
          label="Вид"
          value={view}
          onValueChange={setView}
          options={[
            { value: "all", label: "Все", count: 723 },
            { value: "unrated", label: "Без оценки", count: 723 },
            { value: "fix", label: "В исправление", count: 163 },
            { value: "candidate", label: "Кандидаты", count: 506 },
            { value: "committed", label: "Закоммичены", count: 0 },
          ]}
        />
        <CountCombobox
          label="Юнит"
          placeholder="Найти юнит"
          value={units}
          onValueChange={setUnits}
          options={Array.from({ length: 42 }, (_, i) => ({ value: `u${i + 1}`, label: `u${i + 1}`, count: (i * 7) % 23 }))}
        />
        <Menu label="Действия с находкой" groups={[[{ label: "Открыть отчёт", onSelect: () => notify.success("Открыт отчёт") }], [copyItem("id", "p1-review-critic-craft#craft-3"), { label: "Скопировать место", onSelect: () => {}, blocked: "Критик не указал файл и строку находки" }]]}>
          <Button variant="outline" size="icon-sm" aria-label="Действия с находкой">
            <EllipsisIcon />
          </Button>
        </Menu>
        <Hint label="Скопировать ссылку">
          <Button variant="ghost" size="icon-sm" aria-label="Скопировать ссылку" onClick={() => void copyText("http://127.0.0.1:4747/r/tga/a098a7d4", "ссылку")}>
            <CopyIcon />
          </Button>
        </Hint>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          Поиск <Keys codes={["Slash"]} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <span>
          <GlossaryTooltip term="Серьёзность" entries={glossaryFrom(SEVERITY, ["critical", "major", "minor"])} />
        </span>
        <AppDialog
          open={open}
          onOpenChange={setOpen}
          trigger={<Button variant="outline">Оценить…</Button>}
          title="Оценка для 12 находок"
          description="Одна оценка и одна заметка лягут на каждую выбранную находку."
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => setOpen(false)}>Сохранить оценку</Button>
            </>
          }
        >
          <RunningText text={FINDING_TEXT} />
        </AppDialog>
        <Button variant="outline" onClick={() => notify.success("Скопировано: id")}>
          Успех
        </Button>
        <Button variant="outline" onClick={() => notify.error("Оценка не сохранилась", { cause: "сервер fsloopUI не ответил", action: { label: "Повторить", onClick: () => notify.success("Оценка сохранена") } })}>
          Ошибка с повтором
        </Button>
      </div>
    </Section>
  );
}

/** The kit's sections, in reading order; a unit with a shared part of its own adds one. */
export const SECTIONS: { id: string; title: string; Body: () => ReactNode }[] = [
  { id: "dots", title: "Статусная точка", Body: StatesSection },
  { id: "absent", title: "Отсутствующие значения", Body: AbsentSection },
  { id: "counts", title: "Счётчики и вкладки", Body: CountsSection },
  { id: "facts", title: "Список фактов", Body: FactsSection },
  { id: "text", title: "Текст и обрезка", Body: TextSection },
  { id: "lists", title: "Плоский список", Body: ListsSection },
  { id: "view-states", title: "Состояния области", Body: StatesOfAViewSection },
  { id: "frames", title: "Кадры", Body: FramesSection },
  { id: "overlays", title: "Выбор, меню, диалог", Body: OverlaysSection },
];

export function Kit() {
  return (
    <div className="@container mx-auto flex max-w-6xl flex-col gap-8 px-5 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-lg font-semibold">fsloopUI · набор компонентов</h1>
        <p className="m-0 max-w-measure text-muted-foreground">Общие части интерфейса в их состояниях, на данных размера настоящих прогонов. Светлая и тёмная тема — по системе.</p>
        <nav aria-label="Разделы набора" className="flex flex-wrap gap-x-4 gap-y-1">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-muted-foreground underline decoration-foreground/30 underline-offset-2 hover:text-foreground">
              {s.title}
            </a>
          ))}
        </nav>
      </header>
      {SECTIONS.map(({ id, Body }, i) => (
        <div key={id} className="flex flex-col gap-8">
          {i > 0 && <Separator />}
          <Body />
        </div>
      ))}
    </div>
  );
}
