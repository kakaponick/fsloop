// A shortcut shown as `Kbd` (rules/ui → Conventions 11): shortcuts bind to the physical key, `event.code`, so the
// key is named from its code — the same cap in the Russian and the English layout.
import { Kbd, KbdGroup } from "@/components/ui/kbd";

const LABELS: Record<string, string> = {
  Slash: "/",
  Escape: "Esc",
  Enter: "Enter",
  Space: "Пробел",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Backspace: "Backspace",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
};

/** The cap of a physical key: «Slash» → «/», «KeyK» → «K», «Digit1» → «1». */
export const keyLabel = (code: string): string => LABELS[code] ?? code.replace(/^(Key|Digit|Numpad)/, "");

export function Keys({ codes }: { codes: readonly string[] }) {
  if (codes.length === 1) return <Kbd>{keyLabel(codes[0])}</Kbd>;
  return (
    <KbdGroup>
      {codes.map((code) => (
        <Kbd key={code}>{keyLabel(code)}</Kbd>
      ))}
    </KbdGroup>
  );
}
