// The choice toggles (DESIGN.md → Choice Toggles; ui → Tooltip; rules/ui → Conventions 11): one small set of words to
// pick one of — the user's verdict, a report's severity filter — as the library's outline toggle group, one Tab stop,
// ←/→ between the choices. The pressed item is ink on paper. It is keyed on the item's own `aria-checked`, never on
// `data-state`: a tooltip trigger writes its own `data-state` over the item it wraps, which would undo the ink. A
// choice with a key shows its cap in that toggle's own tooltip, opened by its own hover and focus — the tooltip's
// words the group's `keyHint`, a verb and its object («Оценить клавишей»). The tooltip opens below the toggles: what
// stands above them — a heading and the line the choice answers («Ваша оценка», «Оценки ещё нет — …») — stays in
// view while the hint is read (craft-5) — the shared `Hint`, on its `bottom` side.
import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Hint } from "./tooltip.tsx";

export interface Choice<V extends string> {
  value: V;
  label: ReactNode;
  /** The physical key that makes this choice (`event.code`), shown as its cap in the toggle's tooltip. */
  keyCode?: string;
}

export interface ChoiceTogglesProps<V extends string> {
  /** The group's name for a screen reader: what is chosen. */
  label: string;
  /** The pressed choice; null when none is. */
  value: V | null;
  choices: readonly Choice<V>[];
  /** Every press, the pressed choice's own included: choosing it again is a choice too (a verdict saves its note). */
  onChoose: (value: V) => void;
  /** The tooltip's words before a choice's key cap; the choices with a key take it. */
  keyHint?: string;
  className?: string;
}

/** Ink on paper for the pressed item, its hover included. The library's own pressed fill — a faint muted on
 * `data-[state=on]`, a rule that comes after the `aria-checked` ones — is replaced by the same ink, so an item no
 * tooltip wraps reads as one that a tooltip does. */
const PRESSED =
  "aria-checked:bg-foreground aria-checked:text-background aria-checked:hover:bg-foreground aria-checked:hover:text-background data-[state=on]:bg-foreground data-[state=on]:text-background";

export function ChoiceToggles<V extends string>({ label, value, choices, onChoose, keyHint, className }: ChoiceTogglesProps<V>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      aria-label={label}
      value={value ?? ""}
      // a single group clears its value when the pressed item is pressed again: that press is a choice of it
      onValueChange={(v) => {
        const chosen = (v || value) as V | null;
        if (chosen) onChoose(chosen);
      }}
      className={cn("flex-wrap", className)}
    >
      {choices.map((c) => {
        const item = (
          <ToggleGroupItem key={c.value} value={c.value} className={cn("px-2.5 font-normal", PRESSED)}>
            {c.label}
          </ToggleGroupItem>
        );
        return c.keyCode && keyHint ? (
          <Hint key={c.value} label={keyHint} keys={[c.keyCode]} side="bottom">
            {item}
          </Hint>
        ) : (
          item
        );
      })}
    </ToggleGroup>
  );
}
