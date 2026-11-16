// @vitest-environment jsdom
import "./test-setup.ts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { NOUNS } from "../../shared/text.ts";
import { CountLink } from "./count-link.tsx";
import { CountTabs } from "./count-tabs.tsx";
import { FactList } from "./fact-list.tsx";
import { flatItem, FlatList } from "./flat-list.tsx";
import { HeldStrip, heldStripText } from "./held-strip.tsx";
import { resetPrefsMemory } from "./storage.ts";
import { renderUi } from "./test-utils.tsx";

describe("fact list", () => {
  const facts = [
    { label: "Режим", value: "worktree" },
    { label: "Этап", value: "проход 1 · юниты в работе", outcome: true },
    { label: "Модели", value: "claude-opus-5-5" },
    { label: "Активность", value: "работает", outcome: true },
  ];
  const more = [
    { label: "Рабочая копия", value: "C:/dev/fsl/00558d48" },
    { label: "Версия", value: "4" },
  ];

  test("outcome rows open the list, then the facts, one label and one value per row", () => {
    const { container } = render(<FactList facts={facts} label="Прогон" />);
    expect([...container.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Этап", "Активность", "Режим", "Модели"]);
    expect(container.querySelectorAll("dd")).toHaveLength(4);
    expect(container.querySelectorAll("[data-outcome]")).toHaveLength(2);
  });

  test("«Подробнее» folds the rest at the end and keeps its state in the browser", async () => {
    const user = userEvent.setup();
    const first = render(<FactList facts={facts} more={more} foldKey="run" />);
    expect(screen.queryByText("Рабочая копия")).toBeNull();
    const fold = screen.getByRole("button", { name: "Подробнее" });
    expect(fold).toHaveAttribute("aria-expanded", "false");
    fold.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Рабочая копия")).toBeInTheDocument();
    expect(window.localStorage.getItem("fsloopui:fold:run")).toBe("true");
    first.unmount();
    resetPrefsMemory();
    render(<FactList facts={facts} more={more} foldKey="run" />);
    expect(screen.getByRole("button", { name: "Подробнее" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Версия")).toBeInTheDocument();
  });

  test("craft-8: a label may carry its glossary — the term dotted on the label, the value plain", () => {
    const { container } = renderUi(
      <FactList
        facts={[
          { label: "Активность", glossary: [{ value: "работает", meaning: "в папке прогона была запись за последние 5 минут" }], value: "работает", outcome: true },
          { label: "Режим", value: "worktree" },
        ]}
      />,
    );
    const [first, second] = [...container.querySelectorAll<HTMLElement>("dt")];
    expect(within(first).getByRole("button", { name: "Активность" })).toHaveAttribute("data-slot", "glossary-term");
    expect(second.querySelector("[data-slot=glossary-term]")).toBeNull();
    expect(container.querySelector("dd [data-slot=glossary-term]")).toBeNull();
    expect([...container.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Активность", "Режим"]);
  });

  test("cand-9: the label column is as wide as every label, the folded ones included — opening «Подробнее» moves no value", async () => {
    const { container } = render(<FactList facts={facts} more={more} foldKey="columns" />);
    const sizers = () => [...container.querySelectorAll<HTMLElement>("[data-slot=label-sizer]")];
    // the folded labels hold their room in the first label's cell, drawn as generated content: no text anyone reads
    expect(sizers().map((s) => s.dataset.text)).toEqual(["Рабочая копия", "Версия"]);
    for (const s of sizers()) {
      expect(s).toHaveClass("invisible", "h-0");
      expect(s).toHaveAttribute("aria-hidden", "true");
      expect(s.textContent).toBe("");
      expect(s.closest("dt")).toBe(container.querySelector("dt"));
    }
    await userEvent.setup().click(screen.getByRole("button", { name: "Подробнее" }));
    expect(sizers()).toHaveLength(2);
    expect([...container.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Этап", "Активность", "Режим", "Модели", "Рабочая копия", "Версия"]);
  });
});

describe("held-order strip", () => {
  const run = { forms: NOUNS.run, gender: "m" } as const;
  const finding = { forms: NOUNS.finding, gender: "f" } as const;

  test("the verb names what the click does", () => {
    expect(heldStripText({ fresh: 2, moved: 1, left: 0 }, run)).toBe("2 новых прогона · 1 прогон сместился · показать");
    expect(heldStripText({ fresh: 12, moved: 0, left: 0 }, finding)).toBe("12 новых находок · показать");
    expect(heldStripText({ fresh: 0, moved: 0, left: 3 }, finding)).toBe("3 находки вне фильтра · убрать");
    expect(heldStripText({ fresh: 1, moved: 0, left: 1 }, finding)).toBe("1 новая находка · 1 находка вне фильтра · обновить список");
    expect(heldStripText({ fresh: 0, moved: 21, left: 0 }, run)).toBe("21 прогон сместился · показать");
    expect(heldStripText({ fresh: 0, moved: 0, left: 0 }, run)).toBeNull();
  });

  test("the compact form drops the noun for a narrow host and keeps the agreement", () => {
    expect(heldStripText({ fresh: 12, moved: 12, left: 0 }, run, { compact: true })).toBe("12 новых · 12 сместились · показать");
    expect(heldStripText({ fresh: 1, moved: 1, left: 0 }, finding, { compact: true })).toBe("1 новая · 1 сместилась · показать");
  });

  test("its line is reserved whether or not something waits; a click places the rows", async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();
    const { container, rerender } = render(<HeldStrip counts={{ fresh: 0, moved: 0, left: 0 }} noun={run} onApply={onApply} />);
    const strip = container.querySelector('[data-slot="held-strip"]')!;
    expect(strip).toHaveClass("h-strip", "shrink-0");
    expect(strip).toHaveAttribute("aria-live", "polite");
    expect(within(strip as HTMLElement).queryByRole("button")).toBeNull();
    rerender(<HeldStrip counts={{ fresh: 2, moved: 1, left: 0 }} noun={run} onApply={onApply} />);
    expect(container.querySelector('[data-slot="held-strip"]')).toBe(strip);
    expect(strip).toHaveClass("h-strip");
    await user.click(screen.getByRole("button", { name: "2 новых прогона · 1 прогон сместился · показать" }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  test("craft-6: the host names what became of a row that left — a list with no filter says «пропал», agreed; «вне фильтра» by default", () => {
    const gone = heldStripText({ fresh: 0, moved: 0, left: 1 }, run, { leftKind: "gone" });
    expect(gone).toBe("1 прогон пропал · убрать");
    expect(gone?.split(" ")).toHaveLength(5);
    expect(heldStripText({ fresh: 0, moved: 0, left: 3 }, run, { leftKind: "gone" })).toBe("3 прогона пропали · убрать");
    expect(heldStripText({ fresh: 0, moved: 0, left: 21 }, run, { leftKind: "gone" })).toBe("21 прогон пропал · убрать");
    expect(heldStripText({ fresh: 1, moved: 0, left: 1 }, finding, { leftKind: "gone" })).toBe("1 новая находка · 1 находка пропала · обновить список");
    expect(heldStripText({ fresh: 0, moved: 0, left: 12 }, run, { leftKind: "gone", compact: true })).toBe("12 пропали · убрать");
    expect(heldStripText({ fresh: 0, moved: 0, left: 1 }, run)).toBe("1 прогон вне фильтра · убрать");
    renderUi(<HeldStrip counts={{ fresh: 0, moved: 0, left: 1 }} noun={run} leftKind="gone" onApply={() => {}} />);
    expect(screen.getByRole("button", { name: "1 прогон пропал · убрать" })).toBeInTheDocument();
  });
});

describe("flat list", () => {
  // The production shape: 63 run cards in the sidebar.
  const keys = Array.from({ length: 63 }, (_, i) => `tga/${String(i).padStart(8, "0")}`);
  const Cards = ({ current }: { current: string }) => (
    <>
      <button type="button">до списка</button>
      <FlatList label="Прогоны">
        <h3>Идут</h3>
        {keys.map((key) => (
          <a key={key} href={`/r/${key}`} aria-current={key === current ? "page" : undefined} {...flatItem(key)}>
            {key}
          </a>
        ))}
      </FlatList>
      <button type="button">после списка</button>
    </>
  );

  test("one Tab stop — the open item — and Tab leaves the list", async () => {
    const user = userEvent.setup();
    render(<Cards current={keys[5]} />);
    const links = screen.getAllByRole("link");
    expect(links.filter((a) => a.tabIndex === 0)).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "до списка" }));
    await user.tab();
    expect(links[5]).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "после списка" })).toHaveFocus();
  });

  test("↑/↓ move, Home/End jump, the heading is not a stop", async () => {
    const user = userEvent.setup();
    render(<Cards current={keys[0]} />);
    const links = screen.getAllByRole("link");
    links[0].focus();
    await user.keyboard("{ArrowUp}");
    expect(links[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(links[2]).toHaveFocus();
    expect(links.filter((a) => a.tabIndex === 0)).toEqual([links[2]]);
    await user.keyboard("{End}");
    expect(links[62]).toHaveFocus();
    await user.keyboard("{Home}");
    expect(links[0]).toHaveFocus();
  });

  test("Enter on an item that is not a link opens it by its key", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <FlatList label="Отчёты" onOpen={onOpen}>
        <div role="button" {...flatItem("p1-map-map")}>
          карта
        </div>
        <div role="button" {...flatItem("p1-review-craft")}>
          craft
        </div>
      </FlatList>,
    );
    screen.getByText("карта").focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onOpen).toHaveBeenCalledWith("p1-review-craft");
  });

  test("gap 10 (f16): Enter on a link or a button inside an item that is not a link is theirs — the item does not take it", async () => {
    const onOpen = vi.fn();
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(
      <FlatList label="Журнал решений" onOpen={onOpen}>
        <article tabIndex={0} {...flatItem("12")}>
          #12 <button type="button" onClick={onCopy}>скопировать</button> <a href="#u3">u3</a>
        </article>
      </FlatList>,
    );
    screen.getByRole("button", { name: "скопировать" }).focus();
    await user.keyboard("{Enter}");
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    // Enter on the item itself still opens it
    (document.querySelector("article") as HTMLElement).focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledWith("12");
  });
});

describe("tabs with counts", () => {
  const tabs = [
    { value: "findings", label: "Находки", count: 723 },
    { value: "units", label: "Юниты", count: 42 },
    { value: "reports", label: "Отчёты", count: 97 },
    { value: "conventions", label: "Соглашения", count: 0 },
    { value: "journal", label: "Журнал", count: null },
  ];

  test("each tab carries its count in a reserved box; a zero is muted", () => {
    render(<CountTabs value="findings" onValueChange={() => {}} tabs={tabs} label="Разделы прогона" />);
    const list = screen.getByRole("tablist", { name: "Разделы прогона" });
    const triggers = within(list).getAllByRole("tab");
    expect(triggers.map((t) => t.textContent)).toEqual(["Находки723", "Юниты42", "Отчёты97", "Соглашения0", "Журнал"]);
    for (const t of triggers) expect(t.querySelector('[data-slot="tab-count"]')).toHaveClass("min-w-count", "tabular-nums");
    expect(triggers[3].querySelector('[data-slot="tab-count"]')).toHaveClass("text-muted-foreground");
    expect(triggers[0].querySelector('[data-slot="tab-count"]')).not.toHaveClass("text-muted-foreground");
    expect(triggers[0]).toHaveAttribute("aria-selected", "true");
  });

  test("←/→ move between tabs and choose them", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    function Strip() {
      const [value, setValue] = useState("units");
      return (
        <CountTabs
          value={value}
          onValueChange={(v) => {
            onValueChange(v);
            setValue(v);
          }}
          tabs={tabs}
          label="Разделы прогона"
        />
      );
    }
    render(<Strip />);
    screen.getByRole("tab", { name: /Юниты/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith("reports");
    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith("units");
  });

  test("verdict-4: the sticky strip is the tabs' own form — on the page's ground, at the top of what scrolls, its height reserved, sideways when narrow", () => {
    const { container } = render(<CountTabs sticky value="findings" onValueChange={() => {}} tabs={tabs} label="Разделы прогона" className="px-5" />);
    const list = screen.getByRole("tablist", { name: "Разделы прогона" });
    expect(list).toHaveAttribute("data-sticky", "");
    expect(list).toHaveClass("sticky", "top-0", "z-10", "w-full", "shrink-0", "border-b", "bg-background", "overflow-x-auto", "overflow-y-hidden", "group-data-horizontal/tabs:h-10", "px-5");
    // the root draws no box: the strip sticks within the region that scrolls its panels, or the page's
    expect(container.querySelector("[data-slot=tabs]")).toHaveClass("contents");
    render(<CountTabs value="findings" onValueChange={() => {}} tabs={tabs} label="Разделы отчёта" />);
    expect(screen.getByRole("tablist", { name: "Разделы отчёта" })).not.toHaveAttribute("data-sticky");
    expect(screen.getByRole("tablist", { name: "Разделы отчёта" })).not.toHaveClass("sticky");
  });

  describe("gap 4 (f14): a strip narrower than its tabs folds them from the right into «Ещё N»", () => {
    // 17 parts of a shape critic's report; a tab's box is 47 px of padding, gap and count plus 7.3 px a letter
    const parts = ["Находки", "Не проверено", "Идеи", "План правок", "Допущения", "Решённые вопросы", "Форма раздела", "ANSWERS", "WALK", "RANGES", "LEADS", "ACTIONS", "ENTRY", "OPTIONS", "BLOCKS", "CHOSEN", "Файл отчёта"];
    const wide = parts.map((label, i) => ({ value: `t${i}`, label, count: label === "Файл отчёта" ? null : i }));
    const tabWidth = (label: string) => 47 + 7.3 * label.length;
    /** The strip's room is the list and its «Ещё N» box together: the list takes what the box leaves. */
    const layout = (strip: number) =>
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const more = this.parentElement?.querySelector("[data-slot=tabs-more]") ? 64 : 0;
        const width = this.getAttribute("role") === "tablist" ? strip - more : this.dataset.slot === "tabs-more" ? 64 : this.getAttribute("role") === "tab" ? tabWidth((this.textContent ?? "").replace(/\d+$/, "")) : 0;
        return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      });
    const Strip = ({ initial = "t0" }: { initial?: string }) => {
      const [value, setValue] = useState(initial);
      return <CountTabs sticky value={value} onValueChange={setValue} tabs={wide} label="Части отчёта" className="w-auto min-w-0 flex-1" overflow={{ label: "Другие части отчёта", keep: ["t16"] }} />;
    };
    // by the DOM, not the accessibility tree: an open menu hides the rest of the page from it
    const shown = () => [...document.querySelectorAll('[role=tablist][aria-label="Части отчёта"] [role=tab]')].map((t) => (t.textContent ?? "").replace(/\d+$/, ""));

    test("the open tab and the kept one stay; the strip's labels fit whole beside a 64 px «Ещё N»; a folded part opens from its menu, selected", async () => {
      const spy = layout(790);
      try {
        const user = userEvent.setup({ delay: null });
        render(<Strip />);
        expect(shown()[0]).toBe("Находки");
        expect(shown().at(-1)).toBe("Файл отчёта");
        const more = screen.getByRole("button", { name: /^Ещё \d+$/ });
        expect(more.parentElement).toHaveAttribute("data-slot", "tabs-more");
        expect(more.parentElement).toHaveClass("w-16", "shrink-0", "sticky", "top-0", "h-10", "border-b", "bg-background");
        expect(shown().reduce((s, t) => s + tabWidth(t) + 4, 6) + 64).toBeLessThanOrEqual(790);
        await user.click(more);
        const menu = await screen.findByRole("menu");
        expect(menu).toHaveAttribute("aria-label", "Другие части отчёта");
        const folded = within(menu).getAllByRole("menuitem").map((m) => m.textContent ?? "");
        expect(more).toHaveAccessibleName(`Ещё ${folded.length}`);
        // in order, each with its count; together with the strip, every part once
        expect([...shown().slice(0, -1), ...folded.map((f) => f.replace(/\s\d+$/, "")), shown().at(-1)]).toEqual(parts);
        expect(folded.at(-1)).toBe("CHOSEN 15");
        await user.click(within(menu).getByRole("menuitem", { name: "CHOSEN 15" }));
        expect([...document.querySelectorAll("[role=tab]")].find((t) => t.textContent?.startsWith("CHOSEN"))).toHaveAttribute("aria-selected", "true");
        expect(shown().reduce((s, t) => s + tabWidth(t) + 4, 6) + 64).toBeLessThanOrEqual(790);
      } finally {
        spy.mockRestore();
      }
    });

    test("with room for every tab nothing folds and «Ещё» is not drawn; without `overflow` the strip never folds", () => {
      const spy = layout(2400);
      try {
        const { unmount } = render(<Strip />);
        expect(shown()).toEqual(parts);
        expect(screen.queryByRole("button", { name: /^Ещё/ })).toBeNull();
        unmount();
        spy.mockRestore();
        layout(400);
        render(<CountTabs sticky value="t0" onValueChange={() => {}} tabs={wide} label="Части отчёта" />);
        expect(shown()).toEqual(parts);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});

describe("count link", () => {
  test("a count above 0 that the list would show links, and opens through the caller", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<CountLink count={205} tone="warning" suffix="major" href="?view=findings" onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "205 major" });
    expect(link).toHaveAttribute("href", "?view=findings");
    expect(link.querySelector('[data-slot="dot"]')).toHaveAttribute("data-tone", "warning");
    await user.click(link);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  test("a zero is a muted «0» beside a neutral dot, never a link", () => {
    const { container } = render(<CountLink count={0} tone="danger" suffix="critical" href="?view=findings" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.firstChild).toHaveClass("text-muted-foreground");
    expect(container.firstChild).toHaveTextContent("0 critical");
    expect(container.querySelector('[data-slot="dot"]')).toHaveAttribute("data-tone", "neutral");
  });

  test("a count the list would not show the same is plain text; the noun agrees with the number", () => {
    render(<CountLink count={3} noun={NOUNS.finding} href="?view=findings" linkable={false} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("3 находки")).toBeInTheDocument();
  });
});
