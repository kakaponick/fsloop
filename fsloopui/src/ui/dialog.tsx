// The dialog (ui → Dialogs return focus, A dialog fits its viewport; ux 7): one layer, a title always, the body
// scrolling inside a height cap, the footer's actions at content width on the right. Escape, ✕ and the overlay
// close it, and focus returns to its opener — the trigger, or the element `returnFocus` names.
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Hint } from "./tooltip.tsx";

export interface AppDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element that opens it; focus returns to it on close. */
  trigger?: ReactNode;
  /** The title asks or names the task: «Оценка для 12 находок». */
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** The actions, at content width, the main one last. */
  footer?: ReactNode;
  /** Where focus lands on close when no trigger opened it. */
  returnFocus?: () => HTMLElement | null | undefined;
  className?: string;
}

export function AppDialog({ open, onOpenChange, trigger, title, description, children, footer, returnFocus, className }: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        showCloseButton={false}
        className={cn("flex max-h-dialog-cap flex-col gap-3", className)}
        onCloseAutoFocus={(event) => {
          const target = returnFocus?.();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        {children && <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 [scrollbar-gutter:stable]">{children}</div>}
        {footer && <DialogFooter>{footer}</DialogFooter>}
        {/* Last in the focus order: the first focus lands on the dialog's own content, not on ✕ and its tooltip. */}
        <Hint label="Закрыть" keys={["Escape"]}>
          <DialogClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Закрыть" className="absolute top-2 right-2">
              <XIcon />
            </Button>
          </DialogClose>
        </Hint>
      </DialogContent>
    </Dialog>
  );
}
