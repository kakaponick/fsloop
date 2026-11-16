// A clamped text (rules/ui → Layout 6): cut to a few lines, with «развернуть» only when the clamp actually hides
// something — otherwise it is plain text. The trigger sits over the end of the last line, so its arrival never
// changes the box (Strict 1). Expanded, the text lives in a region with a height cap that scrolls inside.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINES = { 1: "line-clamp-1", 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" } as const;

export interface ClampProps {
  children: ReactNode;
  lines?: keyof typeof LINES;
  /** Off for a card: the clamp stays and the full text is on the page the card opens (shell → Card goal). */
  expandable?: boolean;
  /** What the text is, for the trigger's name: «цель прогона». */
  what: string;
  className?: string;
}

export const EXPAND = "развернуть";
export const COLLAPSE = "свернуть";

export function Clamp({ children, lines = 2, expandable = true, what, className }: ClampProps) {
  const box = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const collapseButton = useRef<HTMLButtonElement>(null);
  const [hides, setHides] = useState(false);
  const [open, setOpen] = useState(false);
  const toggled = useRef(false);

  useEffect(() => {
    const el = box.current;
    if (!el || open || !expandable) return;
    // A ResizeObserver reports the box once on observe, before the first paint, and on every resize after it.
    const observer = new ResizeObserver(() => setHides(el.scrollHeight > el.clientHeight + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, expandable, children]);

  useEffect(() => {
    if (!toggled.current) return;
    (open ? collapseButton : expandButton).current?.focus();
  }, [open]);

  const toggle = (next: boolean) => {
    toggled.current = true;
    setOpen(next);
  };

  if (open)
    return (
      <div data-slot="clamp" data-state="open" className={cn("flex flex-col items-start gap-1", className)}>
        <div role="region" aria-label={what} tabIndex={0} className="max-h-text-cap w-full overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </div>
        <Button ref={collapseButton} variant="link" size="xs" className="h-auto px-0 text-muted-foreground" aria-expanded="true" aria-label={`Свернуть ${what}`} onClick={() => toggle(false)}>
          {COLLAPSE}
        </Button>
      </div>
    );

  return (
    <div data-slot="clamp" data-state="closed" className={cn("relative", className)}>
      <div ref={box} className={LINES[lines]}>
        {children}
      </div>
      {expandable && hides && (
        <span className="absolute right-0 bottom-0 flex items-baseline bg-background pl-1">
          <span aria-hidden="true">…&nbsp;</span>
          <Button ref={expandButton} variant="link" size="xs" className="h-auto px-0 text-muted-foreground" aria-expanded="false" aria-label={`Развернуть ${what}`} onClick={() => toggle(true)}>
            {EXPAND}
          </Button>
        </span>
      )}
    </div>
  );
}
