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
