// @vitest-environment jsdom
import "./test-setup.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NOUNS } from "../../shared/text.ts";
import { EmptyState, emptyStateText } from "./empty-state.tsx";
import { Loading } from "./loading.tsx";
import { PartFailed, partFailedText } from "./part-failed.tsx";

describe("loading", () => {
  test("«Загрузка…» with a spinner, centred in the region it fills, as a status", () => {
    render(<Loading />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Загрузка…");
    expect(status).toHaveClass("flex", "items-center", "justify-center", "size-full");
    expect(status.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  test("a table's first load is framed over the whole region", () => {
    render(<Loading framed />);
    expect(screen.getByRole("status")).toHaveClass("border", "rounded-lg", "size-full");
  });

  test("no part of the product imports the library's skeleton (rules/ui → Strict 2)", () => {
    for (const file of ["loading.tsx", "empty-state.tsx", "index.ts"]) {
      const text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
      expect(text).not.toMatch(/components\/ui\/skeleton|Skeleton/);
    }
  });
});

describe("empty state", () => {
  test("not yet names what fills the view and the stage from the shared map", () => {
    expect(emptyStateText({ form: "not-yet", noun: NOUNS.unit, step: "decompose" }).title).toBe("Юнитов ещё нет — они появятся на этапе «декомпозиция»");
    expect(emptyStateText({ form: "not-yet", noun: NOUNS.finding, step: "review", lead: "Критики ещё не писали отчётов", subject: "находки" }).title).toBe(
      "Критики ещё не писали отчётов — находки появятся на этапе «ревью»",
    );
    expect(emptyStateText({ form: "not-yet", noun: NOUNS.convention, step: "decompose" }).title.split(" ")).toHaveLength(9);
  });

  test("never: a run past the stage had none", () => {
    render(<EmptyState form="never" noun={NOUNS.finding} />);
    expect(screen.getByText("В этом прогоне не было находок")).toBeInTheDocument();
  });

  test("filtered to none names the active filters and offers «Сбросить фильтры»", async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();
    render(<EmptyState form="filtered" noun={NOUNS.finding} filters={["Серьёзность: major и выше", "Юнит: u3", "Поиск: «toast»"]} onReset={onReset} />);
    expect(screen.getByText("Нет находок, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Серьёзность: major и выше · Юнит: u3 · Поиск: «toast»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("a part that failed", () => {
  test("names what failed and why, in its place", () => {
    expect(partFailedText("Отчёт critique-3.md", "файл занят другим процессом")).toBe("Отчёт critique-3.md не прочитан: файл занят другим процессом");
    expect(partFailedText("Папка прогона", "нет доступа", "f")).toBe("Папка прогона не прочитана: нет доступа");
    render(<PartFailed what="Список юнитов" cause="units.md не разобран" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Список юнитов не прочитан: units.md не разобран");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("«Повторить» stands only where a retry is given", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<PartFailed what="Прогон 00558d48" cause="EBUSY" onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
