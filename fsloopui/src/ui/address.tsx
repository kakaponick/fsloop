// An object's own address on the list that holds it (rules/ui → Layout 2; the design check: an object's address is a
// query key): a journal's decision, a run's convention. One form on every such list (f22, craft-4): the object's
// number is a link to its address, opened in place — the view replaces the key — and a right click on the object
// opens its menu, «Скопировать адрес <чего>», which copies the whole address to paste elsewhere.
import type { MouseEvent, ReactElement, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NUMBERED, numberText, OBJECT_WORDS, type NumberedKind } from "./absent.tsx";
import { LINK_LOOK } from "./link-button.tsx";
import { copyItem, Menu, type MenuHeader } from "./menu.tsx";

/** What the copy names: «адрес решения», «адрес соглашения» — the menu's item and its toast alike. */
export const addressWhat = (kind: NumberedKind): string => `адрес ${NUMBERED[kind].of}`;

/** The link's name for a screen reader, its visible number within it: «Ссылка на решение #40» (both words are neuter,
 * so the accusative is the word itself). */
export const addressLabel = (kind: NumberedKind, id: string): string => `Ссылка на ${OBJECT_WORDS[kind].word} ${numberText(kind, id)}`;

/** The item's own name for a screen reader, one form on every list that numbers its items: its number, then its lead —
 * «Решение #40: <вопрос>», «Соглашение 12: <образец>» — so ↑/↓ announce which item and what it holds (craft-5). */
export const itemName = (kind: NumberedKind, id: string, lead: string): string => {
  const { word } = OBJECT_WORDS[kind];
  return `${word[0].toUpperCase()}${word.slice(1)} ${numberText(kind, id)}: ${lead}`;
};

export interface AddressLinkProps {
  kind: NumberedKind;
  id: string;
  /** The object's address, as the view writes it. */
  href: string;
  /** Opens the address in place (the view replaces its key); a click with a modifier keeps the browser's meaning. */
  onOpen: () => void;
  /** The number as shown, when the view paints its search's hits in it; «#40» or «12» by default. */
  children?: ReactNode;
  className?: string;
}

/** The object's number, a link to its own address: tabular, underlined as every link, in the ink around it. */
export function AddressLink({ kind, id, href, onOpen, children, className }: AddressLinkProps) {
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onOpen();
  };
  return (
    <a data-slot="address-link" href={href} aria-label={addressLabel(kind, id)} onClick={click} className={cn("tabular-nums", LINK_LOOK, className)}>
      {children ?? numberText(kind, id)}
    </a>
  );
}

/** The object's menu, opened by a right click or the menu key on it: «Скопировать адрес <чего>» — the whole URL. */
export function AddressMenu({ kind, href, header, children }: { kind: NumberedKind; href: string; header: MenuHeader; children: ReactElement }) {
  const address = new URL(href, window.location.origin).href;
  return (
    <Menu kind="context" groups={[[copyItem(addressWhat(kind), address)]]} header={header} label={header.text}>
      {children}
    </Menu>
  );
}
