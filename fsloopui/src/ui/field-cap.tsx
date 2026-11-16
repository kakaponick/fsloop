// The in-field cap of a key that focuses a field (the design check of pass 3: a key's cap; rules/ui → Conventions 11):
// the key's `Kbd` cap at the field's end, inside it — the table's search «/», the journal's jump field «G». The part
// binds the key (by its physical code, through the one shortcut hook) to focus the field, and steps aside while the
// field is focused or filled: hidden and unread, its box kept, so nothing in the field moves (rules/ui → Strict 1).
// One part, so a change to the cap — its words, its accessible name — reaches every field that has one (code-3).
import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { Keys } from "./kbd.tsx";
import { useShortcut } from "./use-shortcut.ts";

export interface FieldCapProps {
  /** The field the key focuses. */
  field: RefObject<HTMLInputElement | null>;
  /** The key's physical code: «Slash», «KeyG». */
  code: string;
  /** The field holds text: the cap stays aside after the field is left. */
  filled: boolean;
  /** Off: the key is not bound and no cap is drawn — a search the key does not focus says nothing of it (ux 0). */
  enabled?: boolean;
}

export function FieldCap({ field, code, filled, enabled = true }: FieldCapProps) {
  const [focused, setFocused] = useState(false);
  useShortcut(code, () => field.current?.focus(), { enabled });
  useEffect(() => {
    const el = field.current;
    if (!el || !enabled) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    el.addEventListener("focus", on);
    el.addEventListener("blur", off);
    return () => {
      el.removeEventListener("focus", on);
      el.removeEventListener("blur", off);
    };
  }, [field, enabled]);
  if (!enabled) return null;
  const aside = focused || filled;
  return (
    <span data-slot="field-cap" aria-hidden={aside || undefined} className={cn(aside && "invisible")}>
      <Keys codes={[code]} />
    </span>
  );
}
