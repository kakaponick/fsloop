// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { glossaryLines } from "../ui/index.ts";
import { PASS_OUTCOME } from "../../shared/states.ts";
import { readPref } from "../ui/storage.ts";
import { hiddenCauses } from "./facts.tsx";
import { ObjectLink, objectHref, resolverFor } from "./links.tsx";
import { commitsLine, dataAgeText, lostText, outcomeLine, passesLine, PASSES_GLOSSARY, runNotFoundText, emptyRootText, settingsGlossary, spendLine, tabTitle, waitsMoreText } from "./words.ts";
import { fixtureApp, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";
import { applyStylesheet, contentWidth, innerWidth, textWidth } from "./layout-testing.ts";

const words = (s: string) => s.split(" ").length;
const px = (value: string) => Number.parseFloat(value) || 0;

describe("the run page's words, built once", () => {
  test("the verdict of a closed run", () => {
    expect(outcomeLine({ pushed: true, goalMet: true, held: [] })).toEqual({ tone: "success", text: "цель достигнута · коммиты отправлены" });
    expect(outcomeLine({ pushed: false, goalMet: false, held: [] })).toEqual({ tone: "neutral", text: "цель не достигнута · коммиты не отправлены" });
    expect(outcomeLine({ pushed: true, goalMet: null, held: [] })).toEqual({ tone: "neutral", text: "коммиты отправлены" });
    expect(outcomeLine(null)).toEqual({ tone: "neutral", text: "не записано" });
  });

  test("p1-decompose-design-check cand-1 · the passes in one line, each with its outcome, the findings it took and why in the title", () => {
    const two = passesLine([
      { pass: 1, taken: 60, outcome: "next", why: "60 critical and major above the bar" },
      { pass: 2, taken: 0, outcome: "converged", why: "" },
    ]);
    expect(two.text).toBe("проход 1 — следующий проход · проход 2 — нечего исправлять");
    expect(words(two.text)).toBe(11);
    expect(two.title).toBe("Проход 1 — следующий проход: 60 находок в исправление. 60 critical and major above the bar\nПроход 2 — нечего исправлять");
    expect(passesLine([{ pass: 1, taken: 3, outcome: "paused", why: "" }]).text).toBe("проход 1 — paused");
    expect(passesLine([])).toEqual({ text: "ни один проход ещё не закончен", title: "ни один проход ещё не закончен" });
    // improve-11 (3) · a stalled pass reads in Russian, never the raw word (the real runs tga/96a6e2db, max-auto/1e23e0da)
    const stalled = passesLine([{ pass: 2, taken: 26, outcome: "stalled", why: "the count of critical+major above the bar rose from 22 to 26" }]);
    expect(stalled.text).toBe("проход 2 — без продвижения");
    expect(words(stalled.text)).toBe(5);
    expect(stalled.title).toBe("Проход 2 — без продвижения: 26 находок в исправление. the count of critical+major above the bar rose from 22 to 26");
    expect(glossaryLines(PASSES_GLOSSARY)).toEqual([
      "следующий проход — Взятые в исправление находки исправит следующий проход.",
      "нечего исправлять — Проход не взял находок в исправление: проходов больше нет.",
      "предел проходов — Последний проход прогона: оставшиеся находки открыты.",
      "без продвижения — Серьёзных находок не стало меньше: новых проходов нет.",
    ]);
  });

  test("improve-11 (1), design-7 · «Коммиты» never reads «0 коммитов» beside committed units: a record without them is «не записано» with its cause", () => {
    const missing = commitsLine({ commits: 0, units: { committed: 30, implement: 2 } });
    expect(missing).toEqual({ recorded: false, text: "не записано: в записи прогона нет коммитов" });
    expect(words(missing.text)).toBe(7);
    expect(commitsLine({ commits: null, units: { committed: 30 } })).toEqual({ recorded: false, text: "не записано: в записи прогона нет коммитов" });
    expect(commitsLine({ commits: null, units: { implement: 1 } })).toEqual({ recorded: false, text: "не записано" });
    expect(commitsLine({ commits: 0, units: { implement: 1 } })).toEqual({ recorded: true, text: "0 коммитов" });
    expect(commitsLine({ commits: 31, units: { committed: 30 } })).toEqual({ recorded: true, text: "31 коммит" });
  });

  test("p2-verdict craft-5 · PRODUCT.md → Glossary holds every pass outcome word, with its meaning, and «с возражением» under «оценка»", () => {
    // vitest runs in fsloopui/; PRODUCT.md sits at the repo's root.
    const product = readFileSync(join(process.cwd(), "..", "PRODUCT.md"), "utf8").replace(/\r\n/g, "\n");
    const passLine = product.split("\n").find((l) => l.startsWith("- **Проход** — "));
    expect(passLine).toBe(
      "- **Проход** — следующий проход (the findings it took to fix go to the next pass) · нечего исправлять (it took no finding to fix: the run makes no more passes) · предел проходов (the run's last pass: the findings left stay open) · без продвижения (the critical and major findings did not fall since the pass before: the run makes no more passes).",
    );
    for (const k of Object.keys(PASS_OUTCOME) as (keyof typeof PASS_OUTCOME)[]) expect(passLine).toContain(`${PASS_OUTCOME[k].compact} (`);
    const verdictRow = product.split("\n").find((l) => l.startsWith("| оценка |"));
    expect(verdictRow).toBe("| оценка | The operator's verdict on a finding: согласен, не согласен, не та серьёзность, ложная находка; «с возражением» — every verdict but «согласен», the operator disputes the finding |");
  });

  test("p1-decompose-u3-shape cand-2 · the run's tokens: agents and the orchestrator in one compact total, the split in the title", () => {
    const spend = { launches: { input: 1000, output: 2000, cacheWrite: 0, cacheRead: 5_000_000, boot: 3, continuations: 1 }, orchestrator: { input: 500, output: 500, cacheWrite: 0, cacheRead: 1_000_000 } };
    // num groups thousands with a no-break space
    expect(spendLine(spend)).toEqual({ text: "6 млн токенов", title: "запуски агентов 5 млн токенов · сессии прогона 1 млн токенов\nвход 1500 · выход 2500 · запись в кэш 0 · чтение кэша 6 000 000" });
    expect(spendLine({ ...spend, orchestrator: null })).toEqual({ text: "5 млн токенов", title: "запуски агентов 5 млн токенов · сессии прогона не записаны\nвход 1000 · выход 2000 · запись в кэш 0 · чтение кэша 5 000 000" });
    expect(spendLine(null)).toBeNull();
  });

  test("cand-8 · the settings' glossary: the mode, «проход», the mirror — only those the row shows, each within its bound", () => {
    const card = { mode: "worktree", N: 2, K: 3, models: ["claude-opus-5-5"], mirror: true };
    expect(glossaryLines(settingsGlossary(card))).toEqual([
      "worktree — прогон работает в своей копии репозитория, каждый юнит — в своей",
      "проход — один круг этапов прогона: работа, ревью, исправление, приёмка",
      "зеркало .spike — общая папка исследований видна в копии каждого юнита",
    ]);
    expect(glossaryLines(settingsGlossary({ ...card, mode: "inline", N: null, mirror: false }))).toEqual(["inline — прогон работает прямо в рабочей копии проекта, без копий для юнитов"]);
    expect(settingsGlossary({ ...card, mode: "init", N: null, mirror: null })).toEqual([]);
  });

  test("craft-9 · «Ждёт вас» over its held box: the causes that start below the box's last line are «ещё N», the line they need kept", () => {
    const rows = (tops: number[], h = 20) => tops.map((top) => ({ top, bottom: top + h }));
    // Everything fits: nothing hidden.
    expect(hiddenCauses(40, rows([0, 20]), 20)).toBe(0);
    // Opened at «ничего» (a two-line floor), three causes arrive: the first shows, two wait behind «ещё 2».
    expect(hiddenCauses(40, rows([0, 20, 40]), 20)).toBe(2);
    // A cause of two lines and one more: the first starts in view, the second is «ещё 1».
    expect(hiddenCauses(40, [{ top: 0, bottom: 40 }, { top: 40, bottom: 60 }], 20)).toBe(1);
    const more = waitsMoreText(2);
    expect(more).toBe("ещё 2 · показать");
    expect(words(more)).toBe(4);
  });

  test("the tab title, «● » on a change the hidden tab missed", () => {
    expect(tabTitle({ project: "admin", id: "a5b5ec85", stage: "приёмка" }, false)).toBe("fsloopUI · admin · a5b5ec85 · приёмка");
    expect(tabTitle({ project: "admin", id: "a5b5ec85", stage: "приёмка" }, true)).toBe("● fsloopUI · admin · a5b5ec85 · приёмка");
  });

  test("the frame's messages name the run, the root and what comes next", () => {
    const missing = runNotFoundText("077e72d5", ["C:/Users/op/dev"]);
    expect(missing).toBe("Прогон 077e72d5 не найден: его папки больше нет в C:/Users/op/dev");
    expect(words(missing)).toBe(10);
    const empty = emptyRootText(["C:/Users/op/dev"]);
    expect(empty).toBe("В C:/Users/op/dev нет прогонов fsloop. Новый появится здесь сам, когда fsloop создаст его папку.");
    expect(words(empty)).toBe(14);
  });

  test("lost connection and data age, in МСК through the shared function", () => {
    expect(lostText(NOW - 3 * MIN, NOW)).toBe("Нет связи с сервером fsloopUI · данные от 19:38 МСК");
    expect(lostText(NOW - 3 * MIN, NOW, { compact: true })).toBe("Нет связи · данные от 19:38 МСК");
    expect(lostText(Date.parse("2026-11-15T20:00:00Z"), NOW)).toBe("Нет связи с сервером fsloopUI · данные от 15.11 23:00 МСК");
    expect(lostText(null, NOW)).toBe("Нет связи с сервером fsloopUI");
    expect(dataAgeText(NOW - 5 * MIN, NOW)).toBe("обновлено 5 мин назад");
    expect(dataAgeText(NOW - 20_000, NOW)).toBe("обновлено меньше минуты назад");
  });
});

describe("the run page's frame", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp({ only: [0, 7, 24, 40] });
  });
  afterAll(() => fx.close());
  afterEach(() => fx.answer(null));

  const header = () => document.querySelector("[data-slot=run-header]") as HTMLElement;
  const factList = () => header().querySelector("[data-slot=fact-list]") as HTMLElement;
  const facts = () => [...factList().querySelectorAll("dt")].map((dt) => [dt.textContent, (dt.nextElementSibling as HTMLElement).textContent]);
  const loaded = () => screen.findByRole("tab", { name: /Находки/ });

  test("ux 9 order (craft-2): identity, the four outcome rows, the counts behind «Подробнее», kept; improve-15 (1) · «Настройки» first behind «Подробнее», its label's room held, its words in one muted row; craft-11 · « ·» with the part before it; cand-2 · tokens and cand-1 · passes in «Подробнее»", async () => {
    const user = userEvent.setup();
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    expect(within(header()).getByRole("heading", { level: 1 })).toHaveTextContent("admin·a5b5ec85");
    expect(facts().map(([label]) => label)).toEqual(["Этап", "Активность", "Ждёт вас", "Юниты"]);
    expect(facts()[0][1]).toBe("приёмка · проход 2 из 2 · с 15.11 21:41 МСК");
    expect(facts()[1][1]).toBe("работает · последняя запись 19:40 МСК");
    expect(facts()[3][1]).toBe("30 из 42 юнитов закоммичено · 2 в работе");
    // improve-15 (1) · the card beside the header shows the settings; here they fold, their label's room held in the
    // label column, so opening «Подробнее» moves no value (Strict 1).
    expect(factList().querySelector("[data-slot=settings]")).toBeNull();
    expect([...factList().querySelectorAll("[data-slot=label-sizer]")].map((s) => s.getAttribute("data-text"))).toContain("Настройки");
    await user.click(within(header()).getByRole("button", { name: "Подробнее" }));
    expect(facts()[4]).toEqual(["Настройки", "worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5"]);
    const settings = factList().querySelector("[data-slot=settings]") as HTMLElement;
    expect(settings).toHaveClass("text-muted-foreground");
    // craft-11 · each « ·» stays with the part before it, inside its unbreakable span.
    const parts = [...settings.querySelectorAll("[data-slot=setting]")];
    expect(parts.map((p) => p.textContent)).toEqual(["worktree ·", "до 2 проходов ·", "до 3 юнитов сразу ·", "claude-opus-5-5"]);
    for (const part of parts) expect(part).toHaveClass("whitespace-nowrap");
    expect(facts().slice(15).map(([label]) => label)).toEqual(["Версия run.json"]);
    // p1-decompose-u3-shape cand-2 · the run's tokens; p1-decompose-design-check cand-1 · its finished passes.
    const [tokensFact, passesFact] = facts().slice(8, 10);
    expect(tokensFact[0]).toBe("Токены");
    expect(tokensFact[1]).toMatch(/^\d+(,\d)? млн токенов$/);
    expect(passesFact).toEqual(["Проходы", "проход 1 — следующий проход"]);
    expect(within(factList()).getByText("проход 1 — следующий проход")).toHaveAttribute("title", "Проход 1 — следующий проход: 60 находок в исправление. 60 critical and major above the bar");
    expect([...factList().querySelectorAll("dt")].find((dt) => dt.textContent === "Проходы")?.querySelector("[data-slot=glossary-term]")).not.toBeNull();
    expect(facts().slice(5, 15)).toEqual([
      ["Начат", "14.11 19:41 МСК"],
      ["Длительность", "2 д"],
      ["Запуски агентов", "98 запусков агента · 1 работает"],
      tokensFact,
      passesFact,
      // design-7 · 30 units committed, the record holds no commits: never «0 коммитов», and no claim about git
      ["Коммиты", "не записано: в записи прогона нет коммитов"],
      ["Зеркало .spike", "нет"],
      ["Рабочая копия", "—нет значения"],
      ["Сессии", "5e55a5b5ec85-0000-4000-8000-000000000001"],
      ["Папка прогона", fx.dirOf(40)],
    ]);
    expect(readPref("fold:run", false)).toBe(true);
    // Every value a live change rewrites is one line: the header keeps its height (Strict 1). «Ждёт вас» is held in
    // its own box, the settings wrap only between their parts.
    for (const [i, dd] of [...factList().querySelectorAll("dd")].entries())
      if (![2, 4].includes(i)) expect(dd.firstElementChild).toHaveClass("block", "truncate");
  });

  test("p2-verdict craft-7 · «Проходы» reads the finished passes from the card: before the run is read the row already holds them, never a loading state", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path.startsWith("/api/run?") ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await waitFor(() => expect(header()).not.toBeNull());
    // The run is not read yet: the body loads, the header stands from the card.
    expect(within(screen.getByRole("region", { name: "Раздел прогона" })).getByRole("status")).toHaveTextContent("Загрузка…");
    await user.click(within(header()).getByRole("button", { name: "Подробнее" }));
    expect(facts().find(([label]) => label === "Проходы")).toEqual(["Проходы", "проход 1 — следующий проход"]);
    expect(within(factList()).getByText("проход 1 — следующий проход")).toHaveAttribute("title", "Проход 1 — следующий проход: 60 находок в исправление. 60 critical and major above the bar");
    expect(within(header()).queryByRole("status")).toBeNull();
    await act(async () => release());
    await loaded();
    expect(facts().find(([label]) => label === "Проходы")).toEqual(["Проходы", "проход 1 — следующий проход"]);
  });

  test("craft-3 · «Ждёт вас»: one row per cause, each in full, its finding and unit linked; design-21 · its list keeps role=list; craft-21 · the labels «Активность» and «Ждёт вас» carry the glossaries, the values read plain; cand-8 · «Настройки» explains its words", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    const rows = [...header().querySelectorAll<HTMLElement>("[data-slot=wait]")];
    expect(rows.map((r) => [r.dataset.kind, r.querySelector("[data-slot=wait-term]")?.textContent])).toEqual([
      ["gate", "красный гейт"],
      ["blocked", "заблокирован"],
    ]);
    expect(rows[0]).toHaveTextContent("красный гейтp2-assess-critic-code#code-2 has no decision row");
    expect(rows[1]).toHaveTextContent("заблокированu23 — waits for the user — the empty state's wording (j140)");
    for (const r of rows) expect(r.querySelector(".truncate, .line-clamp-2, [title], [data-slot=glossary-term]")).toBeNull();
    expect(within(rows[1]).getByRole("link", { name: "u23" })).toHaveAttribute("href", "/r/admin/a5b5ec85?view=units&unit=u23");
    // design-21 · a list drawn `list-none` keeps its list role
    expect(header().querySelector("[data-slot=waits]")).toHaveAttribute("role", "list");
    expect(rows[0].querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    const dt = (label: string) => [...factList().querySelectorAll("dt")].find((el) => el.textContent === label) as HTMLElement;
    // «Настройки» stands behind «Подробнее» (improve-15 (1))
    await userEvent.setup().click(within(header()).getByRole("button", { name: "Подробнее" }));
    for (const label of ["Активность", "Ждёт вас", "Настройки"]) {
      expect(within(dt(label)).getByRole("button", { name: label })).toHaveAttribute("data-slot", "glossary-term");
      expect((dt(label).nextElementSibling as HTMLElement).querySelector("[data-slot=glossary-term]")).toBeNull();
    }
    expect(dt("Этап").querySelector("[data-slot=glossary-term]")).toBeNull();
  });

  test("craft-9 · «Ждёт вас» keeps a two-line floor; the causes past its held box read «ещё N · показать», and a click shows them all; improve-11 (2) · «свернуть» folds it back to its held height", async () => {
    const user = userEvent.setup();
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
    // The box was held at two lines (40 px); each of the two causes now takes 30 px.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.slot === "wait" ? 30 : this.dataset.slot === "waits-box" ? 40 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.slot === "wait" ? [...(this.parentElement?.children ?? [])].indexOf(this) * 30 : 0;
      },
    });
    try {
      renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      await loaded();
      const box = header().querySelector("[data-slot=waits-box]") as HTMLElement;
      expect(box).toHaveClass("min-h-[2lh]", "max-h-[6lh]", "relative");
      expect(box.style.height).toBe("40px");
      const more = within(box).getByRole("button", { name: "ещё 1 · показать" });
      expect(more).toHaveClass("absolute", "bottom-0", "h-lh");
      expect(box).toHaveClass("overflow-hidden");
      await user.click(more);
      expect(box.style.height).toBe("");
      expect(box).toHaveClass("overflow-y-auto");
      expect(within(box).queryByRole("button", { name: /^ещё/ })).toBeNull();
      // gap 2 (f11): the button goes with the click; focus lands on the box it opened, never the page's body
      expect(box).toHaveFocus();
      expect(box).toHaveAttribute("tabindex", "-1");
      // improve-11 (2) · the released box folds back: «свернуть» under it returns it to its held height, the causes
      // past it counted on its last line again, focus on that count.
      const fold = within(header()).getByRole("button", { name: "Свернуть «Ждёт вас»" });
      expect(fold).toHaveTextContent(/^свернуть$/);
      expect(fold).toHaveAttribute("aria-expanded", "true");
      await user.click(fold);
      expect(box.style.height).toBe("40px");
      expect(box).toHaveClass("overflow-hidden");
      const again = within(box).getByRole("button", { name: "ещё 1 · показать" });
      expect(again).toHaveFocus();
      expect(again).toHaveAttribute("aria-expanded", "false");
      expect(within(header()).queryByRole("button", { name: "Свернуть «Ждёт вас»" })).toBeNull();
    } finally {
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
      if (offsetTop) Object.defineProperty(HTMLElement.prototype, "offsetTop", offsetTop);
    }
  });

  test("p3-review-critic-code#code-26 · «свернуть» when the causes shrank while the box was open: no count is left to draw, so focus lands on the box, never on the page's body", async () => {
    const user = userEvent.setup();
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
    // The box was held at two lines (40 px) over two causes of 30 px; while open, each shrinks to one 20 px line.
    let cause = 30;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.slot === "wait" ? cause : this.dataset.slot === "waits-box" ? 40 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetTop", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.slot === "wait" ? [...(this.parentElement?.children ?? [])].indexOf(this) * cause : 0;
      },
    });
    try {
      renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      await loaded();
      const box = header().querySelector("[data-slot=waits-box]") as HTMLElement;
      await user.click(within(box).getByRole("button", { name: "ещё 1 · показать" }));
      cause = 20;
      await user.click(within(header()).getByRole("button", { name: "Свернуть «Ждёт вас»" }));
      expect(box.style.height).toBe("40px");
      expect(within(box).queryByRole("button", { name: /^ещё/ })).toBeNull();
      expect(box).toHaveFocus();
    } finally {
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
      if (offsetTop) Object.defineProperty(HTMLElement.prototype, "offsetTop", offsetTop);
    }
  });

  test("improve-15 (2) · at 1440 the value column holds each «Ждёт вас» cause whole on one line; the header's height at 1440 and at 900, before and after", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    await applyStylesheet();
    const h = header();
    const hs = getComputedStyle(h);
    // The page beside the 316 px sidebar at 1440, less the header's padding: goal and facts side by side from 64 rem.
    const content = 1440 - 316 - px(hs.paddingLeft) - px(hs.paddingRight);
    expect(content).toBeGreaterThanOrEqual(64 * 16);
    // The facts' column, as the header's stylesheet sets it (rem at the root's 16 px).
    const factsColumn = px(hs.getPropertyValue("--facts-w")) * 16;
    expect(factsColumn).toBeGreaterThan(0);
    const list = factList();
    const ls = getComputedStyle(list);
    const size = px(ls.fontSize);
    // The label column is as wide as every label, the folded ones too (their sizers).
    const labels = [...list.querySelectorAll("dt")].map((dt) => dt.textContent ?? "");
    const sizers = [...list.querySelectorAll("[data-slot=label-sizer]")].map((s) => s.getAttribute("data-text") ?? "");
    const labelColumn = Math.max(...[...labels, ...sizers].map((t) => textWidth(t, { size })));
    const value = factsColumn - labelColumn - px(ls.columnGap);
    const box = h.querySelector("[data-slot=waits-box]") as HTMLElement;
    const room = innerWidth(box, box, value);
    const rows = [...box.querySelectorAll<HTMLElement>("[data-slot=wait]")];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const [dot, term, text] = [...row.children] as HTMLElement[];
      const gap = px(getComputedStyle(row).columnGap);
      const width = contentWidth(dot) + gap + textWidth(term.textContent ?? "", { size }) + gap + px(getComputedStyle(text).paddingLeft) + textWidth(text.textContent ?? "", { size });
      expect(width, `${row.textContent}: ${width} px in ${room} px`).toBeLessThanOrEqual(room);
    }
    // The header's height, from its rows: one line each at the body's 13 px × 1.45, «Ждёт вас» its causes one line
    // each (at 900 the facts take the page's width, wider still), then «Подробнее»; the title at 17 px × 1.35.
    const LINE = 13 * 1.45;
    const TITLE = 17 * 1.35;
    const grid = list.parentElement as HTMLElement;
    const gs = getComputedStyle(grid);
    const causes = rows.length * LINE + (rows.length - 1) * px(getComputedStyle(box.querySelector("[data-slot=waits]") as HTMLElement).rowGap);
    const rowHeights = [...list.querySelectorAll("dt")].map((dt) => ((dt.nextElementSibling as HTMLElement).querySelector("[data-slot=waits-box]") ? Math.max(2 * LINE, causes) : LINE));
    const facts = [...rowHeights, LINE].reduce((a, b) => a + b, 0) + px(ls.rowGap) * rowHeights.length;
    const frame = px(hs.paddingTop) + px(hs.paddingBottom) + TITLE + px(gs.marginTop);
    const at1440 = Math.round(frame + Math.max(2 * LINE, facts));
    const at900 = Math.round(frame + 2 * LINE + px(gs.rowGap) + facts);
    // Before: the pass-2 frames — 245 px at 1440 (p2-final-shell.png), 276 px at 900 (p2-final-findings-narrow.png,
    // the header from y≈254 to the tab strip at y≈530).
    console.log(`improve-15 · the run header's height: at 1440 245 → ${at1440} px; at 900 276 → ${at900} px`);
    expect(at1440).toBeLessThanOrEqual(245 - 40);
    expect(at900).toBeLessThan(276);
  });

  test("craft-3 · Strict 1: «Ждёт вас» is held at the height it first took; a live change of its causes scrolls inside, a resize measures again", async () => {
    const measured = { height: 57, width: 400 };
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const RO = window.ResizeObserver;
    const observers: ResizeObserverCallback[] = [];
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => measured.height });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => measured.width });
    window.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      const { again } = renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      await loaded();
      const box = header().querySelector("[data-slot=waits-box]") as HTMLElement;
      expect(box).toHaveClass("max-h-[6lh]", "overflow-y-auto", "[scrollbar-gutter:stable]", "min-h-[2lh]");
      expect(box.style.height).toBe("57px");
      // More causes arrive: the content would take more, the box keeps its height.
      measured.height = 120;
      again();
      for (const cb of observers) act(() => cb([], {} as ResizeObserver));
      expect(box.style.height).toBe("57px");
      // The operator narrows the window: the box is measured again at its new width.
      measured.width = 300;
      for (const cb of observers) act(() => cb([], {} as ResizeObserver));
      expect(box.style.height).toBe("120px");
    } finally {
      if (offset) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offset);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
      window.ResizeObserver = RO;
    }
  });

  test("a closed run: the verdict row after the outcome, no activity and nothing waits", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await loaded();
    expect(facts().slice(0, 3)).toEqual([
      ["Этап", "прогон закрыт"],
      ["Юниты", "1 из 1 юнита закоммичен"],
      ["Итог", "цель не достигнута · коммиты не отправлены"],
    ]);
    expect(facts().map(([label]) => label)).not.toContain("Активность");
    expect(facts().map(([label]) => label)).not.toContain("Ждёт вас");
  });

  test("the goal: clamped, each of its lines kept, from the card before the run loads; «развернуть» only when the clamp hides text; expanded as running text", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path.startsWith("/api/run?") ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    const heights = { scroll: 900, client: 38 };
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const RO = window.ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => heights.scroll });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => heights.client });
    window.ResizeObserver = class {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      const line = await screen.findByText((_, el) => el?.getAttribute("data-slot") === "goal-line");
      const before = line.textContent ?? "";
      expect(line).toHaveClass("whitespace-pre-line");
      expect(line.closest(".line-clamp-2")).not.toBeNull();
      // The run is not read yet: no trigger, the body holds «Загрузка…».
      expect(within(header()).queryByRole("button", { name: "Развернуть цель прогона" })).toBeNull();
      expect(within(screen.getByRole("region", { name: "Раздел прогона" })).getByRole("status")).toHaveTextContent("Загрузка…");
      await act(async () => release());
      await loaded();
      const after = header().querySelector("[data-slot=goal-line]")?.textContent ?? "";
      // The clamp opens on the same first line from the card and from the run; the run's numbered lines never run
      // together inline («1. … 2. …»): each starts a line of its own.
      const [first, second] = after.split("\n");
      expect(before.startsWith(first)).toBe(true);
      expect(second).toMatch(/^2\. /);
      expect(after).not.toMatch(/\n\s*\n/);
      await user.click(within(header()).getByRole("button", { name: "Развернуть цель прогона" }));
      const region = within(header()).getByRole("region", { name: "цель прогона" });
      expect(region).toHaveClass("max-h-text-cap", "overflow-y-auto");
      // The whole goal of 8 000 characters over 50 lines, list markers drawn as lists.
      expect(region.querySelector("[data-slot=goal-text]")?.textContent?.length).toBeGreaterThan(7500);
      expect(region.querySelectorAll("br").length + region.querySelectorAll("p, li").length).toBeGreaterThan(40);
    } finally {
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scroll);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientHeight", client);
      window.ResizeObserver = RO;
    }
  });

  test("the tab title names the run and its stage; «● » marks a change the hidden tab missed", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    expect(document.title).toBe("fsloopUI · fsloop · 077e72d5 · ревью");
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    let state: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    try {
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      fx.write(24, "journal.md", "| # | stage | question | decision | why | refs |\n|---|---|---|---|---|---|\n| 1 | p1-map | Route? | worktree | many pages | — |\n| 2 | p1-review | Fix? | yes | above the bar | — |\n");
      await waitFor(() => expect(document.title).toBe("● fsloopUI · fsloop · 077e72d5 · ревью"));
      state = "visible";
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      expect(document.title).toBe("fsloopUI · fsloop · 077e72d5 · ревью");
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
      if (visibility) Object.defineProperty(Document.prototype, "visibilityState", visibility);
    }
  });

  test("objects by address: objectHref, ObjectLink with «не найден», the running text's resolver", () => {
    const run = fx.app.store.run(keyOf(40));
    if (!run) throw new Error("no run");
    expect(objectHref(run, { kind: "finding", id: "p1-map-craft-accounts#craft-1" })).toBe("/r/admin/a5b5ec85?view=findings&finding=p1-map-craft-accounts%23craft-1");
    expect(objectHref(run, { kind: "unit", id: "u23" })).toBe("/r/admin/a5b5ec85?view=units&unit=u23");
    expect(objectHref(run, { kind: "report", id: "p1-map-map", tab: "sections" })).toBe("/r/admin/a5b5ec85?view=reports&report=p1-map-map&tab=sections");
    expect(objectHref(run, { kind: "entry", id: "12" })).toBe("/r/admin/a5b5ec85?view=journal&entry=12");
    expect(objectHref(run, { kind: "unit", id: "u99" })).toBeNull();
    const resolve = resolverFor(run);
    expect(resolve("u23")).toBe("/r/admin/a5b5ec85?view=units&unit=u23");
    expect(resolve("j12")).toBe("/r/admin/a5b5ec85?view=journal&entry=12");
    expect(resolve("p1-map-map")).toBe("/r/admin/a5b5ec85?view=reports&report=p1-map-map");
    expect(resolve("worktree")).toBeNull();
    render(
      <MemoryRouter>
        <ObjectLink run={run} kind="unit" id="u23" />
        <ObjectLink run={run} kind="unit" id="u99" />
        <ObjectLink run={run} kind="entry" id="999" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "u23" })).toHaveAttribute("href", "/r/admin/a5b5ec85?view=units&unit=u23");
    expect(screen.getByText((_, el) => el?.getAttribute("data-slot") === "not-found" && el.textContent === "юнит u99 не найден")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.getAttribute("data-slot") === "not-found" && el.textContent === "решение #999 не найдено")).toBeInTheDocument();
  });

  test("reserved boxes: each tab's count before the run loads; the loading body at the region's size", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path.startsWith("/api/run?") ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(24)}` });
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Находки", "Юниты", "Отчёты", "Соглашения", "Журнал"]);
    for (const t of tabs) expect(t.querySelector("[data-slot=tab-count]")).toHaveClass("min-w-count", "tabular-nums");
    const body = screen.getByRole("region", { name: "Раздел прогона" });
    // The view takes what the header leaves (or, below the shell's breakpoint, the page under the strip).
    expect(body).toHaveClass("[flex:var(--view-flex,1_1_0%)]", "min-h-0", "overflow-y-auto", "[scrollbar-gutter:stable]");
    expect(within(body).getByRole("status")).toHaveClass("size-full");
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole("tab", { name: /Находки/ }).querySelector("[data-slot=tab-count]")?.textContent).not.toBe(""));
    // The tab row is one fixed line; the lost connection is the shell's, so nothing arrives in it.
    expect(screen.getByRole("tablist")).toHaveClass("group-data-horizontal/tabs:h-10", "shrink-0");
  });
});

describe("improve-5 (3) · the page's outline on every view: h1 the run, a visually hidden h2 the view, then the view's own", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp({ only: [40] });
  });
  afterAll(() => fx.close());

  const level = (h: HTMLElement) => Number(h.getAttribute("aria-level") ?? h.tagName.slice(1));
  const cases: [string, string, string, () => Promise<unknown>][] = [
    ["Находки", "findings", "", () => screen.findByRole("table")],
    ["Находки", "findings", "&finding=p1-map-craft-accounts%23craft-1", () => screen.findAllByRole("heading", { level: 3 })],
    ["Юниты", "units", "&unit=u22", () => screen.findAllByRole("heading", { level: 3 })],
    ["Отчёты", "reports", "", () => screen.findAllByRole("heading", { level: 3 })],
    ["Отчёты", "reports", "&report=p1-map-map", () => screen.findAllByRole("heading", { level: 3 })],
    // p3-review-critic-craft-3#craft-6: a design check's group is an h3 under the hidden h2 «Соглашения»
    ["Соглашения", "conventions", "", () => screen.findAllByRole("heading", { level: 3 })],
    ["Журнал", "journal", "", () => screen.findAllByRole("heading", { level: 3 })],
  ];

  test.each(cases)("%s ?view=%s%s: no heading level skipped", async (name, view, extra, ready) => {
    renderShell(fx.transport, { path: `/r/${keyOf(40)}?view=${view}${extra}` });
    await screen.findByRole("tab", { name: /Находки/ });
    await ready();
    const body = screen.getByRole("region", { name: "Раздел прогона" });
    const own = within(body).getAllByRole("heading")[0];
    expect(own).toHaveTextContent(name);
    expect(level(own)).toBe(2);
    expect(own).toHaveClass("sr-only");
    const levels = screen.getAllByRole("heading").map(level);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i], `heading ${i + 1} of ${levels.join(" ")}`).toBeLessThanOrEqual(levels[i - 1] + 1);
  });
});

describe("a run that closes while its page is open", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp({ only: [40] });
  });
  afterAll(() => fx.close());

  const header = () => document.querySelector("[data-slot=run-header]") as HTMLElement;
  const labels = () => [...header().querySelectorAll("dt")].map((dt) => dt.textContent);

  test("p1-verdict cand-3 · Strict 1: «Активность» and «Ждёт вас» give way to «Итог», and the header keeps the height it had while running; the operator's own «Подробнее» lets it go", async () => {
    const user = userEvent.setup();
    const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.slot === "run-header" ? 245 : 0;
      },
    });
    try {
      renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      await screen.findByRole("tab", { name: /Находки/ });
      expect(labels()).toContain("Ждёт вас");
      expect(header().style.minHeight).toBe("");
      const record = JSON.parse(readFileSync(join(fx.dirOf(40), "run.json"), "utf8")) as Record<string, unknown>;
      fx.write(40, "run.json", JSON.stringify({ ...record, closed: true, outcome: { pushed: true, goalMet: true, held: [] } }));
      await waitFor(() => expect(labels()).toContain("Итог"));
      expect(labels()).not.toContain("Ждёт вас");
      expect(header().style.minHeight).toBe("245px");
      await user.click(within(header()).getByRole("button", { name: "Подробнее" }));
      expect(header().style.minHeight).toBe("");
    } finally {
      if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
    }
  });
});
