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
  AddressLink,
  AddressMenu,
  AppDialog,
  ChoiceToggles,
  Clamp,
  copyItem,
  copyLabel,
  CountCombobox,
  CountLink,
  CountSelect,
  CountTabs,
  CountTabsContent,
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
  InView,
  Keys,
  Loading,
  markProps,
  Menu,
  MissingLine,
  NotFound,
  notify,
  NotRecorded,
  OutOfFilter,
  PartFailed,
  PLACE_WHAT,
  RunningText,
  SCROLLER,
  StatusDot,
  copyText,
  useReveal,
  type HeldCounts,
} from "@/ui";
import { Highlight } from "@/table";
import { FINDING_TEXT, frames, GOAL, REPORT_TEXT, RUNS } from "./fixtures.ts";
import { TableSection } from "./table.tsx";

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
            <NotFound kind="entry" id="999" />
            <NotFound kind="convention" id="99" />
          </div>
        </Case>
        <Case label="Id, которого нет в прогоне, — с отметкой поиска по этому id">
          <NotFound kind="unit" id="u77" highlight={(t) => <Highlight text={t} tokens={["u77"]} />} />
        </Case>
        <Case label="Адрес, которого нет в списке: что есть в прогоне и выход">
          <div className="flex flex-col gap-1">
            <MissingLine kind="entry" id="999" range={["1", "143"]} slot="kit-entry-missing" onClose={() => {}} />
            <MissingLine kind="convention" id="99" range={["1", "26"]} slot="kit-convention-missing" onClose={() => {}} />
            <MissingLine kind="convention" id="3" range={null} slot="kit-convention-none" onClose={() => {}} />
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

/** A critic's report's parts: more than a narrow strip holds. */
const PARTS = [
  { value: "findings", label: "Находки", count: 18 },
  { value: "unverified", label: "Не проверено", count: 1 },
  { value: "candidates", label: "Идеи", count: 2 },
  { value: "order", label: "План правок", count: 1 },
  { value: "assumptions", label: "Допущения", count: 14 },
  { value: "frames", label: "Кадры", count: 16 },
  { value: "file", label: "Файл отчёта", count: null },
];

function CountsSection() {
  const [view, setView] = useState("findings");
  const [part, setPart] = useState("findings");
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
      <Case label="Закреплённая полоса вкладок: при прокрутке разделов остаётся вверху на фоне страницы; если вкладки не помещаются, полоса листается вбок">
        <div className="h-48 max-w-md overflow-y-auto rounded-lg border [scrollbar-gutter:stable]">
          <CountTabs sticky value={view} onValueChange={setView} tabs={tabs} label="Разделы прогона — закреплённая полоса" className="px-3">
            {tabs.map((t) => (
              <CountTabsContent key={t.value} value={t.value} className="px-3 pt-3">
                <RunningText text={REPORT_TEXT} />
              </CountTabsContent>
            ))}
          </CountTabs>
        </div>
      </Case>
      <Case label="Полоса шире своего места: не влезшие вкладки — в меню «Ещё N»; выбранная вкладка и «Файл отчёта» остаются в полосе">
        <div className="flex max-w-md flex-wrap items-start rounded-lg border">
          <CountTabs sticky value={part} onValueChange={setPart} tabs={PARTS} label="Части отчёта — свёрнутая полоса" overflow={{ label: "Другие части отчёта", keep: ["file"] }} className="w-auto min-w-0 flex-1 px-1" />
        </div>
      </Case>
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
    <Section id="facts" title="Список фактов" rule="Сначала исход, потом факты, редкие — под «Подробнее», которое помнит своё состояние; столбец подписей не сдвигается, когда оно открыто; пояснение термина — у подписи, а не у значения (ux 9, Layout 3, ui → Glossary)">
      <FactList
        foldKey="kit"
        label="Прогон tga · a098a7d4"
        className="max-w-xl"
        facts={[
          { label: "Режим", value: "worktree" },
          { label: "Этап", value: <StatusDot state={{ tone: "neutral", label: "проход 1 · юниты в работе" }} detail="с 03:04 МСК" />, outcome: true },
          { label: "Активность", glossary: glossaryFrom(LIVENESS, ["working", "quiet", "silent"]), value: <StatusDot state={LIVENESS.working} />, outcome: true },
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
      <Case label="Знак препинания сразу после встроенного кода — без зазора; найденное поиском отмечено той же отметкой, что в таблицах">
        <RunningText text={"Правило: `ux 1`, impeccable critique; см. `.claude/rules/ui.md`. Решение u3 принято через 40 минут."} resolve={resolve} highlight={(t) => <Highlight text={t} tokens={["40", "rules"]} />} />
      </Case>
      <Case label="Код в тексте, который рисует сам вид (renderCode): место в примере соглашения — кнопка «Скопировать место»">
        <RunningText
          text={"Пример: `src/web/shared/part-2.tsx:4` и `ux 1`."}
          renderCode={(body, code) =>
            body.startsWith("src/") ? (
              <Button variant="ghost" size="xs" aria-label={`${copyLabel(PLACE_WHAT)} ${body}`} className="h-auto min-h-5 gap-1 px-0.5 align-baseline font-mono text-xs font-normal" onClick={() => void copyText(body, body)}>
                {code}
                <CopyIcon aria-hidden="true" data-icon="inline-end" className="text-muted-foreground" />
              </Button>
            ) : null
          }
        />
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
          <Case label="Список без фильтра называет строку, исчезнувшую из данных, своим словом: «прогон пропал»">
            <HeldStrip className="max-w-xl rounded-md border" counts={{ fresh: 0, moved: 0, left: 1 }} noun={{ forms: NOUNS.run, gender: "m" }} leftKind="gone" onApply={() => {}} />
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
          <AddressCase />
          <Case label="На экране: номера, которые список показывает, — в строке состояния, в рамке самой широкой формы">
            <div className="flex max-w-xl flex-col gap-1 text-xs text-muted-foreground tabular-nums">
              <div className="flex items-center gap-3 rounded-md border px-3 py-1.5">
                <InView kind="entry" range={["40", "42"]} last="143" />
                <span>143 решения</span>
              </div>
              <div className="flex items-center gap-3 rounded-md border px-3 py-1.5">
                <InView kind="convention" range={null} last="26" />
                <span>26 соглашений</span>
              </div>
            </div>
          </Case>
        </div>
      </div>
    </Section>
  );
}

/** The one form of an object on its list: its number a link to its address, its menu copying it, the list one Tab
 * stop with each item's own links gated, the reveal moving the list's own scroller and nothing above it. */
function AddressCase() {
  const [target, setTarget] = useState<string | null>(null);
  const { scroller, hold } = useReveal(target, (box, n) => box.querySelector<HTMLElement>(`article[data-kit-entry="${n}"]`));
  const entries = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const href = (n: string) => `/kit?entry=${n}#lists`;
  return (
    <Case label="Объект в списке: номер — ссылка на его адрес, меню копирует адрес; одна остановка Tab, ссылки записи — по Tab изнутри; переход двигает только список">
      <div className="flex max-w-xl flex-col gap-2">
        <div className="flex gap-2">
          {["7", "12"].map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => setTarget(n)}>
              Открыть #{n}
            </Button>
          ))}
        </div>
        <div ref={scroller} className={`${SCROLLER} h-48 rounded-lg border`}>
          <FlatList label="Решения" gate>
            {entries.map((n) => (
              <AddressMenu key={n} kind="entry" href={href(n)} header={{ text: `#${n} · Какой путь выбрать?` }}>
                <article
                  tabIndex={-1}
                  data-kit-entry={n}
                  {...flatItem(n)}
                  {...markProps({ target: n === target }, "flex flex-col gap-0.5 rounded-md px-3 py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset")}
                >
                  <p className="m-0 text-xs text-muted-foreground">
                    <AddressLink
                      kind="entry"
                      id={n}
                      href={href(n)}
                      onOpen={() => {
                        hold(n);
                        setTarget(n);
                      }}
                    />{" "}
                    · проход 1 · карта
                  </p>
                  <span>Какой путь выбрать?</span>
                </article>
              </AddressMenu>
            ))}
          </FlatList>
        </div>
      </div>
    </Case>
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
        <Menu
          label="Действия с находкой"
          header={{ text: "p1-review-critic-craft#craft-3", title: "p1-review-critic-craft#craft-3 — The trigger repeats the count" }}
          groups={[[{ label: "Открыть отчёт", onSelect: () => notify.success("Открыт отчёт"), shortcut: "Enter" }], [copyItem("id", "p1-review-critic-craft#craft-3"), { label: copyLabel(PLACE_WHAT), onSelect: () => {}, blocked: "Файл ещё пишется: место появится, когда критик закончит" }]]}
        >
          <Button variant="outline" size="icon-sm" aria-label="Действия с находкой">
            <EllipsisIcon />
          </Button>
        </Menu>
        <Hint label={copyLabel("ссылку")}>
          <Button variant="ghost" size="icon-sm" aria-label={copyLabel("ссылку")} onClick={() => void copyText("http://127.0.0.1:4747/r/tga/a098a7d4", "ссылку")}>
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

function ChoicesSection() {
  const [verdict, setVerdict] = useState<string | null>(null);
  const [severity, setSeverity] = useState("all");
  return (
    <Section id="choices" title="Переключатели выбора" rule="Нажатый — залит цветом текста; клавиша выбора — в подсказке своего переключателя, по наведению и фокусу (Conventions 11)">
      <Case label="Оценка: клавиши 1–4 в подсказке каждого переключателя">
        <ChoiceToggles label="Ваша оценка" value={verdict} onChoose={setVerdict} keyHint="Оценить клавишей" choices={Object.keys(VERDICT).map((v, i) => ({ value: v, label: VERDICT[v as keyof typeof VERDICT].compact, keyCode: `Digit${i + 1}` }))} />
      </Case>
      <Case label="Серьёзность находок отчёта: без клавиш, без подсказки">
        <ChoiceToggles label="Серьёзность находок" value={severity} onChoose={setSeverity} choices={["all", "critical", "major", "minor"].map((s) => ({ value: s, label: s === "all" ? "все" : s }))} />
      </Case>
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
  { id: "choices", title: "Переключатели выбора", Body: ChoicesSection },
  { id: "table", title: "Таблица данных", Body: TableSection },
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
