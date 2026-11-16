// The toast (ui → Toast; rules/ui → Conventions 6) reports the result of the user's own action: a title of at most
// 60 characters, at most one action. Success leaves on its own; a failure stays until closed. An event the user
// did not start is never a toast. The copy helper copies, then says «Скопировано: <что>» (the design check).
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const TOAST_MAX_TITLE = 60;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** A title over the bound is cut with «…»: a caller's long value (a path, a cause) never stretches the toast. */
export const toastTitle = (title: string): string => (title.length > TOAST_MAX_TITLE ? `${title.slice(0, TOAST_MAX_TITLE - 1)}…` : title);
const bounded = toastTitle;

export const notify = {
  /** A success: leaves on its own. */
  success: (title: string) => toast.success(bounded(title)),
  /** A failure: stays until closed; the cause goes under the title, the action (Повторить) beside it. */
  error: (title: string, { cause, action }: { cause?: string; action?: ToastAction } = {}) =>
    toast.error(bounded(title), { description: cause, duration: Number.POSITIVE_INFINITY, closeButton: true, action }),
};

/** Copies a value — a selection joined by newlines — then raises «Скопировано: <что>»; a refusal says why. */
export async function copyText(value: string | readonly string[], what: string): Promise<boolean> {
  const text = typeof value === "string" ? value : value.join("\n");
  try {
    if (!navigator.clipboard) throw new DOMException("clipboard", "NotAllowedError");
    await navigator.clipboard.writeText(text);
    notify.success(`Скопировано: ${what}`);
    return true;
  } catch (error) {
    notify.error(`Не скопировано: ${what}`, { cause: copyCause(error) });
    return false;
  }
}

/** Why a copy failed, in the user's words: the browser's refusal is named; any other cause is shown as written. */
function copyCause(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "браузер не дал доступа к буферу обмена — скопируйте ещё раз, когда вкладка в фокусе";
  return error instanceof Error ? error.message : String(error);
}

/** The app's one toaster: bottom right, above every dialog. */
export function AppToaster() {
  return <Toaster position="bottom-right" containerAriaLabel="Уведомления" toastOptions={{ closeButtonAriaLabel: "Закрыть уведомление", classNames: { toast: "cn-toast" } }} />;
}
