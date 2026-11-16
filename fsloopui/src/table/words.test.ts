// The table's built strings (rules/ui → Copy 3–4): each function called with the widest real input, compared with a
// literal, with its word count.
import { describe, expect, test } from "vitest";
import { NOUNS } from "../../shared/text.ts";
import { filterSummary } from "./filters.tsx";
import { menuHeader } from "./row-menu.tsx";
import { ageText, ofTotal, selectedText, shownText } from "./status-bar.tsx";

/** Words split on plain spaces: a number grouped by no-break spaces is one word. */
const words = (s: string) => s.split(" ").length;
/** The no-break space that groups a number's digits. */
const NBSP = String.fromCharCode(0xa0);

describe("«<shown> из <total noun>»", () => {
  test("after «из» the noun is genitive: singular after a number ending in 1, plural otherwise", () => {
    expect(shownText(128, 723, NOUNS.finding)).toBe("128 из 723 находок");
    expect(shownText(6, 61, NOUNS.finding)).toBe("6 из 61 находки");
    expect(shownText(3, 11, NOUNS.finding)).toBe("3 из 11 находок");
    expect(shownText(14, 42, NOUNS.unit)).toBe("14 из 42 юнитов");
    expect(ofTotal(21, NOUNS.launch)).toBe("из 21 запуска агента");
    expect(words(shownText(12_345, 55_555, NOUNS.finding))).toBe(4);
    expect(shownText(12_345, 55_555, NOUNS.finding)).toBe(`12${NBSP}345 из 55${NBSP}555 находок`);
  });

  test("all the rows: the count with its noun, nothing repeated", () => {
    expect(shownText(723, 723, NOUNS.finding)).toBe("723 находки");
    expect(shownText(42, 42, NOUNS.unit)).toBe("42 юнита");
    expect(shownText(0, 0, NOUNS.unit)).toBe("0 юнитов");
  });
});

test("the selection: «Выбрано N <noun>», the verb agreed with the number and the noun's gender", () => {
  expect(selectedText(1, { forms: NOUNS.finding, gender: "f" })).toBe("Выбрана 1 находка");
  expect(selectedText(21, { forms: NOUNS.finding, gender: "f" })).toBe("Выбрана 21 находка");
  expect(selectedText(3, { forms: NOUNS.finding, gender: "f" })).toBe("Выбрано 3 находки");
  expect(selectedText(11, { forms: NOUNS.finding, gender: "f" })).toBe("Выбрано 11 находок");
  expect(selectedText(723, { forms: NOUNS.finding, gender: "f" })).toBe("Выбрано 723 находки");
  expect(selectedText(1, { forms: NOUNS.unit, gender: "m" })).toBe("Выбран 1 юнит");
  expect(selectedText(42, { forms: NOUNS.unit, gender: "m" })).toBe("Выбрано 42 юнита");
  expect(words(selectedText(12_345, { forms: NOUNS.finding, gender: "f" }))).toBe(3);
  expect(selectedText(12_345, { forms: NOUNS.finding, gender: "f" })).toBe(`Выбрано 12${NBSP}345 находок`);
});

test("the data's age: «обновлено <compact past>»", () => {
  expect(ageText("2026-11-14T04:00:00Z", "2026-11-16T07:00:00Z")).toBe("обновлено 2 д назад");
  expect(ageText("2026-11-16T06:59:30Z", "2026-11-16T07:00:00Z")).toBe("обновлено меньше минуты назад");
  expect(words(ageText("2026-11-16T06:59:30Z", "2026-11-16T07:00:00Z"))).toBe(4);
});

test("the row menu's header: the row, the selection's count, or what the data still holds", () => {
  expect(menuHeader(["p1-review-critic-craft#craft-12 The row wraps"], 1, NOUNS.finding)).toBe("p1-review-critic-craft#craft-12 The row wraps");
  expect(menuHeader(["a", "b", "c"], 3, NOUNS.finding)).toBe("3 находки");
  expect(menuHeader(Array.from({ length: 28 }, (_, i) => String(i)), 30, NOUNS.finding)).toBe("28 из 30 находок");
  expect(menuHeader(Array.from({ length: 700 }, (_, i) => String(i)), 721, NOUNS.finding)).toBe("700 из 721 находки");
});

test("the filtered-to-none summary names each active filter by its labels, then the search", () => {
  const defs = [
    { id: "severity", label: "Серьёзность", values: () => [], options: [{ value: "major", label: "major" }, { value: "critical", label: "critical" }] },
    { id: "unit", label: "Юнит", values: () => [], options: [] },
  ];
  expect(filterSummary(defs, { severity: ["major", "critical"], unit: ["u3"], gone: [] }, "  row menu ")).toEqual(["Серьёзность: major, critical", "Юнит: u3", "Поиск: «row menu»"]);
  expect(filterSummary(defs, {}, "")).toEqual([]);
});
