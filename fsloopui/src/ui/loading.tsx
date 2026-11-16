// The loading state (rules/ui → Strict 2, Tables 2): the word «Загрузка…» with a spinner, centred in the region
// that loads. The region already has its final size — the part fills it and never sizes it — so what replaces it
// lands without a shift (Strict 1). Never a skeleton.
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export const LOADING_WORD = "Загрузка…";

export interface LoadingProps {
  /** A bordered frame over the whole region: a table's first load (Tables 2). */
  framed?: boolean;
  className?: string;
}

export function Loading({ framed = false, className }: LoadingProps) {
  return (
    <div
      role="status"
      data-slot="loading"
      className={cn("flex size-full min-h-[inherit] items-center justify-center gap-2 text-muted-foreground", framed && "rounded-lg border", className)}
    >
      <Spinner role="presentation" aria-hidden="true" aria-label={undefined} />
      <span>{LOADING_WORD}</span>
    </div>
  );
}
