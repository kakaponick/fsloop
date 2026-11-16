import { describe, expect, test } from "vitest";
import { ago, count, duration, mskDateTime, mskTime, NOUNS, plural, tokens } from "./text.ts";

// Words as a reader counts them: a no-break space binds a grouped number into one.
const words = (s: string) => s.split(/[ \t\n]+/).filter(Boolean).length;
const NOW = "2026-11-16T10:00:00Z"; // 13:00 МСК, 16.11.2026

describe("plural (rules/ui → Copy 3)", () => {
  test("agrees a noun with its number in the three Russian forms", () => {
    expect(count(1, NOUNS.finding)).toBe("1 находка");
    expect(count(3, NOUNS.finding)).toBe("3 находки");
    expect(count(12, NOUNS.finding)).toBe("12 находок");
    expect(count(21, NOUNS.finding)).toBe("21 находка");
    expect(count(111, NOUNS.finding)).toBe("111 находок");
    expect(count(0, NOUNS.unit)).toBe("0 юнитов");
    expect(count(2, NOUNS.unit)).toBe("2 юнита");
    expect(count(97, NOUNS.launch)).toBe("97 запусков агента");
    expect(plural(24, NOUNS.commit)).toBe("коммита");
  });

  test("groups a number of five digits and more by thousands with a no-break space", () => {
    const s = count(12345, NOUNS.finding);
    expect(s).toBe("12 345 находок");
    expect(words(s)).toBe(2);
    expect(count(8617, NOUNS.finding)).toBe("8617 находок");
  });
});

describe("duration (rules/ui → Conventions 10)", () => {
  test("the largest unit from a minute up", () => {
    expect(duration(40_000)).toBe("меньше минуты");
    expect(duration(3 * 60_000)).toBe("3 мин");
    expect(duration((2 * 60 + 5) * 60_000)).toBe("2 ч 05 мин");
    expect(duration(2 * 3_600_000)).toBe("2 ч");
    expect(duration((28 * 60 + 30) * 60_000)).toBe("1 д 4 ч");
    expect(duration(3 * 86_400_000)).toBe("3 д");
  });

  test("a compact face keeps the largest unit only", () => {
    expect(duration((3 * 60 + 25) * 60_000, { compact: true })).toBe("3 ч");
    expect(duration(12 * 60_000, { compact: true })).toBe("12 мин");
    expect(duration(25 * 86_400_000 + 3_600_000, { compact: true })).toBe("25 д");
  });

  test("a negative or missing span reads as no duration", () => {
    expect(duration(null)).toBe("—");
    expect(duration(-5)).toBe("меньше минуты");
  });
});

describe("Moscow time (rules/ui → Conventions 10)", () => {
  test("today's moment is the time with its zone", () => {
    expect(mskTime("2026-11-16T16:41:00Z", NOW)).toBe("19:41 МСК");
  });

  test("a moment off today's Moscow date carries its date, off this year the year", () => {
    expect(mskTime("2026-11-15T20:40:00Z", NOW)).toBe("15.11 23:40 МСК");
    expect(mskTime("2025-12-31T22:30:00Z", NOW)).toBe("01.01 01:30 МСК");
    expect(mskTime("2025-03-02T08:05:00Z", NOW)).toBe("02.03.2025 11:05 МСК");
  });

  test("the date moves when the conversion crosses midnight", () => {
    // 21:30 UTC on the 15th is 00:30 МСК on the 16th — today.
    expect(mskTime("2026-11-15T21:30:00Z", NOW)).toBe("00:30 МСК");
  });

  test("the full form for a title always has the date", () => {
    expect(mskDateTime("2026-11-16T02:24:15Z")).toBe("16.11.2026 05:24 МСК");
  });

  test("a past moment in a narrow place reads compact", () => {
    expect(ago("2026-11-16T09:55:00Z", NOW)).toBe("5 мин назад");
    expect(ago("2026-11-16T09:59:30Z", NOW)).toBe("меньше минуты назад");
    expect(ago("2026-11-16T06:30:00Z", NOW)).toBe("3 ч назад");
  });
});

describe("tokens of a launch", () => {
  test("a compact total with its noun, the split for a title", () => {
    const t = tokens({ input: 1200, output: 34_567, cacheWrite: 250_000, cacheRead: 1_000_000 });
    expect(t.compact).toBe("1,3 млн токенов");
    expect(t.title).toBe("вход 1200 · выход 34 567 · запись в кэш 250 000 · чтение кэша 1 000 000");
    expect(words(t.compact)).toBe(3);
  });

  test("thousands and small totals", () => {
    expect(tokens({ input: 12_400, output: 0, cacheWrite: 0, cacheRead: 0 }).compact).toBe("12 тыс. токенов");
    expect(tokens({ input: 2, output: 1, cacheWrite: 0, cacheRead: 0 }).compact).toBe("3 токена");
  });
});
