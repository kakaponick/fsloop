// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { assertLayout, fitsRegion, headerWidth, mergeWidths } from "@/table";
import { UiProvider } from "../ui/provider.tsx";
import { FINDING_COLUMNS, TableSection, UNIT_COLUMNS } from "./table.tsx";

// 1280 px beside the 316 px sidebar
const REGION = 964;

describe("the kit's tables at the production shape (Done-criterion 4)", () => {
  test("the findings and units columns fit the 964 px region and wider; every header clears its width", () => {
    for (const columns of [FINDING_COLUMNS, UNIT_COLUMNS] as const) {
      expect(() => assertLayout(columns)).not.toThrow();
      const visible = columns.filter((c) => !c.hidden);
      expect(fitsRegion(visible, mergeWidths(columns, null), REGION)).toBe(true);
      expect(fitsRegion(visible, mergeWidths(columns, null), 1920 - 316)).toBe(true);
      for (const c of columns) if (c.width !== undefined) expect(headerWidth(c.label, { sortable: Boolean(c.rank) }), c.id).toBeLessThanOrEqual(c.width);
    }
  });

  test("723 findings at 50 a page are 15 pages; 42 units are one unsplit list with the counts strip", () => {
    const { container } = render(<TableSection />, { wrapper: UiProvider });
    const [findings, units] = [...container.querySelectorAll<HTMLElement>("[data-slot=data-table]")];
    expect(within(findings).getAllByRole("row").filter((r) => r.dataset.rowId)).toHaveLength(50);
    expect(within(findings).getByRole("navigation", { name: "Страницы" })).toHaveTextContent("стр. 1 из 15");
    expect(within(findings).getByText("723 находки")).toBeInTheDocument();
    expect(within(units).getAllByRole("row").filter((r) => r.dataset.rowId)).toHaveLength(42);
    expect(within(units).queryByRole("navigation", { name: "Страницы" })).toBeNull();
    expect(units.querySelector("[data-slot=counts-strip]")).toHaveTextContent(/закоммичен30заблокирован1$/);
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Загрузка…")).toBe(true);
    expect(screen.getByText("Юнитов ещё нет — они появятся на этапе «декомпозиция»")).toBeInTheDocument();
  });

  test("improve-4: both tables carry the kit's «Свернуть все» at the toolbar's end, blocked while no row is open", () => {
    const { container } = render(<TableSection />, { wrapper: UiProvider });
    const [findings, units] = [...container.querySelectorAll<HTMLElement>("[data-slot=data-table]")];
    for (const [table, name] of [
      [findings, "Свернуть все находки"],
      [units, "Свернуть все юниты"],
    ] as const)
      expect(within(table.querySelector("[data-toolbar-item=facts]") as HTMLElement).getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
  });
});
