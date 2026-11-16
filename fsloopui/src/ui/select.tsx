// Choosing from a list (ui → Choosing from a list, Widths; table #11): a fixed set of at most 7 options is a select,
// a longer set or one that grows with the data is a combobox searched in its field, at most 10 rows in view. Both
// triggers show «Поле: значение» and nothing else; each option carries its count over the unfiltered set in a
// reserved tabular slot, a muted «0» — in the list only, never copied into the closed trigger (table #11).
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { num } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CountOption {
  value: string;
  label: string;
  /** Rows this option keeps, over the unfiltered set; absent where a count says nothing. */
  count?: number;
  /** What the closed trigger shows of this option, when its label carries more than the trigger should repeat — the
   * report picker's option names the stage and the state the reader shows under it, its trigger the report alone
   * (ux 2). The label by default. */
  short?: string;
}

/** An option's count in its reserved slot. */
export function OptionCount({ n }: { n: number | undefined }) {
  if (n === undefined) return null;
  return <span className={cn("ml-auto min-w-count text-right tabular-nums text-muted-foreground", n > 0 && "text-foreground")}>{num(n)}</span>;
}

export const SELECT_MAX_OPTIONS = 7;

export interface CountSelectProps {
  /** The field's name, shown before the value: «Серьёзность». */
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly CountOption[];
  className?: string;
}

/** A select over at most 7 options; a longer set is a combobox (throws, so a test catches the wrong choice). */
export function CountSelect({ label, value, onValueChange, options, className }: CountSelectProps) {
  if (options.length > SELECT_MAX_OPTIONS) throw new Error(`CountSelect «${label}»: ${options.length} options, a select holds at most ${SELECT_MAX_OPTIONS} — use CountCombobox`);
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size="sm" aria-label={label} className={cn("w-fit", className)}>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-muted-foreground">{label}:</span>
          {/* the value's own label: the library would copy the whole item, its count included */}
          <SelectValue>{options.find((o) => o.value === value)?.label ?? value}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex w-full items-baseline gap-4">
                <span>{option.label}</span>
                <OptionCount n={option.count} />
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export interface CountComboboxProps {
  /** The field's name: «Юнит». */
  label: string;
  /** The chosen values; empty means every value. */
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  options: readonly CountOption[];
  /** One value at a time; choosing replaces the choice and closes the list. */
  single?: boolean;
  /** The field's placeholder: «Найти юнит». */
  placeholder: string;
  /** The word for no choice: «все». */
  anyLabel?: string;
  className?: string;
}

/** «u3», «u3 и ещё 2» or «все»: the trigger's value — each option by its `short` form where it has one. */
export function comboboxValueText(value: readonly string[], options: readonly CountOption[], anyLabel = "все"): string {
  if (!value.length) return anyLabel;
  const option = options.find((o) => o.value === value[0]);
  const first = option?.short ?? option?.label ?? value[0];
  return value.length === 1 ? first : `${first} и ещё ${value.length - 1}`;
}

export function CountCombobox({ label, value, onValueChange, options, single = false, placeholder, anyLabel = "все", className }: CountComboboxProps) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(value);
  const pick = (v: string) => {
    if (single) {
      onValueChange(chosen.has(v) ? [] : [v]);
      setOpen(false);
      return;
    }
    onValueChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" aria-expanded={open} aria-label={`${label}: ${comboboxValueText(value, options, anyLabel)}`} className={cn("w-fit font-normal", className)}>
          <span className="text-muted-foreground">{label}:</span>
          <span>{comboboxValueText(value, options, anyLabel)}</span>
          <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-56 p-0">
        <Command>
          <CommandInput placeholder={placeholder} aria-label={placeholder} />
          <CommandList>
            <CommandEmpty>Нет совпадений — измените запрос</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} value={`${option.label} ${option.value}`} data-checked={chosen.has(option.value)} onSelect={() => pick(option.value)}>
                  <span className="truncate" title={option.label}>
                    {option.label}
                  </span>
                  <OptionCount n={option.count} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
