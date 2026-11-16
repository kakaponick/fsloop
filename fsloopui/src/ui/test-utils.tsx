// Renders a part inside the provider every screen stands in (tooltips, the toaster).
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { UiProvider } from "./provider.tsx";

export const renderUi = (ui: ReactElement) => render(<UiProvider>{ui}</UiProvider>);

/** A real-sized text: `length` characters of words, its line breaks included, broken into `lines` lines; no line
 * starts or ends with a space. */
export function longText(length: number, lines = 1, word = "находка"): string {
  const budget = length - (lines - 1);
  const perLine = Math.ceil(budget / lines);
  const out: string[] = [];
  let used = 0;
  for (let l = 0; l < lines; l++) {
    const size = Math.min(perLine, budget - used);
    let line = "";
    while (line.length < size) line += (line ? " " : "") + word;
    line = line.slice(0, size);
    if (line.endsWith(" ")) line = `${line.slice(0, -1)}ы`;
    out.push(line);
    used += size;
  }
  return out.join("\n");
}
