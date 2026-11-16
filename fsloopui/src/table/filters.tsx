// Filter controls (table #11; ui → Choosing from a list; rules/ui → Conventions 16): a filter over a fixed set that
// fits a select with its «все» — at most 6 values — is u2's select, a longer one u2's combobox with several values;
// every option carries its count over the set without its own filter, from the query module. The «Вид» select
// names a preset of filters: choosing one replaces the filters and leaves sort, columns and search alone; filters
// changed by hand read «Свой набор».
import { CountCombobox, CountSelect, SELECT_MAX_OPTIONS, type CountOption } from "@/ui";
import { normalizeFilters, presetDetail, presetOf, type FilterDef, type Filters, type Preset } from "./query.ts";

/** The select's value for «все»: a select cannot hold an empty value. */
export const ANY = "*";
export const ANY_LABEL = "все";
export const PRESET_LABEL = "Вид";
export const CUSTOM_PRESET = "custom";
export const CUSTOM_LABEL = "Свой набор";

/** Whether a filter is a select: its values and «все» fit the select's seven options. */
export const isSelectFilter = (def: FilterDef<unknown>): boolean => def.options.length + 1 <= SELECT_MAX_OPTIONS;

export interface FilterControlProps<R> {
  def: FilterDef<R>;
  value: readonly string[];
  /** The query's counts for this filter; absent while the rows load. */
  counts: Readonly<Record<string, number>> | undefined;
  onChange: (value: string[]) => void;
  className?: string;
}

export function FilterControl<R>({ def, value, counts, onChange, className }: FilterControlProps<R>) {
  const options: CountOption[] = def.options.map((o) => ({ value: o.value, label: o.label, count: counts ? (counts[o.value] ?? 0) : undefined }));
  if (isSelectFilter(def as FilterDef<unknown>))
    return (
      <CountSelect
        label={def.label}
        value={value[0] ?? ANY}
        onValueChange={(v) => onChange(v === ANY ? [] : [v])}
        options={[{ value: ANY, label: ANY_LABEL, count: counts?.[""] }, ...options]}
        className={className}
      />
    );
  return <CountCombobox label={def.label} value={value} onValueChange={onChange} options={options} placeholder={def.placeholder ?? `Найти: ${def.label.toLowerCase()}`} anyLabel={ANY_LABEL} className={className} />;
}

export interface PresetSelectProps {
  presets: readonly Preset[];
  filters: Filters;
  /** The query's rows per preset; absent while the rows load. */
  counts: Readonly<Record<string, number>> | undefined;
  onChoose: (preset: Preset) => void;
  className?: string;
}

/** «Вид» (Conventions 16): the named slices with their counts, each with what it holds as its muted second part where
 * its label does not say it (improve-4); «Свой набор» while the filters match none. */
export function PresetSelect({ presets, filters, counts, onChoose, className }: PresetSelectProps) {
  const current = presetOf(filters, presets);
  const options: CountOption[] = presets.map((p) => ({ value: p.id, label: p.label, detail: presetDetail(p), count: counts?.[p.id] }));
  if (!current) options.push({ value: CUSTOM_PRESET, label: CUSTOM_LABEL });
  return (
    <CountSelect
      label={PRESET_LABEL}
      value={current?.id ?? CUSTOM_PRESET}
      onValueChange={(id) => {
        const preset = presets.find((p) => p.id === id);
        if (preset) onChoose(preset);
      }}
      options={options}
      className={className}
    />
  );
}

/** A filter's chosen values in its options' words, in the options' order; a value no option names reads as itself,
 * after them. The one value→label lookup of a named view's fills and of the filters' summary. */
function optionLabels<R>(def: FilterDef<R>, values: readonly string[]): string[] {
  const named = def.options.filter((o) => values.includes(o.value));
  return [...named.map((o) => o.label), ...values.filter((v) => !named.some((o) => o.value === v))];
}

/** What fills a named view, for its empty state (rules/ui → Conventions 16): the words it holds, else the values its
 * filters keep in their options' words — «кандидат». */
export function presetFills<R>(preset: Preset, defs: readonly FilterDef<R>[]): string[] {
  if (preset.holds?.length) return [...preset.holds];
  const active = normalizeFilters(preset.filters);
  return defs.flatMap((def) => (active[def.id] ? optionLabels(def, active[def.id]) : []));
}

/** The active filters and the search in words, for the filtered-to-none state: «Серьёзность: major, critical». */
export function filterSummary<R>(defs: readonly FilterDef<R>[], filters: Filters, search: string): string[] {
  const active = normalizeFilters(filters);
  const out: string[] = [];
  for (const def of defs) if (active[def.id]) out.push(`${def.label}: ${optionLabels(def, active[def.id]).join(", ")}`);
  if (search.trim()) out.push(`${SEARCH_WORD}: «${search.trim()}»`);
  return out;
}

const SEARCH_WORD = "Поиск";
