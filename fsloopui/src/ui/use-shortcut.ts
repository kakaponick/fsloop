// The shortcut hook (rules/ui → Conventions 11; ui → Keyboard): a shortcut binds to the physical key, `event.code`,
// so it works in the Russian layout. The conditions live here once, never at a screen: no shortcut fires while
// focus is in a text field, while a dialog is open, on a key repeat, or with Ctrl, Alt or ⌘ held.
import { useEffect, useRef } from "react";

const TEXT_INPUTS = new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "datetime-local", "month", "time", "week"]);

/** True when the key goes to a field the user types in. */
export function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.has(target.type);
  const role = target.getAttribute("role");
  return role === "textbox" || role === "combobox" || role === "searchbox";
}

/** True while a modal layer is open: a dialog, an alert dialog. */
export const dialogOpen = (): boolean => document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null;

export interface ShortcutOptions {
  /** Off: the shortcut is not bound. */
  enabled?: boolean;
}

/** Calls `handler` when the key with `code` is pressed under the conditions above; its default is prevented. */
export function useShortcut(code: string, handler: (event: KeyboardEvent) => void, { enabled = true }: ShortcutOptions = {}): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== code || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextField(event.target) || isTextField(document.activeElement) || dialogOpen()) return;
      event.preventDefault();
      latest.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [code, enabled]);
}
