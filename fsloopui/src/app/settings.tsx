// The run's settings as one wrapping line — «worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5» — on
// the card and on the page alike. A part never breaks inside (an identifier stays whole), and the « ·» after it
// stays with it in its unbreakable span: a line may end on a separator, never open on one (craft-11).
import { Fragment } from "react";
import type { RunCard } from "../../shared/model.ts";
import { cn } from "@/lib/utils";
import { settingsParts } from "./words.ts";

export function SettingsParts({ card, mono = "font-mono" }: { card: Pick<RunCard, "mode" | "N" | "K" | "models" | "mirror">; /** The face of an identifier. */ mono?: string }) {
  const parts = settingsParts(card);
  return parts.map((p, i) => (
    <Fragment key={`${i}-${p.text}`}>
      {i > 0 && " "}
      <span data-slot="setting" className="whitespace-nowrap">
        <span className={cn(p.mono && mono)}>{p.text}</span>
        {i < parts.length - 1 && " ·"}
      </span>
    </Fragment>
  ));
}
