// Search with history (table #12; rules/ui → Conventions 11): the shared search of every table and every list view —
// never a bare input. The placeholder names the fields searched; `/` outside a text field focuses it (the shortcut
// hook holds the conditions); a committed term — Enter, or leaving the field — joins the table's history, which ↓ or
// the clock button opens. The clear button and the key cap keep their box whether shown or not (Strict 1).
import { HistoryIcon, SearchIcon, XIcon } from "lucide-react";
import { Fragment, useRef, useState, type ReactNode } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { Hint, Keys, useShortcut } from "@/ui";
import { hitRanges } from "./query.ts";

export const SEARCH_LABEL = "Поиск";
export const HISTORY_LABEL = "Недавние запросы";
export const CLEAR_LABEL = "Очистить поиск";
export const HISTORY_EMPTY = "Запросов ещё нет — Enter в поле поиска сохраняет запрос";

export interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  /** Names the fields searched: «Текст, файл, id, юнит». */
  placeholder: string;
  history: readonly string[];
  /** A term the user committed: Enter, or leaving the field with text in it. */
  onCommit: (term: string) => void;
  /** Binds `/` to focus this field; one search per view binds it. */
  shortcut?: boolean;
  className?: string;
}

export function SearchBox({ value, onChange, placeholder, history, onCommit, shortcut = true, className }: SearchBoxProps) {
  const own = useRef<HTMLInputElement | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  useShortcut("Slash", () => own.current?.focus(), { enabled: shortcut });
  const choose = (term: string) => {
    onChange(term);
    onCommit(term);
    own.current?.focus();
  };
  return (
    <InputGroup data-slot="table-search" className={cn("h-7 w-full", className)}>
      <InputGroupAddon align="inline-start">
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={own}
        type="search"
        aria-label={`${SEARCH_LABEL}: ${placeholder}`}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (value.trim()) onCommit(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit(value);
          else if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          } else if (event.key === "ArrowDown" && history.length) {
            event.preventDefault();
            setHistoryOpen(true);
          }
        }}
        className="[&::-webkit-search-cancel-button]:hidden"
      />
      <InputGroupAddon align="inline-end" className="gap-0.5">
        <span aria-hidden={focused || value ? true : undefined} className={cn(focused || value ? "invisible" : undefined)}>
          <Keys codes={["Slash"]} />
        </span>
        <Hint label={CLEAR_LABEL} keys={["Escape"]}>
          <InputGroupButton size="icon-xs" aria-label={CLEAR_LABEL} tabIndex={value ? 0 : -1} aria-hidden={value ? undefined : true} className={cn(!value && "invisible")} onClick={() => choose("")}>
            <XIcon />
          </InputGroupButton>
        </Hint>
        <DropdownMenu open={historyOpen} onOpenChange={setHistoryOpen}>
          <Hint label={HISTORY_LABEL} keys={["ArrowDown"]}>
            <DropdownMenuTrigger asChild>
              <InputGroupButton size="icon-xs" aria-label={HISTORY_LABEL}>
                <HistoryIcon />
              </InputGroupButton>
            </DropdownMenuTrigger>
          </Hint>
          <DropdownMenuContent align="end" className="max-w-80">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{HISTORY_LABEL}</DropdownMenuLabel>
              {!history.length && <DropdownMenuItem disabled>{HISTORY_EMPTY}</DropdownMenuItem>}
              {history.map((term) => (
                <DropdownMenuItem key={term} onSelect={() => choose(term)}>
                  <span className="truncate" title={term}>
                    {term}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** A text with the search's hits marked (table #12: hits are highlighted). */
export function Highlight({ text, tokens }: { text: string; tokens: readonly string[] }): ReactNode {
  const ranges = hitRanges(text, tokens);
  if (!ranges.length) return text;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) parts.push(<Fragment key={`t${at}`}>{text.slice(at, start)}</Fragment>);
    parts.push(
      <mark key={`m${start}`} data-slot="hit" className="rounded-sm bg-muted text-foreground underline decoration-muted-foreground underline-offset-2">
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  }
  if (at < text.length) parts.push(<Fragment key={`t${at}`}>{text.slice(at)}</Fragment>);
  return parts;
}
