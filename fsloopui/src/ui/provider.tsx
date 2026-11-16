// What every screen of fsloopUI stands in: one tooltip provider and one toaster.
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppToaster } from "./toast.tsx";

export function UiProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <AppToaster />
    </TooltipProvider>
  );
}
