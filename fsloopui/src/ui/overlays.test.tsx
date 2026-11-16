// @vitest-environment jsdom
import "./test-setup.ts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { LIVENESS } from "../../shared/liveness.ts";
import { SEVERITY, UNIT_STATE } from "../../shared/states.ts";
import { Button } from "@/components/ui/button";
import { AppDialog } from "./dialog.tsx";
import { keyLabel, Keys } from "./kbd.tsx";
import { copyItem, Menu } from "./menu.tsx";
import { comboboxValueText, CountCombobox, CountSelect } from "./select.tsx";
import { renderUi } from "./test-utils.tsx";
import { copyText, notify, toastTitle } from "./toast.tsx";
import { GlossaryTooltip, glossaryFrom, glossaryLines, Hint } from "./tooltip.tsx";

describe("toast", () => {
  test("a success leaves on its own; a failure stays with its one action until closed", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    renderUi(<span />);
    act(() => {
      notify.success("Скопировано: путь брифа");
      notify.error("Оценка не сохранилась", { cause: "сервер не ответил", action: { label: "Повторить", onClick: retry } });
    });
    expect(await screen.findByText("Скопировано: путь брифа")).toBeInTheDocument();
    const error = (await screen.findByText("Оценка не сохранилась")).closest("[data-sonner-toast]") as HTMLElement;
    expect(error).toHaveTextContent("сервер не ответил");
    expect(error).toHaveAttribute("data-type", "error");
    expect(within(error).getByRole("button", { name: "Закрыть уведомление" })).toBeInTheDocument();
    await user.click(within(error).getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("a title over 60 characters is cut, never stretched", () => {
    expect(toastTitle("Скопировано: путь брифа")).toBe("Скопировано: путь брифа");
    const long = toastTitle(`Скопировано: ${"C:/Users/kakaponick/Desktop/dev/fsl/00558d48/".repeat(2)}`);
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });

  test("the copy helper copies a selection joined by newlines, then says what it copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderUi(<span />);
    await act(async () => {
      await copyText(["p1-review-craft#craft-3", "p1-review-craft#craft-4"], "id");
    });
    expect(writeText).toHaveBeenCalledWith("p1-review-craft#craft-3\np1-review-craft#craft-4");
    expect(await screen.findByText("Скопировано: id")).toBeInTheDocument();
  });

  test("a refused copy says so and stays", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("Нет доступа к буферу обмена")) } });
    renderUi(<span />);
    await act(async () => {
      expect(await copyText("x", "ссылку")).toBe(false);
    });
    const toast = (await screen.findByText("Не скопировано: ссылку")).closest("[data-sonner-toast]");
    expect(toast).toHaveAttribute("data-type", "error");
    expect(toast).toHaveTextContent("Нет доступа к буферу обмена");
  });
});

describe("dialog", () => {
  test("opens with its title, closes on Escape and returns focus to its opener", async () => {
    const user = userEvent.setup();
    renderUi(
      <AppDialog title="Оценка для 12 находок" trigger={<Button>Оценить…</Button>} footer={<Button>Сохранить</Button>}>
        <p>Тело</p>
      </AppDialog>,
    );
    const opener = screen.getByRole("button", { name: "Оценить…" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Оценка для 12 находок" });
    expect(dialog).toHaveClass("max-h-dialog-cap");
    expect(within(dialog).getByText("Тело").parentElement).toHaveClass("overflow-y-auto");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(opener).toHaveFocus();
  });

  test("its ✕ is named in Russian", async () => {
    const user = userEvent.setup();
    renderUi(<AppDialog title="Кадр" trigger={<Button>Открыть</Button>} />);
    await user.click(screen.getByRole("button", { name: "Открыть" }));
    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("tooltip and glossary", () => {
  test("an icon-only control is named by its tooltip, its shortcut as Kbd", async () => {
    const user = userEvent.setup();
    renderUi(
      <Hint label="Найти находку" keys={["Slash"]}>
        <Button aria-label="Найти находку">
          <SearchIcon />
        </Button>
      </Hint>,
    );
    await user.tab();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Найти находку/");
  });

  test("a glossary keeps its bounds: at most 8 entries of at most 80 characters", () => {
    const severity = glossaryLines(glossaryFrom(SEVERITY, ["critical", "major", "minor"]));
    expect(severity[0]).toBe("critical — Находка ломает работу или данные: её смотрят первой.");
    for (const line of severity) expect(line.length).toBeLessThanOrEqual(80);
    const units = glossaryLines(glossaryFrom(UNIT_STATE, ["drafted", "ready", "implement", "verify", "debug", "land", "committed", "blocked"]));
    expect(units).toHaveLength(8);
    expect(glossaryLines(glossaryFrom(LIVENESS, ["working", "closed"]))[0]).toBe("работает — Прогон или его агенты писали файлы меньше 5 минут назад.");
    expect(() => glossaryLines(Array.from({ length: 9 }, (_, i) => ({ value: String(i), meaning: "x" })))).toThrow(/at most 8/);
    expect(() => glossaryLines([{ value: "v", meaning: "м".repeat(80) }])).toThrow(/at most 80/);
  });

  test("the glossary opens from the term's dotted label by keyboard", async () => {
    const user = userEvent.setup();
    renderUi(<GlossaryTooltip term="Серьёзность" entries={glossaryFrom(SEVERITY, ["critical", "major", "minor"])} />);
    expect(screen.getByRole("button", { name: "Серьёзность" })).toHaveClass("decoration-dotted");
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("minor — Мелкое нарушение правила: исправляется при случае.");
  });
});

describe("select and combobox", () => {
  test("a select shows its field and value, each option with its count; the keyboard chooses", async () => {
    const user = userEvent.setup();
    function View() {
      const [v, setV] = useState("all");
      return (
        <CountSelect
          label="Вид"
          value={v}
          onValueChange={setV}
          options={[
            { value: "all", label: "Все", count: 723 },
            { value: "unrated", label: "Без оценки", count: 723 },
            { value: "fix", label: "В исправление", count: 163 },
            { value: "candidate", label: "Кандидаты", count: 506 },
            { value: "committed", label: "Закоммичены", count: 0 },
          ]}
        />
      );
    }
    renderUi(<View />);
    const trigger = screen.getByRole("combobox", { name: "Вид" });
    expect(trigger).toHaveTextContent("Вид:Все723");
    trigger.focus();
    await user.keyboard("{Enter}");
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Все723", "Без оценки723", "В исправление163", "Кандидаты506", "Закоммичены0"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent("Вид:В исправление163"));
  });

  test("more than 7 options is not a select", () => {
    const options = Array.from({ length: 8 }, (_, i) => ({ value: String(i), label: String(i) }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<CountSelect label="Состояние" value="0" onValueChange={() => {}} options={options} />)).toThrow(/use CountCombobox/);
  });

  test("a combobox searches its options, chooses several by keyboard and says what it holds", async () => {
    const user = userEvent.setup();
    const units = Array.from({ length: 42 }, (_, i) => ({ value: `u${i + 1}`, label: `u${i + 1}`, count: i % 5 }));
    function Pick() {
      const [v, setV] = useState<string[]>([]);
      return <CountCombobox label="Юнит" placeholder="Найти юнит" value={v} onValueChange={setV} options={units} />;
    }
    renderUi(<Pick />);
    const trigger = screen.getByRole("combobox", { name: "Юнит: все" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const search = await screen.findByPlaceholderText("Найти юнит");
    expect(search).toHaveFocus();
    await user.keyboard("u4");
    const shown = screen.getAllByRole("option").map((o) => o.textContent);
    expect(shown[0]).toBe("u43");
    expect(shown.length).toBeLessThan(42);
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByRole("combobox", { name: "Юнит: u4 и ещё 1" })).toBeInTheDocument();
    expect(comboboxValueText([], units)).toBe("все");
  });
});

describe("menu", () => {
  test("opens from its trigger by keyboard; a copy item goes through the copy helper", async () => {
    const open = vi.fn();
    const user = userEvent.setup();
    // After setup: user-event installs a clipboard of its own.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderUi(
      <Menu label="Действия с находкой" groups={[[{ label: "Открыть отчёт", onSelect: open }], [copyItem("ссылку", "p1-review-craft#craft-3"), { label: "Скопировать место", onSelect: () => {}, blocked: "Критик не указал файл и строку находки" }]]}>
        <Button>Действия</Button>
      </Menu>,
    );
    screen.getByRole("button", { name: "Действия" }).focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Открыть отчёт", "Скопировать ссылку", "Скопировать место"]);
    expect(within(menu).getByRole("menuitem", { name: "Скопировать место" })).toHaveAttribute("aria-disabled", "true");
    for (let i = 0; i < 3 && document.activeElement?.textContent !== "Скопировать ссылку"; i++) await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toHaveTextContent("Скопировать ссылку");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("p1-review-craft#craft-3"));
    expect(await screen.findByText("Скопировано: ссылку")).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });
});

describe("Kbd", () => {
  test("a key is named from its physical code", () => {
    expect(keyLabel("Slash")).toBe("/");
    expect(keyLabel("KeyK")).toBe("K");
    expect(keyLabel("Escape")).toBe("Esc");
    expect(keyLabel("ArrowLeft")).toBe("←");
    const { container } = render(<Keys codes={["ArrowLeft", "ArrowRight"]} />);
    expect([...container.querySelectorAll('[data-slot="kbd"]')].map((k) => k.textContent)).toEqual(["←", "→"]);
  });
});
