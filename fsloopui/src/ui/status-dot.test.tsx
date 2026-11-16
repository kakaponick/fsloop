// @vitest-environment jsdom
import "./test-setup.ts";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { LIVENESS, livenessOf } from "../../shared/liveness.ts";
import { SEVERITY, UNIT_STATE, type UnitState } from "../../shared/states.ts";
import { Dash, NotFound, NotRecorded, notFoundText } from "./absent.tsx";
import { markProps, OutOfFilter } from "./marks.tsx";
import { StatusDot } from "./status-dot.tsx";

describe("status dot", () => {
  test("its tone is the state map's, and the word stands beside the dot", () => {
    const { container } = render(<StatusDot state={SEVERITY.critical} />);
    const dot = container.querySelector('[data-slot="dot"]');
    expect(dot).toHaveAttribute("data-tone", "danger");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-destructive", "size-dot", "rounded-full");
    expect(container).toHaveTextContent("critical");
  });

  test("each tone maps to its theme token, never a raw colour", () => {
    const tones = { neutral: "bg-muted-foreground", success: "bg-success", warning: "bg-warning", danger: "bg-destructive" } as const;
    for (const [tone, cls] of Object.entries(tones)) {
      const { container, unmount } = render(<StatusDot state={{ tone: tone as keyof typeof tones, label: tone }} />);
      expect(container.querySelector('[data-slot="dot"]')).toHaveClass(cls);
      unmount();
    }
  });

  test("a cell reads «state · age · cause», cause last, one truncated line with the whole in its title", () => {
    render(<StatusDot state={UNIT_STATE.blocked} detail={["12 мин", "ждёт u2"]} truncate />);
    const text = screen.getByText("заблокирован · 12 мин · ждёт u2");
    expect(text).toHaveClass("truncate");
    expect(text.parentElement).toHaveAttribute("title", "заблокирован · 12 мин · ждёт u2");
  });

  test("a fact reads the full form; a computed value reads its label", () => {
    render(
      <>
        <StatusDot state={LIVENESS.silent} form="full" />
        <StatusDot state={livenessOf("2026-11-16T04:00:00Z", "2026-11-16T07:00:00Z")} />
      </>,
    );
    expect(screen.getByText("молчит — прогон не писал больше 30 минут")).toBeInTheDocument();
    expect(screen.getByText("молчит · 3 ч")).toBeInTheDocument();
  });

  test("42 units' dots each carry their state's word (production shape)", () => {
    const states = Object.keys(UNIT_STATE) as UnitState[];
    const { container } = render(
      <ul>
        {Array.from({ length: 42 }, (_, i) => (
          <li key={i}>
            <StatusDot state={UNIT_STATE[states[i % states.length]]} />
          </li>
        ))}
      </ul>,
    );
    const dots = container.querySelectorAll('[data-slot="status-dot"]');
    expect(dots).toHaveLength(42);
    for (const [i, dot] of [...dots].entries()) expect(dot).toHaveTextContent(UNIT_STATE[states[i % states.length]].compact);
  });
});

describe("absent parts", () => {
  test("«—» is muted and named for a screen reader", () => {
    const { container } = render(<Dash />);
    expect(container.firstChild).toHaveClass("text-muted-foreground");
    expect(container).toHaveTextContent("—нет значения");
  });

  test("«не найден» agrees with its object", () => {
    expect(notFoundText("unit", "u7")).toBe("юнит u7 не найден");
    expect(notFoundText("finding", "p1-review-craft#craft-3", { start: true })).toBe("Находка p1-review-craft#craft-3 не найдена");
    expect(notFoundText("entry", "12")).toBe("запись журнала 12 не найдена");
    const { container } = render(<NotFound kind="report" id="p1-map-map" start />);
    expect(container).toHaveTextContent("Отчёт p1-map-map не найден");
    expect(container.querySelector(".font-mono")).toHaveTextContent("p1-map-map");
  });

  test("«не записано» stands with a neutral dot, never a guessed value", () => {
    const { container } = render(<NotRecorded cause="в папке нет run.json" />);
    expect(container.querySelector('[data-slot="dot"]')).toHaveAttribute("data-tone", "neutral");
    expect(container).toHaveTextContent("не записано: в папке нет run.json");
  });
});

describe("change marks", () => {
  test("the edge mark and the target mark differ, neither in a signal tone, both inside the row's box", () => {
    const edge = markProps({ edge: true }).className;
    const target = markProps({ target: true }).className;
    expect(edge).toBe("shadow-edge");
    expect(target).toBe("bg-muted shadow-target");
    expect(edge).not.toBe(target);
    for (const cls of [edge, target]) expect(cls).not.toMatch(/warning|success|destructive|info|border-l/);
    expect(markProps({}).className).toBe("");
    expect(markProps({ edge: true, target: true })["data-target"]).toBe("");
  });

  test("«вне фильтра» is plain muted text", () => {
    const { container } = render(<OutOfFilter />);
    expect(container.firstChild).toHaveTextContent("вне фильтра");
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });
});
