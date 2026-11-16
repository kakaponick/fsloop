// A menu of actions (ui → Row actions live in the context menu; table #4): one item set, opened from a trigger
// (a dropdown) or by a right click on its area (a context menu). Items read «Открыть <объект>» and «Скопировать
// <что>» (the design check); a copy item goes through the copy helper. A shortcut shows as `Kbd`.
import type { ReactNode } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { keyLabel } from "./kbd.tsx";
import { copyText } from "./toast.tsx";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  /** Why the item cannot run now; the item stays in the menu, disabled. */
  blocked?: string;
  /** A physical key code shown at the item's end. */
  shortcut?: string;
}

/** Groups of items, separated by a rule. */
export type MenuGroups = readonly (readonly MenuItem[])[];

/** «Скопировать <что>»: copies through the helper, which raises «Скопировано: <что>». */
export const copyItem = (what: string, value: string | readonly string[]): MenuItem => ({ label: `Скопировать ${what}`, onSelect: () => void copyText(value, what) });

export interface MenuProps {
  /** The trigger: a button for a dropdown, the area itself for a context menu. */
  children: ReactNode;
  groups: MenuGroups;
  /** «dropdown» opens from the trigger, «context» by a right click or the menu key on the area. */
  kind?: "dropdown" | "context";
  label?: string;
}

export function Menu({ children, groups, kind = "dropdown", label }: MenuProps) {
  if (kind === "context")
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent aria-label={label}>
          {groups.map((group, g) => (
            <ContextMenuGroup key={g}>
              {g > 0 && <ContextMenuSeparator />}
              {group.map((item) => (
                <ContextMenuItem key={item.label} disabled={Boolean(item.blocked)} title={item.blocked} onSelect={item.onSelect}>
                  {item.label}
                  {item.shortcut && <ContextMenuShortcut>{keyLabel(item.shortcut)}</ContextMenuShortcut>}
                </ContextMenuItem>
              ))}
            </ContextMenuGroup>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={label}>
        {groups.map((group, g) => (
          <DropdownMenuGroup key={g}>
            {g > 0 && <DropdownMenuSeparator />}
            {group.map((item) => (
              <DropdownMenuItem key={item.label} disabled={Boolean(item.blocked)} title={item.blocked} onSelect={item.onSelect}>
                {item.label}
                {item.shortcut && <DropdownMenuShortcut>{keyLabel(item.shortcut)}</DropdownMenuShortcut>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
