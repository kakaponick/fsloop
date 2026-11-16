// A part that failed (rules/ui → Conventions 14): a file of the run folder that cannot be read fails in its own
// place — «<Что> не прочитан: <причина>» — and the rest of the run shows. «Повторить» stands only where a retry can
// change the result: the caller passes `onRetry` only then.
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dot } from "./status-dot.tsx";

export type Gender = "m" | "f" | "n";

const NOT_READ: Record<Gender, string> = { m: "не прочитан", f: "не прочитана", n: "не прочитано" };

/** «Отчёт critique-3.md не прочитан: нет доступа»; `gender` agrees the verb with `what`. */
export const partFailedText = (what: string, cause: string, gender: Gender = "m"): string => `${what} ${NOT_READ[gender]}: ${cause}`;

export const RETRY = "Повторить";

export interface PartFailedProps {
  /** What failed, as a sentence starts: «Отчёт critique-3.md», «Список юнитов». */
  what: string;
  cause: string;
  gender?: Gender;
  onRetry?: () => void;
  className?: string;
}

export function PartFailed({ what, cause, gender = "m", onRetry, className }: PartFailedProps) {
  return (
    <Alert data-slot="part-failed" className={cn("flex w-fit max-w-full items-center gap-3", className)}>
      <Dot tone="warning" />
      <AlertDescription className="min-w-0 text-foreground">{partFailedText(what, cause, gender)}</AlertDescription>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {RETRY}
        </Button>
      )}
    </Alert>
  );
}
