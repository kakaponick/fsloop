// @vitest-environment jsdom
// improve-2 (p2-assess-critic-improve), design-10 (p3-decompose-design-check): one shared toggle group — the verdict
// control and a report's severity filter — whose pressed item is ink, keyed on the item's own `aria-checked` so a
// tooltip around it cannot undo it; a choice's key cap in a tooltip that opens on that toggle's own hover and focus.
import "./test-setup.ts";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { applyStylesheet } from "../app/layout-testing.ts";
import { ChoiceToggles, type Choice } from "./choice-toggles.tsx";
import { renderUi } from "./test-utils.tsx";

const VERDICTS: Choice<string>[] = [
  { value: "agree", label: "согласен", keyCode: "Digit1" },
  { value: "disagree", label: "не согласен", keyCode: "Digit2" },
  { value: "wrong-severity", label: "не та серьёзность", keyCode: "Digit3" },
  { value: "false-positive", label: "ложная находка", keyCode: "Digit4" },
];
const SEVERITIES: Choice<string>[] = [
  { value: "all", label: "все" },
  { value: "critical", label: "critical" },
  { value: "major", label: "major" },
];

function Host({ choices, first, hint, onChoose }: { choices: Choice<string>[]; first: string | null; hint?: string; onChoose?: (v: string) => void }) {
  const [value, setValue] = useState(first);
  return (
    <ChoiceToggles
      label="Ваша оценка"
      value={value}
      choices={choices}
      keyHint={hint}
      onChoose={(v) => {
        setValue(v);
        onChoose?.(v);
      }}
    />
  );
}

describe("improve-2: the shared choice toggles", () => {
  test("improve-2 (1), design-10: the pressed item is ink on paper — with a key tooltip around every item, and without one", async () => {
    for (const [choices, hint] of [
      [VERDICTS, "Оценить клавишей"],
      [SEVERITIES, undefined],
    ] as const) {
      const view = renderUi(<Host choices={[...choices]} first={choices[1].value} hint={hint} />);
      const radios = screen.getAllByRole("radio");
      expect(radios[1]).toHaveAttribute("aria-checked", "true");
      await applyStylesheet();
      // DESIGN.md → Colors, light: ink #1b1b1a, paper #fbfbfa — the pressed item; the others keep the page's ground
      expect(getComputedStyle(radios[1]).backgroundColor).toBe("rgb(27, 27, 26)");
      expect(getComputedStyle(radios[1]).color).toBe("rgb(251, 251, 250)");
      expect(getComputedStyle(radios[0]).backgroundColor).not.toBe("rgb(27, 27, 26)");
      view.unmount();
    }
  });

  test("improve-2 (2), design-10: each toggle's key cap opens in its own tooltip on its focus — «Оценить клавишей» and the cap", async () => {
    const user = userEvent.setup();
    renderUi(<Host choices={VERDICTS} first="disagree" hint="Оценить клавишей" />);
    // Tab lands on the pressed item, the group's one stop
    await user.tab();
    expect(screen.getByRole("radio", { name: "не согласен" })).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Оценить клавишей2$/);
    // ← moves to the previous toggle: its own tooltip, its own cap
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "согласен" })).toHaveFocus();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent(/^Оценить клавишей1$/);
    expect(within(tip).getByText("1")).toHaveAttribute("data-slot", "kbd");
  });

  test("improve-2 (2): a toggle's tooltip opens on its own hover; a group without keys has none", async () => {
    const user = userEvent.setup();
    const view = renderUi(<Host choices={VERDICTS} first={null} hint="Оценить клавишей" />);
    await user.hover(screen.getByRole("radio", { name: "ложная находка" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Оценить клавишей4$/);
    view.unmount();
    renderUi(<Host choices={SEVERITIES} first="all" />);
    await user.tab();
    await user.hover(screen.getByRole("radio", { name: "major" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  test("a choice reports itself — the pressed one too, which a single group would otherwise clear", async () => {
    const user = userEvent.setup();
    const chosen = vi.fn();
    renderUi(<Host choices={VERDICTS} first="agree" hint="Оценить клавишей" onChoose={chosen} />);
    await user.click(screen.getByRole("radio", { name: "согласен" }));
    await user.click(screen.getByRole("radio", { name: "ложная находка" }));
    expect(chosen.mock.calls).toEqual([["agree"], ["false-positive"]]);
    expect(screen.getByRole("radio", { name: "ложная находка" })).toHaveAttribute("aria-checked", "true");
  });
});
