// A menu of actions (ui → Row actions live in the context menu; table #4): one item set, opened from a trigger
// (a dropdown) or by a right click on its area (a context menu) — the one menu of the product, the table's row menu
// included. A header names what the menu acts on; items read «Открыть <объект>» and «Скопировать <что>» (the design
// check), a copy item through the copy helper; a shortcut shows as `Kbd`; a choice of one value (the row menu's pin)
// is a submenu of radio items. Both kinds draw from the same library parts, so the item form is written once.
import type { ReactNode } from "react";
import * as Context from "@/components/ui/context-menu";
import * as Dropdown from "@/components/ui/dropdown-menu";
import { keyLabel } from "./kbd.tsx";
import { copyText } from "./toast.tsx";

export interface MenuAction {
  /** Stable: tests and the row menu's pin find the item by it. */
  id?: string;
  label: string;
  onSelect: () => void;
  /** Why the item cannot run now; the item stays in the menu, disabled. */
  blocked?: string;
  /** A physical key code shown at the item's end. */
  shortcut?: string;
}

/** A choice of one value, in a submenu of radio items: «Действие по клику» → its actions. */
export interface MenuChoice {
  id?: string;
  label: string;
  value: string;
  choices: readonly { value: string; label: string }[];
  onChoose: (value: string) => void;
}

export type MenuItem = MenuAction | MenuChoice;

/** Groups of items, separated by a rule. */
export type MenuGroups = readonly (readonly MenuItem[])[];

/** The one label of a copy: «Скопировать <что>». */
export const copyLabel = (what: string): string => `Скопировать ${what}`;

/** «Скопировать <что>»: copies through the helper, which raises «Скопировано: <что>»; a list is joined by newlines. */
export const copyItem = (what: string, value: string | readonly string[]): MenuAction => ({ label: copyLabel(what), onSelect: () => void copyText(value, what) });

export interface MenuHeader {
  /** What the menu acts on: a row's title, «12 находок». */
  text: string;
  /** The full text, when the header truncates or says less than it knows. */
  title?: string;
}

export interface MenuProps {
  /** The trigger: a button for a dropdown, the area itself for a context menu. */
  children: ReactNode;
  groups: MenuGroups;
  /** «dropdown» opens from the trigger, «context» by a right click or the menu key on the area. */
  kind?: "dropdown" | "context";
  label?: string;
  header?: MenuHeader | null;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const PARTS = {
  context: {
    Root: Context.ContextMenu,
    Trigger: Context.ContextMenuTrigger,
    Content: Context.ContextMenuContent,
    Label: Context.ContextMenuLabel,
    Group: Context.ContextMenuGroup,
    Separator: Context.ContextMenuSeparator,
    Item: Context.ContextMenuItem,
    Shortcut: Context.ContextMenuShortcut,
    Sub: Context.ContextMenuSub,
    SubTrigger: Context.ContextMenuSubTrigger,
    SubContent: Context.ContextMenuSubContent,
    RadioGroup: Context.ContextMenuRadioGroup,
    RadioItem: Context.ContextMenuRadioItem,
  },
  dropdown: {
    Root: Dropdown.DropdownMenu,
    Trigger: Dropdown.DropdownMenuTrigger,
    Content: Dropdown.DropdownMenuContent,
    Label: Dropdown.DropdownMenuLabel,
    Group: Dropdown.DropdownMenuGroup,
    Separator: Dropdown.DropdownMenuSeparator,
    Item: Dropdown.DropdownMenuItem,
    Shortcut: Dropdown.DropdownMenuShortcut,
    Sub: Dropdown.DropdownMenuSub,
    SubTrigger: Dropdown.DropdownMenuSubTrigger,
    SubContent: Dropdown.DropdownMenuSubContent,
    RadioGroup: Dropdown.DropdownMenuRadioGroup,
    RadioItem: Dropdown.DropdownMenuRadioItem,
  },
} as const;

const isChoice = (item: MenuItem): item is MenuChoice => "choices" in item;

export function Menu({ children, groups, kind = "dropdown", label, header, onOpenChange, className }: MenuProps) {
  // the two kinds take the same props for every part this menu uses
  const P = PARTS[kind] as (typeof PARTS)["context"];
  return (
    <P.Root onOpenChange={onOpenChange}>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Content aria-label={label} className={className} {...(kind === "dropdown" ? { align: "start" } : {})}>
        {header && (
          <P.Label data-slot="menu-header" className="truncate" title={header.title}>
            {header.text}
          </P.Label>
        )}
        {groups.map((group, g) => (
          <P.Group key={g}>
            {(g > 0 || header) && <P.Separator />}
            {group.map((item) =>
              isChoice(item) ? (
                <P.Sub key={item.id ?? item.label}>
                  <P.SubTrigger data-action={item.id}>{item.label}</P.SubTrigger>
                  <P.SubContent>
                    <P.RadioGroup value={item.value} onValueChange={item.onChoose}>
                      {item.choices.map((c) => (
                        <P.RadioItem key={c.value} value={c.value}>
                          {c.label}
                        </P.RadioItem>
                      ))}
                    </P.RadioGroup>
                  </P.SubContent>
                </P.Sub>
              ) : (
                <P.Item key={item.id ?? item.label} data-action={item.id} disabled={Boolean(item.blocked)} title={item.blocked} onSelect={item.onSelect}>
                  {item.label}
                  {item.shortcut && <P.Shortcut>{keyLabel(item.shortcut)}</P.Shortcut>}
                </P.Item>
              ),
            )}
          </P.Group>
        ))}
      </P.Content>
    </P.Root>
  );
}
