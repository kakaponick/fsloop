// @vitest-environment jsdom
// Done-criteria 0, 2 and 6: the report reader on the 97-launch fixture run — identity with the path copied on click,
// the fact list in `ux 9` order, the frames, the section tabs fixed per agent kind with their counts, the finding
// article, ids as links, «Файл отчёта», and the states of the WALK: running, missing file, partly parsed, no
// sections — at the production shape (a 59.8 kB report, 16 frames then «ещё N», scores across five stages).
import "../../ui/test-setup.ts";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { Finding, Launch, Surface } from "../../../shared/model.ts";
import { glossaryLines, readPref, writePref } from "@/ui";
import { applyStylesheet, usedBlockSize } from "../../app/layout-testing.ts";
import { runPath } from "../../app/routes.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportsView } from "./index.tsx";
import { reportPath, severityShown, SEVERITY_PREF } from "./reader.tsx";
import { SCORES_GLOSSARY } from "./scores.tsx";
import { bySeverity, lensGlossary, reportFindings, reportTabs, unparsedText } from "./sections.ts";
import { fixtureApp, handlerReport, keyOf, loadedRun, renderOver, type FetchReport } from "./testing.tsx";

const N = 40;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);
const launch = (id: string) => run.launches.find((l) => l.id === id) as Launch;
/** The frames the fixture took of «accounts»: the craft critic's «Кадры» count. */
const accountsFrames = run.surfaces.find((s) => s.key === "accounts")?.frames.length ?? 0;

const open = (report: string, extra: Record<string, string> = {}, over = run) => renderOver(fx, over, runPath(KEY, { view: "reports", report, ...extra }), ReportsView);
const reader = () => document.querySelector("[data-slot=report-reader]") as HTMLElement;
const tabNames = () => within(reader()).queryAllByRole("tab").map((t) => t.textContent);
/** «Файл отчёта» once its text has arrived. */
const loadedFile = async () => {
  await waitFor(() => expect(reader().querySelector("[data-slot=report-file]")).toBeTruthy());
  return reader().querySelector("[data-slot=report-file]") as HTMLElement;
};
const factRows = () => [...reader().querySelectorAll<HTMLElement>("[data-slot=fact]")].map((r) => [r.querySelector("dt")?.textContent, r.querySelector("dd")?.textContent]);
const at = (probe: { location: { search: string } | null }) => new URLSearchParams(probe.location?.search).get("report");

describe("a critic's report", () => {
  test("identity, improve-10 (2): the description as title, the launch id, the report's path once — behind its copy button", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    open("p1-map-craft-accounts");
    expect(within(reader()).getByRole("heading", { level: 2 })).toHaveTextContent("craft accounts");
    expect(reader()).toHaveTextContent("отчёт критика");
    expect(reader().querySelector("[data-slot=report-id]")).toHaveTextContent("p1-map-craft-accounts");
    // the id names the report on the line; its path, which repeats the id, is what the button copies
    const path = within(reader()).getByRole("button", { name: "Скопировать путь к отчёту" });
    expect(path).toHaveAttribute("data-slot", "report-path");
    expect(path).toHaveTextContent(/^$/);
    expect(reader()).not.toHaveTextContent("reports/p1-map-craft-accounts.md");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(path);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(reportPath(run.dir, "reports/p1-map-craft-accounts.md")));
    expect(reportPath("C:\\runs\\a5", "reports/x.md")).toBe("C:\\runs\\a5\\reports\\x.md");
    expect(reportPath("/home/op/runs/a5/", "reports/x.md")).toBe("/home/op/runs/a5/reports/x.md");
  });

  test("craft-13, improve-10 (2): the reader opens on its outcome — the outcome rows, «Состояние» only when not «завершён», one muted line agent · model · duration · tokens, the rest behind «Подробнее»", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    expect(factRows()).toEqual([
      ["Находки", "18 находок3 critical6 major9 minor"],
      ["Оценки раздела", "accountsаудит 8 из 20·критика 18 из 40"],
    ]);
    const meta = reader().querySelector("[data-slot=report-meta]") as HTMLElement;
    // «отчёт критика» on the line above names the agent, so this line starts at the model
    expect(meta).toHaveTextContent(/^claude-opus-5-5 · 9 мин · 3,4 млн токенов$/);
    expect(meta.previousElementSibling).toHaveTextContent(/^отчёт критика/);
    expect(meta).toHaveClass("text-muted-foreground");
    // the line sits in the identity, above the fact list
    expect(meta.compareDocumentPosition(reader().querySelector("[data-slot=fact-list]") as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 18 findings of the critic, 20 in «Находки» with its two ideas: the count stays plain (Conventions 7)
    expect(reader().querySelector("[data-slot=report-severity] [data-slot=count]")).toHaveTextContent("18 находок");
    // the current report's score is marked, not a link
    expect(reader().querySelector("[data-slot=score-audit] [aria-current]")).toHaveTextContent("8");
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(factRows().slice(2, 6)).toEqual([
      ["Агент", "критикfsloop-critic"],
      ["Линза критика", "craft assess"],
      ["Этап", "проход 1 · карта"],
      ["Начало", "14.11 20:01 МСК"],
    ]);
    // what the line holds is not repeated as a row
    expect(factRows().map((r) => r[0])).not.toContain("Модель");
  });

  test("craft-2: the meta line's separators keep their spaces — each «·» its own element, its spaces held by white-space: pre", () => {
    open("p1-map-craft-accounts");
    const meta = reader().querySelector("[data-slot=report-meta]") as HTMLElement;
    const seps = [...meta.querySelectorAll<HTMLElement>("[data-slot=meta-sep]")];
    expect(seps).toHaveLength(2);
    for (const s of seps) {
      expect(s.textContent).toBe(" · ");
      // a flex item drops the spaces at its start; a pre-spaced span keeps them, so the line never reads «5-5· 9 мин»
      expect(s).toHaveClass("whitespace-pre");
      expect(s).toHaveAttribute("aria-hidden", "true");
      // the separator is a box of its own between two parts, not the part's leading text
      expect(s.parentElement).toBe(meta);
    }
    expect([...meta.children].map((c) => c.textContent)).toEqual(["claude-opus-5-5", " · ", "9 мин", " · ", "3,4 млн токенов"]);
  });

  test("craft-13: a launch the record leaves without model, duration or tokens: the line skips them, «Подробнее» says «не записано»", async () => {
    const user = userEvent.setup({ delay: null });
    const bare: Launch = { ...launch("p1-map-craft-accounts"), model: null, seconds: null, spend: null };
    open(bare.id, {}, { ...run, launches: run.launches.map((l) => (l.id === bare.id ? bare : l)) });
    // nothing left to say on the line: no empty line holds a place
    expect(reader().querySelector("[data-slot=report-meta]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    const rows = new Map(factRows().map(([k, v]) => [k, v]));
    expect(rows.get("Модель")).toBe("не записано");
    expect(rows.get("Длительность")).toBe("не записано");
    expect(rows.get("Токены")).toBe("не записано");
  });

  test("craft-13, cand-6: the report's parts stay in view while it scrolls — a sticky strip named «Части отчёта», the frames a tab of their own", () => {
    open("p1-map-craft-accounts");
    // «раздел» is a part of the interface everywhere else (the «Раздел» filter, the overview): a report has parts
    const list = within(reader()).getByRole("tablist", { name: "Части отчёта" });
    expect(list).toHaveAttribute("data-sticky", "");
    expect(list).toHaveClass("sticky", "top-0", "z-10", "bg-background");
    expect(reader().querySelector("[data-slot=report-sections]")).toHaveAttribute("aria-label", "Части отчёта");
    // the frames no longer stand between the facts and the tabs
    expect(reader().querySelector("[data-slot=frame-strip]")).toBeNull();
    expect(accountsFrames).toBeGreaterThan(0);
    expect(tabNames()).toContain(`Кадры${accountsFrames}`);
  });

  test("craft-1: «Кадры» only where there are frames — a code critic's strip has none, and `tab=frames` opens its first part", () => {
    open("p1-review-critic-code", { tab: "frames" });
    expect(tabNames()).not.toContain("Кадры0");
    expect(screen.getByRole("tab", { name: /^Находки/ })).toHaveAttribute("aria-selected", "true");
    expect(reportTabs(launch("p1-review-critic-code"), 30, 0).map((t) => t.id)).not.toContain("frames");
    expect(reportTabs(launch("p1-review-critic-code"), 30, 2).map((t) => t.id)).toContain("frames");
  });

  test("craft-13: «Находки» lists FindingRows that expand in place, several at once", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    const list = reader().querySelector("[data-slot=report-findings]") as HTMLElement;
    const rows = list.querySelectorAll<HTMLElement>("[data-slot=finding-row]");
    expect(rows).toHaveLength(18);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(0);
    // each row's box is one fixed line, so the list never jumps as it renders
    for (const r of rows) expect(r).toHaveClass("h-8");
    const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
    const first = items[0];
    const toggle = within(first).getByRole("button", { name: `Развернуть находку ${first.dataset.finding?.split("#")[1]}` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const detail = document.getElementById(toggle.getAttribute("aria-controls") as string) as HTMLElement;
    expect(first).toContainElement(detail);
    expect(within(detail).getByRole("link", { name: "Открыть в находках" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: first.dataset.finding as string }));
    expect(detail.querySelectorAll("[data-slot=finding-article]")).toHaveLength(1);
    // a click on the row's sentence opens the next one too; the first stays open
    await user.click(items[1].querySelector("[data-slot=finding-row] > span:nth-child(3)") as HTMLElement);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(2);
    await user.click(toggle);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(1);
  });

  test("craft-3: the findings list is one Tab stop — ↑/↓ move, Enter opens and closes; `aria-controls` only while the panel exists", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    const list = reader().querySelector("[data-slot=report-findings]") as HTMLElement;
    const toggles = within(list).getAllByRole("button", { name: /^Развернуть находку / });
    expect(toggles).toHaveLength(18);
    // 18 rows, one stop: no row's chevron but the first and no id link takes Tab
    const stops = [...list.querySelectorAll<HTMLElement>("a, button, [tabindex]")].filter((el) => el.tabIndex >= 0);
    expect(stops).toEqual([toggles[0]]);
    for (const t of toggles) expect(t).not.toHaveAttribute("aria-controls");
    toggles[0].focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(toggles[2]).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(toggles[2]).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(toggles[2].getAttribute("aria-controls") as string);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("data-slot", "finding-detail");
    await user.keyboard("{Enter}");
    expect(toggles[2]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[2]).not.toHaveAttribute("aria-controls");
    await user.keyboard("{ArrowUp}");
    expect(toggles[1]).toHaveFocus();
  });

  test("«Подробнее»: tokens by kind, the first request, child launches with their tokens, the agent id, the transcript", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-map-map");
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(factRows().slice(-8)).toEqual([
      ["Вход", "900 токенов"],
      // a number from five digits groups its thousands with a no-break space
      ["Выход", "40 000 токенов"],
      ["Запись в кэш", "250 000 токенов"],
      ["Чтение кэша", "3 100 000 токенов"],
      ["Первый запрос", "38 000 токенов"],
      ["Дочерние запуски", "3 запуска агента · 1,7 млн токенов"],
      ["Id агента", "a5e0000"],
      ["Транскрипт", "не записано: запись запуска не называет файл"],
    ]);
    view.unmount();
    // a row written before those columns: absent, never a guessed zero
    const old: Launch = { ...launch("p1-map-map") };
    delete old.boot;
    delete old.children;
    delete old.agentId;
    open(old.id, {}, { ...run, launches: run.launches.map((l) => (l.id === old.id ? old : l)) });
    expect(factRows().slice(-4, -1)).toEqual([
      ["Первый запрос", "не записано: в записи запуска нет этой колонки"],
      ["Дочерние запуски", "не записано: в записи запуска нет этой колонки"],
      ["Id агента", "не записано: запись запуска его не называет"],
    ]);
  });

  test("a report whose findings are all of «Находки»'s slice links its count there", () => {
    open("p1-review-critic-code");
    const link = reader().querySelector("[data-slot=report-severity] [data-slot=count-link]") as HTMLElement;
    expect(link).toHaveTextContent("30 находок");
  });

  test("the tabs: fixed for a critic, counts, a muted «0» whose body says the critic wrote nothing; «Файл отчёта» last", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-review-critic-code");
    // craft-1: a code critic judges no surface and its findings cite no frame — no «Кадры»; the rest stays, a muted «0»
    expect(tabNames()).toEqual(["Находки30", "Не проверено0", "Идеи0", "План правок0", "Допущения0", "Файл отчёта"]);
    // two critics of other lenses keep the same strip, plus the sections their lens writes and their frames
    view.unmount();
    open("p1-map-craft-accounts");
    expect(tabNames()).toEqual(["Находки18", "Не проверено1", "Идеи2", "План правок1", "Допущения1", `Кадры${accountsFrames}`, "Файл отчёта"]);
    const zero = reportTabs(launch("p1-review-critic-code"), 30)[1];
    expect(zero).toMatchObject({ label: "Не проверено", count: 0 });
    await user.click(screen.getByRole("tab", { name: /^Не проверено/ }));
    await user.click(screen.getByRole("tab", { name: /^План правок/ }));
    expect(within(reader()).getByRole("tabpanel")).toHaveTextContent("accounts: /impeccable clarify, harden, polish");
  });

  test("a zero tab reads «Критик ничего сюда не записал.»", () => {
    open("p1-review-critic-code", { tab: "unverified" });
    const tab = screen.getByRole("tab", { name: /^Не проверено/ });
    // u13 improve-5 (1): a zero tab is muted whole and its «0» takes the tab's ink — here the chosen tab's (lists.test.tsx)
    expect(tab.querySelector("[data-slot=tab-count]")).toHaveTextContent(/^0$/);
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(within(reader()).getByRole("tabpanel")).toHaveTextContent("Критик ничего сюда не записал.");
  });

  test("cand-7: each part of a critic's report says what it holds, at the top of its panel", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts", { tab: "unverified" });
    const lead = () => within(reader()).getByRole("tabpanel").querySelector("[data-slot=section-lead]");
    expect(lead()).toHaveTextContent(/^Что критик не смог подтвердить по коду и кадрам — и чем это проверить\.$/);
    expect(lead()).toHaveClass("text-muted-foreground", "max-w-measure");
    await user.click(screen.getByRole("tab", { name: /^План правок/ }));
    expect(lead()).toHaveTextContent(/^Очередь правок, которую предлагает критик: раздел интерфейса, команда impeccable и находки, которые она закрывает\.$/);
    await user.click(screen.getByRole("tab", { name: /^Допущения/ }));
    expect(lead()).toHaveTextContent(/^Вопросы, на которые критик ответил сам, без вас: ответ и откуда он взят\.$/);
    await user.click(screen.getByRole("tab", { name: /^Идеи/ }));
    expect(lead()).toHaveTextContent(/^Улучшения, которых не требуют правила проекта: критик предлагает их отдельно от находок\.$/);
    // a lead says what the part is, the empty body what it holds now: both stand on a zero tab
    await user.click(screen.getByRole("tab", { name: /^Находки/ }));
    expect(lead()).toBeNull();
  });

  test("cand-7: «Линза критика» is a glossary term — each word of the lens explained, within the glossary's bounds", async () => {
    const user = userEvent.setup({ delay: null });
    expect(lensGlossary("craft assess")).toEqual([
      { value: "craft", meaning: "интерфейс раздела: критика и аудит impeccable по кадру и коду" },
      { value: "assess", meaning: "оценка как есть, до правок прогона" },
    ]);
    expect(lensGlossary("code verdict")).toEqual([
      { value: "code", meaning: "код юнитов: бриф, правила проекта, архитектура" },
      { value: "verdict", meaning: "исправлены ли находки прошлого прохода" },
    ]);
    for (const lens of ["craft", "code", "runtime", "shape", "design", "parity", "improve", "craft verdict", "parity assess"]) expect(() => glossaryLines(lensGlossary(lens))).not.toThrow();
    // a word the map does not hold is not explained: no guessed meaning
    expect(lensGlossary("smoke")).toEqual([]);
    open("p1-map-craft-accounts");
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    const row = [...reader().querySelectorAll<HTMLElement>("[data-slot=fact]")].find((r) => r.querySelector("dt")?.textContent === "Линза критика") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Линза критика" })).toHaveAttribute("data-slot", "glossary-term");
  });

  test("«Находки»: a severity filter over the report's rows", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    const list = reader().querySelector("[data-slot=report-findings]") as HTMLElement;
    await user.click(screen.getByRole("radio", { name: /^critical/ }));
    expect(list.querySelectorAll("[data-slot=finding-row]")).toHaveLength(3);
  });

  test("improve-2 (1): the severity filter is the shared choice toggles — the pressed one ink, no key tooltip", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-review-critic-craft");
    const group = within(reader()).getByRole("radiogroup", { name: "Серьёзность находок" });
    await user.click(within(group).getByRole("radio", { name: "critical" }));
    await applyStylesheet();
    // DESIGN.md → Colors, light: ink #1b1b1a on the pressed item, as on the verdict's
    expect(getComputedStyle(within(group).getByRole("radio", { name: "critical" })).backgroundColor).toBe("rgb(27, 27, 26)");
    expect(getComputedStyle(within(group).getByRole("radio", { name: "все" })).backgroundColor).not.toBe("rgb(27, 27, 26)");
    await user.hover(within(group).getByRole("radio", { name: "major" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("improve-2 (3), design-9: a severity that hides rows says so beside the group — «5 из 30 находок · показать все» — on a line reserved before it", async () => {
    // Copy 3, 4: the status bar's one form, the noun genitive after «из», then the verb of the click
    expect(severityShown(5, 30)).toBe("5 из 30 находок · показать все");
    expect(severityShown(5, 30).split(/\s+/)).toHaveLength(7);
    expect(severityShown(1, 21)).toBe("1 из 21 находки · показать все");
    const user = userEvent.setup({ delay: null });
    open("p1-review-critic-craft");
    const line = reader().querySelector("[data-slot=severity-bar]") as HTMLElement;
    const group = within(line).getByRole("radiogroup", { name: "Серьёзность находок" });
    const shown = line.querySelector("[data-slot=severity-shown]") as HTMLElement;
    await applyStylesheet();
    // Strict 1: the line holds its 28 px with nothing hidden, the group first, so the count beside it moves nothing
    expect(usedBlockSize(line)).toBe(28);
    expect(line.firstElementChild).toBe(group);
    expect(shown).toHaveTextContent(/^$/);
    await user.click(within(group).getByRole("radio", { name: "critical" }));
    await applyStylesheet();
    expect(usedBlockSize(line)).toBe(28);
    expect(line.firstElementChild).toBe(group);
    expect(shown).toHaveTextContent(/^5 из 30 находок · показать все$/);
    expect(reader().querySelectorAll("[data-slot=report-findings] [data-slot=finding-row]")).toHaveLength(5);
    // the verb is the click: every row back, the choice «все» kept for the view
    await user.click(within(shown).getByRole("button", { name: "показать все" }));
    expect(reader().querySelectorAll("[data-slot=report-findings] [data-slot=finding-row]")).toHaveLength(30);
    expect(readPref(SEVERITY_PREF, "critical")).toBe("all");
    expect(shown).toHaveTextContent(/^$/);
  });

  test("improve-10 (1): a report's findings read critical, major, minor — the critic's order inside each", () => {
    const f = (id: string, severity: Finding["severity"]) => ({ id, severity });
    // a critical one sixth, as p2-final-reports-reader.png shows it
    expect(bySeverity([f("craft-1", "major"), f("craft-2", "major"), f("craft-3", "minor"), f("craft-4", null), f("craft-5", "minor"), f("craft-6", "critical"), f("craft-7", "major"), f("craft-8", "critical")]).map((x) => x.id)).toEqual(["craft-6", "craft-8", "craft-1", "craft-2", "craft-7", "craft-3", "craft-5", "craft-4"]);
    open("p1-review-critic-craft");
    const ids = [...reader().querySelectorAll<HTMLElement>("[data-slot=report-findings] > li")].map((li) => li.dataset.finding as string);
    expect(ids).toHaveLength(30);
    const severity = new Map(run.findings.map((x) => [x.id, x.severity ?? "none"]));
    const rank = { critical: 0, major: 1, minor: 2, none: 3 } as const;
    const ranks = ids.map((id) => rank[severity.get(id) as keyof typeof rank]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(ranks[0]).toBe(0);
    // inside a severity, the critic's numbering runs up
    for (let i = 1; i < ids.length; i++) if (ranks[i] === ranks[i - 1]) expect(Number(ids[i].split("-").at(-1))).toBeGreaterThan(Number(ids[i - 1].split("-").at(-1)));
  });

  test("improve-10 (2), Strict 1: «Состояние» comes and goes with the state — an open reader keeps the rows it opened with", async () => {
    // a file missing at open: the row stands; the file arrives — the row stays, now «завершён»
    const missing: Launch = { ...launch("p1-map-craft-accounts"), reportMissing: true };
    const view = open(missing.id, {}, { ...run, launches: run.launches.map((x) => (x.id === missing.id ? missing : x)) });
    expect(factRows()[0]).toEqual(["Состояние", "нет отчёта"]);
    view.again({ ...run, version: 2 });
    expect(factRows()[0]).toEqual(["Состояние", "завершён"]);
    view.unmount();
    // a running launch ends while its reader is open: the reader follows it to its record and keeps the row
    const live = open("aa5b5ec85u30");
    expect(factRows()[0]).toEqual(["Состояние", "работает · 12 мин"]);
    live.again({ ...run, version: 2, running: [] });
    expect(document.querySelector("[data-slot=report-id]")).toHaveTextContent("p2-units-u30-implement");
    expect(factRows()[0]).toEqual(["Состояние", "завершён"]);
  });

  test("improve-10 (5), design-20: every list drawn without markers keeps its list role — a part's mono list, a design check's lines, the file's outline", async () => {
    /** The reader's lists the stylesheet draws with no marker, and those of them a screen reader would lose. */
    const unlisted = async () => {
      await applyStylesheet();
      const bare = [...reader().querySelectorAll<HTMLElement>("ol, ul")].filter((l) => getComputedStyle(l).listStyleType === "none");
      return { bare: bare.length, lost: bare.filter((l) => l.getAttribute("role") !== "list").length };
    };
    const files = open("p1-units-u1-implement", { tab: "files" });
    expect(await unlisted()).toMatchObject({ lost: 0 });
    expect((await unlisted()).bare).toBeGreaterThan(0);
    files.unmount();
    const check = open("p1-decompose-design-check", { tab: "conventions" });
    expect(await unlisted()).toMatchObject({ lost: 0 });
    check.unmount();
    open("p1-map-map");
    await loadedFile();
    expect(within(reader()).getByRole("navigation", { name: "Содержание отчёта" }).querySelector("ol")).toHaveAttribute("role", "list");
    expect(await unlisted()).toMatchObject({ lost: 0 });
  });

  test("improve-12 (3), design-13: «Оценки раздела» carries the scores' glossary — whose scale, where the bar is — the one constant the overview's lead reads", async () => {
    const user = userEvent.setup({ delay: null });
    expect(glossaryLines(SCORES_GLOSSARY)).toEqual([
      "аудит — техническая проверка impeccable audit, из 20; от 18 — отлично",
      "критика — удобство по 10 эвристикам impeccable critique, из 40; от 36 — отлично",
      "8 → 9 — оценка раздела на каждом этапе прогона, в порядке этапов",
      "craft — интерфейс раздела: критика и аудит impeccable по кадру и коду",
    ]);
    open("p1-map-craft-accounts");
    const term = within(reader()).getByRole("button", { name: "Оценки раздела" });
    expect(term).toHaveAttribute("data-slot", "glossary-term");
    await user.hover(term);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("от 36 — отлично");
  });

  test("cand-1: the severity filter carries no counts — the outcome row above holds them, the tab the total", () => {
    open("p1-map-craft-accounts");
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["все", "critical", "major", "minor"]);
    expect(reader().querySelector("[data-slot=report-severity]")).toHaveTextContent("18 находок3 critical6 major9 minor");
    expect(screen.getByRole("tab", { name: /^Находки/ })).toHaveTextContent("Находки18");
  });

  test("cand-3: the severity chosen stays for the view — another report opens on it; one without that severity shows all", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-map-craft-accounts");
    await user.click(screen.getByRole("radio", { name: "critical" }));
    expect(readPref(SEVERITY_PREF, "all")).toBe("critical");
    view.unmount();
    open("p1-map-craft-bots");
    expect(screen.getByRole("radio", { name: "critical" })).toHaveAttribute("aria-checked", "true");
    expect(reader().querySelectorAll("[data-slot=report-findings] [data-slot=finding-row]")).toHaveLength(3);
  });

  test("cand-3: a stored severity the report has none of opens on «все», and the choice is kept for the next report", () => {
    writePref(SEVERITY_PREF, "critical");
    const own = new Set(reportFindings(run.findings, "p1-map-craft-accounts").map((f) => f.id));
    const softened = { ...run, findings: run.findings.map((f) => (own.has(f.id) && f.severity === "critical" ? { ...f, severity: "major" as const } : f)) };
    open("p1-map-craft-accounts", {}, softened);
    expect(screen.getByRole("radio", { name: "все" })).toHaveAttribute("aria-checked", "true");
    expect(reader().querySelectorAll("[data-slot=report-findings] [data-slot=finding-row]")).toHaveLength(18);
    expect(readPref(SEVERITY_PREF, "all")).toBe("critical");
  });

  test("a design check: its conventions as a tab, with a link to «Соглашения»", async () => {
    open("p1-decompose-design-check", { tab: "conventions" });
    expect(tabNames()).toEqual(["Находки10", "Не проверено0", "Идеи0", "План правок0", "Допущения0", "Соглашения26", "Файл отчёта"]);
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelectorAll("[data-slot=section-items] > li")).toHaveLength(26);
    expect(within(panel).getByRole("link", { name: "Все соглашения прогона" })).toHaveAttribute("href", runPath(KEY, { view: "conventions" }));
    // gap 8 (f15): each line links to its own convention by the run's ordinal, the address «Соглашения» reads
    const own = run.conventions.filter((c) => c.launch === "p1-decompose-design-check");
    expect(own).toHaveLength(26);
    const lines = [...panel.querySelectorAll<HTMLElement>("[data-slot=section-items] > li")];
    lines.forEach((li, i) => {
      const link = within(li).getByRole("link", { name: `Соглашение ${own[i].n} в «Соглашениях»` });
      expect(link).toHaveAttribute("href", runPath(KEY, { view: "conventions", convention: String(own[i].n) }));
      expect(link).toHaveTextContent(new RegExp(`^${own[i].n}$`));
      // Strict 1: the ordinal's box is fixed, as in «Соглашения», so a two-digit number moves no line's text
      expect(link.parentElement).toHaveClass("w-[3ch]", "shrink-0", "text-right", "tabular-nums");
    });
  });

  test("a verdict critic: resolved / partial / unresolved as its outcome; ids in its text are links", () => {
    open("p1-verdict-critic-code-verdict", { tab: "verdict" });
    expect(factRows()[0]).toEqual(["Вердикты", "1 resolved · 1 partial · 0 unresolved"]);
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelector("[data-slot=section-lead]")).toHaveTextContent(/^Исправлена ли каждая находка прошлого прохода: resolved — да, partial — отчасти, unresolved — нет\.$/);
    expect(within(panel).getByRole("link", { name: "p1-review-critic-code#code-1" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: "p1-review-critic-code#code-1" }));
  });
});

describe("craft-1: the strip keeps every label whole — what does not fit folds into «…»", () => {
  /** A tab's box as measured on p1-verdict-reports-reader.png: «Находки 30» takes 102 px with its 4 px gap — 47 px of
   * padding, gap and the count's three-digit box, and about 7.3 px a letter. */
  const tabWidth = (label: string) => 47 + 7.3 * label.length;
  /** gap 4: the strip folds in `CountTabs`, which measures its room as the list and its «Ещё N» box together — the
   * list, flexible, takes what the box leaves of the reader's width. */
  const layout = (strip: number) =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const more = this.parentElement?.querySelector("[data-slot=tabs-more]") ? 64 : 0;
      const width = this.getAttribute("role") === "tablist" ? strip - more : this.dataset.slot === "tabs-more" ? 64 : this.getAttribute("role") === "tab" ? tabWidth((this.textContent ?? "").replace(/\d+$/, "")) : 0;
      return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });
  // the widest strip of the real runs on this machine (db.ren.net 9944a718, p1-map-shape-monitor-a): a shape critic
  // whose SHAPE lines the run reads as parts of their own
  const shape: Launch = {
    ...launch("p1-review-critic-code"),
    id: "p1-map-shape-monitor-a",
    description: "shape monitor-a",
    sections: {
      LENS: { value: "shape", items: [] },
      CANDIDATES: { value: "", items: ["a", "b", "c", "d"] },
      ASSUMPTIONS: { value: "", items: Array.from({ length: 14 }, (_, k) => `assumption ${k + 1}`) },
      JUDGED: { value: "", items: [] },
      SHAPE: { value: "", items: [] },
      ...Object.fromEntries(["ANSWERS", "WALK", "RANGES", "LEADS", "ACTIONS", "ENTRY", "OPTIONS"].map((k) => [k, { value: `${k.toLowerCase()} as written`, items: [] }])),
      BLOCKS: { value: "", items: Array.from({ length: 7 }, (_, k) => `block ${k + 1}`) },
      CHOSEN: { value: "", items: Array.from({ length: 6 }, (_, k) => `choice ${k + 1}`) },
    },
  };
  const over = { ...run, launches: [...run.launches, shape] };
  const ALL = ["Находки0", "Не проверено0", "Идеи4", "План правок0", "Допущения14", "Решённые вопросы0", "Форма раздела0", "ANSWERS1", "WALK1", "RANGES1", "LEADS1", "ACTIONS1", "ENTRY1", "OPTIONS1", "BLOCKS7", "CHOSEN6", "Файл отчёта"];

  for (const [strip, width] of [
    [790, "1440"],
    [815, "900"],
  ] as const)
    test(`craft-1: the widest real set at ${width} px — every tab once, in order; the strip's labels fit whole; a folded part opens from «…»`, async () => {
      const user = userEvent.setup({ delay: null });
      const spy = layout(strip);
      try {
        open(shape.id, {}, over);
        const list = within(reader()).getByRole("tablist", { name: "Части отчёта" });
        const shown = within(list).getAllByRole("tab").map((t) => t.textContent ?? "");
        // the first part and «Файл отчёта» (where an unread line sends the user) stay; the parts between fold from the right
        expect(shown[0]).toBe("Находки0");
        expect(shown.at(-1)).toBe("Файл отчёта");
        // «Ещё N»: the trigger names how many parts it holds, in a 64 px box
        // — its visible «Ещё N», its name whole with the noun (u13 improve-5 (2): «Ещё 9 частей отчёта»)
        const more = within(reader()).getByRole("button", { name: /^Ещё \d+ (часть|части|частей) отчёта$/ });
        expect(more).toHaveTextContent(/^Ещё \d+$/);
        expect(more.parentElement).toHaveClass("w-16", "shrink-0", "sticky", "top-0");
        await user.click(more);
        const menu = await screen.findByRole("menu");
        expect(menu).toHaveAttribute("aria-label", "Другие части отчёта");
        const folded = within(menu).getAllByRole("menuitem").map((m) => (m.textContent ?? "").replace(/\s+(\d+)$/, "$1"));
        expect(folded.length).toBeGreaterThan(0);
        expect([...shown.slice(0, -1), ...folded, shown.at(-1)]).toEqual(ALL);
        // every label whole: the strip's tabs with their gaps, its padding and «…» fit the strip's width
        const used = shown.reduce((s, t) => s + tabWidth(t.replace(/\d+$/, "")) + 4, 6) + 64;
        expect(used).toBeLessThanOrEqual(strip);
        // a folded part opens from the menu and takes its place in the strip, selected; the URL names it
        const pick = folded.at(-1) as string;
        await user.click(within(menu).getByRole("menuitem", { name: new RegExp(`^${pick.replace(/\d+$/, "")}`) }));
        const chosen = within(list).getByRole("tab", { name: new RegExp(`^${pick.replace(/\d+$/, "")}`) });
        expect(chosen).toHaveAttribute("aria-selected", "true");
        const after = within(list).getAllByRole("tab").map((t) => t.textContent ?? "");
        expect(after.reduce((s, t) => s + tabWidth(t.replace(/\d+$/, "")) + 4, 6) + 64).toBeLessThanOrEqual(strip);
      } finally {
        spy.mockRestore();
      }
    });

  test("craft-1: with room for every tab nothing folds and «…» is not drawn", () => {
    const spy = layout(2400);
    try {
      open(shape.id, {}, over);
      expect(tabNames()).toEqual(ALL);
      expect(within(reader()).queryByRole("button", { name: /^Ещё/ })).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("cand-3 (u6 shape): a craft report against the surface's earlier one", () => {
  const earlier = launch("p1-map-craft-accounts");
  const later: Launch = { ...earlier, id: "p2-assess-craft-accounts", stage: "p2-assess" };
  const own = reportFindings(run.findings, earlier.id);
  const next = (k: number, extra: Partial<Finding> = {}): Finding => ({ ...own[k], id: `${later.id}#craft-${k + 1}`, local: `craft-${k + 1}`, launch: later.id, stage: "p2-assess", duplicateOf: null, repeatedBy: null, ...extra });
  // the run linked two of the later findings to earlier ones — a duplicate, and a repeat of a fix that did not hold
  const laterFindings = [next(0, { duplicateOf: own[0].id }), next(1), next(2)];
  const surfaces: Surface[] = run.surfaces.map((s) => (s.key === "accounts" ? { ...s, scores: [...s.scores, { stage: "p2-assess", launch: later.id, audit: 12, auditMax: 20, critique: 30, critiqueMax: 40 }] } : s));
  const over = {
    ...run,
    launches: [...run.launches, later],
    findings: [...run.findings.map((f) => (f.id === own[1].id ? { ...f, repeatedBy: laterFindings[1].id } : f)), ...laterFindings],
    surfaces,
  };

  test("cand-3 (u6 shape): «Сравнение» — the parts counted then and now, the findings new, repeated and not repeated by the run's own record", () => {
    open(later.id, { tab: "compare" }, over);
    expect(tabNames()).toContain("Сравнение");
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelector("[data-slot=section-lead]")).toHaveTextContent(/^С отчётом p1-map-craft-accounts — проход 1 · карта\. Повторилась — находка, которую прогон записал дубликатом или повтором прежней\.$/);
    expect(within(panel).getByRole("link", { name: "p1-map-craft-accounts" })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: earlier.id }));
    expect(panel.querySelector("[data-slot=compare-counts]")).toHaveTextContent("Находки 18 → 3 · Не проверено 1 → 1 · Идеи 2 → 2 · План правок 1 → 1 · Допущения 1 → 1");
    const groups = [...panel.querySelectorAll<HTMLElement>("[data-slot=compare-group]")];
    expect(groups.map((g) => g.querySelector("h3")?.textContent)).toEqual(["Новые — 1 находка", "Повторились — 2 находки", "Не повторились — 16 находок"]);
    expect([...groups[0].querySelectorAll<HTMLElement>("[data-slot=finding-row]")].map((r) => r.textContent)).toHaveLength(1);
    expect(groups[0]).toHaveTextContent("craft-3");
    expect(groups[2].querySelectorAll("[data-slot=finding-row]")).toHaveLength(16);
  });

  test("p2-verdict-critic-craft-verdict#craft-3: «Сравнение» lists each group through the shared expanding rows — a chevron, one Tab stop, Enter opens the finding in place", async () => {
    const user = userEvent.setup({ delay: null });
    open(later.id, { tab: "compare" }, over);
    const panel = within(reader()).getByRole("tabpanel");
    const lists = ["compare-new", "compare-kept", "compare-gone"].map((slot) => panel.querySelector<HTMLElement>(`ol[data-slot=${slot}]`) as HTMLElement);
    expect(lists.map((l) => l.querySelectorAll(":scope > li").length)).toEqual([1, 2, 16]);
    const gone = lists[2];
    const chevrons = [...gone.querySelectorAll<HTMLElement>("button[aria-expanded]")];
    expect(chevrons).toHaveLength(16);
    // one Tab stop for the group: the first chevron; the ids' links leave the Tab order, as in «Находки» of a report
    expect([...gone.querySelectorAll<HTMLElement>("a[href], button")].filter((el) => el.tabIndex >= 0)).toEqual([chevrons[0]]);
    chevrons[0].focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(chevrons[1]).toHaveAttribute("aria-expanded", "true");
    expect(gone.querySelector("[data-slot=finding-detail]")).not.toBeNull();
  });

  test("cand-3 (u6 shape): the earliest report of a surface has nothing to compare with — no «Сравнение»", () => {
    open(earlier.id, {}, over);
    expect(tabNames()).not.toContain("Сравнение");
  });
});

describe("other kinds", () => {
  test("an implementer: its RESULT … VERIFY tabs, the result as its outcome, the unit a link", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-units-u1-implement");
    // no frames: an implementer's strip has no «Кадры»
    expect(tabNames()).toEqual(["Итог1", "Файлы1", "Тесты2", "Заметки0", "Находки1", "Паритет0", "Проверка кода1", "Файл отчёта"]);
    expect(factRows()).toEqual([
      ["Итог", "done"],
      ["Находки", "1 находка1 без серьёзности"],
    ]);
    // «отчёт запуска» does not name the agent: the line does
    expect(reader().querySelector("[data-slot=report-meta]")).toHaveTextContent(/^исполнитель · claude-opus-5-5 · /);
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(reader().querySelector("[data-slot=fact] a[href*='unit=u1']")).toHaveTextContent("u1");
    expect(reader()).toHaveTextContent("отчёт запуска");
  });

  test("cand-5: the map — no sections, so no one-tab strip: its free text with its eight tables, each scrolling sideways in its own box", async () => {
    open("p1-map-map");
    expect(within(reader()).queryByRole("tablist")).toBeNull();
    expect(tabNames()).toEqual([]);
    const file = await loadedFile();
    expect(within(file).getByRole("heading", { name: "1. Functions" })).toBeInTheDocument();
    const tables = within(file).getAllByRole("region", { name: "Таблица" });
    expect(tables).toHaveLength(8);
    for (const t of tables) expect(t).toHaveClass("overflow-x-auto", "max-w-full", "border", "[scrollbar-gutter:stable]");
    expect(file.querySelector("[data-slot=running-text]")).toHaveClass("max-w-measure");
    // its unread lines, if any, are in the text below, not on a tab that is not there
    expect(unparsedText(3, { inline: true })).toBe("3 строки не разобраны — они в тексте отчёта ниже");
  });

  test("research: its own section as written, then the file", () => {
    open("p1-spike-spike-telegram");
    expect(tabNames()).toEqual(["SPIKE1", "Файл отчёта"]);
    // finished: no «Состояние» row to say so (improve-10 (2))
    expect(factRows().map((r) => r[0])).not.toContain("Состояние");
  });
});

describe("cand-6 (p1 review): moving between reports, the file's outline, a retry", () => {
  test("cand-6: «Предыдущий отчёт» and «Следующий отчёт» — links with J and K, in the rail's order", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-map-craft-accounts");
    const next = within(reader()).getByRole("link", { name: "Следующий отчёт" });
    expect(next).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-map-craft-bots" }));
    await user.keyboard("j");
    await waitFor(() => expect(at(view.probe)).toBe("p1-map-craft-bots"));
    expect(screen.getByRole("heading", { level: 2, name: "craft bots" })).toBeInTheDocument();
    await user.keyboard("k");
    await waitFor(() => expect(at(view.probe)).toBe("p1-map-craft-accounts"));
    // the first report: no previous one — the control stays, focusable, and says why it does nothing
    await user.keyboard("k");
    await waitFor(() => expect(at(view.probe)).toBe("p1-map-map"));
    const prev = within(reader()).getByRole("button", { name: "Предыдущий отчёт" });
    expect(prev).toHaveAttribute("aria-disabled", "true");
    expect(prev).not.toHaveAttribute("href");
    await user.keyboard("k");
    expect(at(view.probe)).toBe("p1-map-map");
  });

  test("cand-6, p2-verdict-critic-craft-verdict-3#craft-1: a long «Файл отчёта» opens with its outline — each heading a button that brings it into view in the reader's own scroller, under the sticky strip, nothing above it moving", async () => {
    const user = userEvent.setup({ delay: null });
    const into = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const box = () => document.querySelector("[data-slot=report-reader-scroll]") as HTMLElement;
    // jsdom lays nothing out: the reader's box stands 100 px down; «3. Parser gaps» 1 300 px into its text
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.dataset.slot === "report-reader-scroll" ? 100 : this.textContent === "3. Parser gaps" && /^H[34]$/.test(this.tagName) ? 1300 - box().scrollTop : 0;
      return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      open("p1-map-map");
      await loadedFile();
      const outline = within(reader()).getByRole("navigation", { name: "Содержание отчёта" });
      const items = within(outline).getAllByRole("button");
      expect(items.map((b) => b.textContent)).toEqual(["1. Functions", "2. Server", "3. Parser gaps", "4. fsl.mjs computes", "5. Production shape", "6. Building blocks", "7. Tokens", "8. Components"]);
      await user.click(items[2]);
      // 48 px under the reader's top — the 40 px sticky strip and 8 px: 1 300 − 100 − 48
      expect(box().scrollTop).toBe(1152);
      expect((document.querySelector("[data-slot=view-body]") as HTMLElement).scrollTop).toBe(0);
      expect(into).not.toHaveBeenCalled();
    } finally {
      rects.mockRestore();
      into.mockRestore();
    }
  });

  test("cand-6: a file whose read failed offers «Повторить», and a retry that reads it shows the text", async () => {
    const user = userEvent.setup({ delay: null });
    let calls = 0;
    const fetchReport: FetchReport = async (runKey, file) => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ error: "Отчёт p1-map-craft-accounts.md не прочитан", cause: "EBUSY: resource busy or locked" }), { status: 500 });
      return handlerReport(fx)(runKey, file);
    };
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-craft-accounts", tab: "file" }), ReportsView, { fetchReport });
    await waitFor(() => expect(reader().querySelector("[data-slot=part-failed]")).toHaveTextContent("Отчёт p1-map-craft-accounts.md не прочитан: EBUSY: resource busy or locked"));
    await user.click(within(reader()).getByRole("button", { name: "Повторить" }));
    const file = await loadedFile();
    expect(file).toHaveTextContent("LENS: craft assess");
    expect(calls).toBe(2);
  });
});

describe("«Файл отчёта»", () => {
  test("the file as written, read when the tab opens: «Загрузка…» in a reserved region first, then every line", async () => {
    const written = readFileSync(join(fx.dirOf(N), "reports", "p1-map-craft-accounts.md"), "utf8");
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const asked: string[] = [];
    const fetchReport: FetchReport = async (runKey, file) => {
      asked.push(`${runKey} ${file}`);
      await gate;
      return handlerReport(fx)(runKey, file);
    };
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-craft-accounts", tab: "file" }), ReportsView, { fetchReport });
    const loading = reader().querySelector("[data-slot=report-file-loading]") as HTMLElement;
    expect(loading).toHaveClass("h-48");
    expect(within(loading).getByRole("status")).toHaveTextContent("Загрузка…");
    expect(asked).toEqual([`${KEY} p1-map-craft-accounts.md`]);
    act(() => release());
    const file = await loadedFile();
    expect(reader().querySelector("[data-slot=report-file-loading]")).toBeNull();
    // every line as written: the lens, a finding line, an idea, the order
    for (const line of ["LENS: craft assess", "UNVERIFIED:", "A shortcut for the accounts list would save a step (2).", "accounts: /impeccable clarify, harden, polish"]) expect(written).toContain(line);
    expect(file).toHaveTextContent("LENS: craft assess");
    expect(file).toHaveTextContent(/craft-18 \[craft\] critical/);
    expect(file).toHaveTextContent("A shortcut for the accounts list would save a step (2).");
    expect(file).toHaveTextContent("accounts: /impeccable clarify, harden, polish");
  });

  test("a file that cannot be read: «Отчёт <file> не прочитан: <причина>» in its place", async () => {
    const fetchReport: FetchReport = async () => new Response(JSON.stringify({ error: "Отчёт p1-map-craft-accounts.md не прочитан", cause: "EISDIR: illegal operation on a directory, read" }), { status: 500 });
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-craft-accounts", tab: "file" }), ReportsView, { fetchReport });
    await waitFor(() => expect(reader().querySelector("[data-slot=part-failed]")).toHaveTextContent("Отчёт p1-map-craft-accounts.md не прочитан: EISDIR: illegal operation on a directory, read"));
  });

  test("a 59.8 kB file with markdown tables renders whole", async () => {
    const rows = Array.from({ length: 520 }, (_, k) => `| ${k + 1} | function ${k + 1} of the prototype, kept as is | template.html:${k * 11} | read by fsl.mjs, shown in «Находки» |`);
    const text = ["# Map", "", "| # | what | where | note |", "|---|---|---|---|", ...rows, "", "The last line of the map."].join("\n");
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(59_000);
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-map" }), ReportsView, { fetchReport: async () => new Response(text) });
    const file = await loadedFile();
    expect(within(file).getByRole("region", { name: "Таблица" }).querySelectorAll("tbody tr")).toHaveLength(520);
    expect(file).toHaveTextContent("The last line of the map.");
    // one heading is no outline
    expect(within(reader()).queryByRole("navigation", { name: "Содержание отчёта" })).toBeNull();
  });
});

describe("the states of the WALK", () => {
  test("a running launch: its facts and «Отчёт появится, когда запуск закончит»", () => {
    open("aa5b5ec85u30");
    expect(within(reader()).getByRole("heading", { level: 2 })).toHaveTextContent("u30 implement");
    expect(factRows()).toEqual([
      ["Состояние", "работает · 12 мин"],
      ["Агент", "исполнительfsloop-implement"],
      ["Этап", "проход 2 · приёмка"],
      ["Начало", "19:29 МСК"],
      ["Последняя запись в транскрипт", "1 мин назад"],
    ]);
    expect(reader().querySelector("[data-slot=report-running]")).toHaveTextContent("Отчёт появится, когда запуск закончит");
    expect(within(reader()).queryAllByRole("tab")).toHaveLength(0);
  });

  test("a missing or unreadable file: «Отчёт <file> не прочитан: <причина>» in the sections' place", () => {
    const l: Launch = { ...launch("p1-map-craft-accounts"), reportMissing: true };
    const over = { ...run, launches: run.launches.map((x) => (x.id === l.id ? l : x)), errors: [{ file: "reports/p1-map-craft-accounts.md", cause: "файла нет" }] };
    open(l.id, {}, over);
    expect(reader().querySelector("[data-slot=part-failed]")).toHaveTextContent("Отчёт p1-map-craft-accounts.md не прочитан: файла нет");
    expect(within(reader()).queryAllByRole("tab")).toHaveLength(0);
    expect(factRows()[0]).toEqual(["Состояние", "нет отчёта"]);
  });

  test("a partly parsed report: one line naming the unread lines, which «Файл отчёта» holds", async () => {
    const user = userEvent.setup({ delay: null });
    const unparsed = [3, 9, 14].map((line) => ({ id: `p1-map-craft-accounts#u${line}`, section: "FINDINGS", line, text: `garbled line ${line}` }));
    const l: Launch = { ...launch("p1-map-craft-accounts"), unparsed };
    open(l.id, {}, { ...run, launches: run.launches.map((x) => (x.id === l.id ? l : x)) });
    expect(reader().querySelector("[data-slot=report-unparsed]")).toHaveTextContent("3 строки не разобраны — они на вкладке «Файл отчёта»");
    expect(unparsedText(1)).toBe("1 строка не разобрана — она на вкладке «Файл отчёта»");
    expect(unparsedText(12)).toBe("12 строк не разобраны — они на вкладке «Файл отчёта»");
    expect(unparsedText(12).split(/\s+/)).toHaveLength(10);
    await user.click(screen.getByRole("tab", { name: /^Файл отчёта/ }));
    // the tab holds the file as written, so the lines the parser skipped are there
    await waitFor(() => expect(reader().querySelector("[data-slot=report-file]")).toHaveTextContent("LENS: craft assess"));
  });
});

describe("the production shape", () => {
  test("a 59.8 kB report reads in full; 20 frames show 16 and «ещё 4 кадра»; scores over five stages link four", () => {
    const items = Array.from({ length: 240 }, (_, k) => `Assumption ${k + 1}: ${"the operator reads the report at a 75-character measure and keeps every fact; ".repeat(3)}`.slice(0, 259));
    const l: Launch = { ...launch("p1-map-craft-accounts"), sections: { ...launch("p1-map-craft-accounts").sections, ASSUMPTIONS: { value: "", items } } };
    const frames = Array.from({ length: 20 }, (_, k) => `p1-baseline-accounts-${k + 1}.png`);
    const stages = ["p1-map", "p1-assess", "p2-review", "p2-assess", "p3-assess"];
    const scores = stages.map((stage, k) => ({ stage, launch: k === 0 ? l.id : `${stage}-craft-accounts`, audit: 8 + k, auditMax: 20, critique: 18 + k, critiqueMax: 40 }));
    const extra = stages.slice(1).map((stage) => ({ ...l, id: `${stage}-craft-accounts`, stage }));
    const surfaces: Surface[] = run.surfaces.map((s) => (s.key === "accounts" ? { ...s, frames, scores } : s));
    expect(new TextEncoder().encode(items.join("\n")).length).toBeGreaterThan(59_000);
    const over = { ...run, launches: [...run.launches.map((x) => (x.id === l.id ? l : x)), ...extra], surfaces };
    const view = open(l.id, { tab: "assumptions" }, over);
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelectorAll("[data-slot=section-items] > li")).toHaveLength(240);
    expect(panel).toHaveTextContent(items[239].trim());
    expect(panel.querySelector("[data-slot=running-text]")?.closest("div.max-w-measure")).toBeTruthy();
    view.unmount();
    // the frames are a tab of their own (craft-13): «Кадры 20»
    open(l.id, { tab: "frames" }, over);
    expect(screen.getByRole("tab", { name: /^Кадры/ })).toHaveTextContent("Кадры20");
    const strip = within(reader()).getByRole("tabpanel").querySelector("[data-slot=frame-strip]") as HTMLElement;
    expect(within(strip).getAllByRole("button", { name: /^Открыть кадр / })).toHaveLength(16);
    for (const t of within(strip).getAllByRole("button", { name: /^Открыть кадр / })) expect(t).toHaveClass("h-thumb-h", "w-thumb-w");
    expect(within(strip).getByRole("button", { name: "ещё 4 кадра" })).toBeInTheDocument();
    const audit = reader().querySelector("[data-slot=score-audit]") as HTMLElement;
    expect(audit).toHaveTextContent("аудит 8 → 9 → 10 → 11 → 12 из 20");
    expect(within(audit).getAllByRole("link")).toHaveLength(4);
    expect(within(audit).getAllByRole("link")[0]).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-assess-craft-accounts" }));
  });
});
