// A button that reads as a link (DESIGN.md → Object Address; p3-verdict-critic-code-verdict-2#code-2): an action that
// stays on the page — a jump inside the report reader (its outline, «Расход токенов»), «показать все» beside a report's
// severity filter, a clamp's «развернуть» / «свернуть», «свернуть» under the run header's «Ждёт вас». The library's
// link variant, underlined at rest like every link — never on hover alone (craft-13) —, in regular weight, with no
// padding of its own, so it sits in the line of text around it; a caller sets its size and ink to that text's.
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Every link's underline, written once: a hairline in ink at 30 %, full ink on hover — the link button's, an object's
 * address, a count that links, a link in running text, the app's router links. */
export const LINK_LOOK = "underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground";

export function LinkButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button variant="link" size="xs" className={cn("h-auto px-0 font-normal", LINK_LOOK, className)} {...props} />;
}
