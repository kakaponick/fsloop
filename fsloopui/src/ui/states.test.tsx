// @vitest-environment jsdom
import "./test-setup.ts";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { RUN_FOLDER } from "../../shared/model.ts";
import { STEPS } from "../../shared/states.ts";
import { NOUNS } from "../../shared/text.ts";
import { applyStylesheet } from "../app/layout-testing.ts";
import { MissingLine, missingText } from "./absent.tsx";
import { EmptyState, emptyStateText, emptyWhen } from "./empty-state.tsx";
import { baseName, fileFailure, folderFailure } from "./failure.ts";
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

  test("no part of the product imports the library's skeleton (rules/ui → Strict 2): a walk over src/", () => {
    const src = resolve(__dirname, "..");
    const files: string[] = [];
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          // the library's own source holds the component; the product never reaches for it
          if (relative(src, p).replace(/\\/g, "/") !== "components/ui") walk(p);
        } else if (/\.(tsx?|css)$/.test(name)) {
          files.push(p);
          if (readFileSync(p, "utf8").includes(["components", "ui", "skeleton"].join("/"))) hits.push(relative(src, p));
        }
      }
    };
    walk(src);
    // the walk reaches every folder of the product, not three files of one
    expect(files.length).toBeGreaterThan(100);
    const tops = new Set(files.map((f) => relative(src, f).split(/[\\/]/)[0]));
    for (const top of ["app", "finding", "kit", "styles", "table", "ui", "views"]) expect(tops.has(top), top).toBe(true);
    expect(hits).toEqual([]);
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

  test("one rule for every view: closed or init — never; else not yet, naming the stage; a once-a-pass list past its stage — never", () => {
    const at = (stage: string | null) => ({ closed: false, mode: "worktree", now: stage === null ? null : { stage } });
    expect(emptyWhen({ closed: true, mode: "worktree", now: null }, "review")).toEqual({ form: "never" });
    expect(emptyWhen({ closed: false, mode: "init", now: null }, "review")).toEqual({ form: "never" });
    expect(emptyWhen({ closed: false, mode: "worktree" }, "map")).toEqual({ form: "not-yet", step: "map" });
    // a list every stage after its own may still fill (decisions, reports): past it, still to come
    expect(emptyWhen(at("p1-review"), "map")).toEqual({ form: "not-yet", step: "map" });
    expect(emptyWhen(at(null), "decompose", { once: true })).toEqual({ form: "not-yet", step: "decompose" });
    expect(emptyWhen(at("p1-map"), "decompose", { once: true })).toEqual({ form: "not-yet", step: "decompose" });
    expect(emptyWhen(at("p1-decompose"), "decompose", { once: true })).toEqual({ form: "not-yet", step: "decompose" });
    expect(emptyWhen(at("p1-review"), "decompose", { once: true })).toEqual({ form: "never" });
    expect(emptyWhen({ closed: true, mode: "worktree", now: null }, "decompose", { once: true })).toEqual({ form: "never" });
    // the stage order, exported once: the shared map's keys in a pass's order
    expect(STEPS).toEqual(["init", "map", "spike", "decompose", "units", "review", "fix", "verdict", "assess", "integrate", "finish"]);
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

  test("improve-4 (2), design-1: a named view filtered to none names the view and what fills it (rules/ui → Conventions 16), then the search and «Сбросить фильтры»", async () => {
    const onReset = vi.fn();
    const named = { form: "filtered", noun: NOUNS.unit, filters: ["Поиск: «zzz»"], view: { label: "Заблокированы", fills: "заблокирован" }, onReset } as const;
    expect(emptyStateText(named)).toEqual({ title: "В виде «Заблокированы» нет юнитов", description: "В вид входят: заблокирован. Фильтры: Поиск: «zzz»" });
    expect(emptyStateText({ ...named, noun: NOUNS.finding, filters: [], view: { label: "С возражением", fills: "не согласен, не та серьёзность, ложная находка" } })).toEqual({
      title: "В виде «С возражением» нет находок",
      description: "В вид входят: не согласен, не та серьёзность, ложная находка",
    });
    render(<EmptyState {...named} />);
    expect(screen.getByText("В виде «Заблокированы» нет юнитов")).toBeInTheDocument();
    expect(screen.getByText("В вид входят: заблокирован. Фильтры: Поиск: «zzz»")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Сбросить фильтры" }));
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

  test("gap 9 (f15): what a reading view could not read — a file by the end of its path, the run folder only behind a live parse — from the shared layer", () => {
    const errors = [
      { file: "C:\\runs\\a5\\reports\\p1-decompose-design-check.md", cause: "EBUSY" },
      { file: RUN_FOLDER, cause: "нет run.json" },
    ];
    expect(fileFailure({ errors }, "reports/p1-decompose-design-check.md")).toEqual(errors[0]);
    expect(fileFailure({ errors }, "journal.md")).toBeNull();
    expect(folderFailure({ errors, source: "live" })).toEqual(errors[1]);
    expect(folderFailure({ errors, source: "record" })).toBeNull();
    expect(baseName("reports\\p1-decompose-design-check.md")).toBe("p1-decompose-design-check.md");
    expect(baseName("journal.md")).toBe("journal.md");
  });
});

describe("gap 13 (f8, f10, f14): no re-export kept for an importer that has moved", () => {
  test("the stage order comes from shared/states.ts alone; a frame's address from @/api alone", async () => {
    expect("STEPS" in (await import("./index.ts"))).toBe(false);
    expect("STEPS" in (await import("./empty-state.tsx"))).toBe(false);
    expect("frameSrc" in (await import("../finding/article.tsx"))).toBe(false);
    expect("frameSrc" in (await import("../finding/index.ts"))).toBe(false);
  });

  test("u14 (the leftovers of u4, u9, u11): a finding's words keep no key hint and no «Свернуть все» of their own — the toggle's tooltip and the kit hold them", async () => {
    const words = await import("../finding/words.ts");
    expect("KEY_HINT" in words).toBe(false);
    expect("COLLAPSE_ALL" in words).toBe(false);
    expect("findingNotFound" in words).toBe(false);
    expect("NOT_FOUND_NEXT" in words).toBe(false);
  });
});

/** Words as a reader counts them: split on spaces. */
const wordCount = (s: string) => s.split(" ").length;

describe("p2-assess-critic-improve#improve-13: one not-found line on all four surfaces — what the run holds, by the kind's own form", () => {
  test("a finding the run lacks: the run's count of findings, agreed", () => {
    expect(missingText({ kind: "finding", count: 723 }, "x#none-1")).toBe("Находка x#none-1 не найдена: в этом прогоне 723 находки.");
    expect(wordCount(missingText({ kind: "finding", count: 723 }, "x#none-1"))).toBe(9);
    expect(missingText({ kind: "finding", count: 1 }, "p1-review-critic-code#code-999")).toBe("Находка p1-review-critic-code#code-999 не найдена: в этом прогоне 1 находка.");
    expect(missingText({ kind: "finding", count: 130 }, "a#b")).toBe("Находка a#b не найдена: в этом прогоне 130 находок.");
    expect(missingText({ kind: "finding", count: 0 }, "a#b")).toBe("Находка a#b не найдена.");
  });

  test("a unit the run lacks: a range per prefix, in the run's order", () => {
    const ids = [...Array.from({ length: 32 }, (_, k) => `u${k + 1}`), ...Array.from({ length: 10 }, (_, k) => `f${k + 1}`)];
    expect(missingText({ kind: "unit", ids }, "u99")).toBe("Юнит u99 не найден: в этом прогоне юниты u1–u32, f1–f10.");
    expect(wordCount(missingText({ kind: "unit", ids }, "u99"))).toBe(10);
    expect(missingText({ kind: "unit", ids: ["u1"] }, "u99")).toBe("Юнит u99 не найден: в этом прогоне юнит u1.");
    expect(missingText({ kind: "unit", ids: ["u3", "u1", "f2", "fix-a"] }, "u9")).toBe("Юнит u9 не найден: в этом прогоне юниты u1–u3, f2, fix-a.");
    expect(missingText({ kind: "unit", ids: [] }, "u9")).toBe("Юнит u9 не найден.");
    // the numbered lists keep their range: one builder per kind
    expect(missingText({ kind: "entry", range: ["1", "143"] }, "999")).toBe("Решение #999 не найдено: в этом прогоне решения #1–#143.");
  });

  test("MissingLine: one line — the sentence truncates with the whole in its title, «Закрыть» keeps its box", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MissingLine kind="finding" id="x#none-1" count={723} onClose={onClose} slot="finding-missing" />);
    const line = document.querySelector("[data-slot=finding-missing]") as HTMLElement;
    expect(line).toHaveAttribute("role", "status");
    expect(line).toHaveTextContent(/^Находка x#none-1 не найдена: в этом прогоне 723 находки\.\s*Закрыть$/);
    const sentence = line.querySelector("[data-slot=missing-sentence]") as HTMLElement;
    expect(sentence).toHaveAttribute("title", "Находка x#none-1 не найдена: в этом прогоне 723 находки.");
    await applyStylesheet();
    expect(getComputedStyle(line).flexWrap).not.toBe("wrap");
    expect(getComputedStyle(sentence).textOverflow).toBe("ellipsis");
    expect(getComputedStyle(sentence).minWidth).toBe("0px");
    const close = screen.getByRole("button", { name: "Закрыть" });
    expect(getComputedStyle(close).flexShrink).toBe("0");
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
