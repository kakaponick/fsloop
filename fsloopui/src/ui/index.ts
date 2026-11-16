// fsloopUI's shared components (DESIGN.md → Components): every presentational part a view builds from, over the
// shadcn library in src/components/ui. A view imports from here, never a second copy of a part.
export { Dash, NotFound, NotRecorded, notFoundText, OBJECT_WORDS, type ObjectKind } from "./absent.tsx";
export { Clamp, COLLAPSE, EXPAND, type ClampProps } from "./clamp.tsx";
export { CountLink, type CountLinkProps } from "./count-link.tsx";
export { CountTabs, CountTabsContent, TabCount, type CountTab, type CountTabsProps } from "./count-tabs.tsx";
export { AppDialog, type AppDialogProps } from "./dialog.tsx";
export { EmptyState, emptyStateText, emptyWhen, RESET_FILTERS, STEPS, type EmptyStateProps, type EmptyWhen } from "./empty-state.tsx";
export { FactList, MORE, type Fact, type FactListProps } from "./fact-list.tsx";
export { flatItem, FlatList, type FlatListProps } from "./flat-list.tsx";
export { FrameStrip, FrameThumb, FrameViewer, THUMB, WHEEL_GESTURE_GAP, type Frame } from "./frames.tsx";
export { HeldStrip, heldStripText, heldVerb, type HeldCounts, type HeldLeftKind, type HeldNoun, type HeldVerb } from "./held-strip.tsx";
export { keyLabel, Keys } from "./kbd.tsx";
export { Loading, LOADING_WORD } from "./loading.tsx";
export { EDGE_MARK, EDGE_MS, markProps, OUT_OF_FILTER, OutOfFilter, TARGET_MARK, useEdgeMarks, type MarkState } from "./marks.tsx";
export { copyItem, copyLabel, Menu, type MenuAction, type MenuChoice, type MenuGroups, type MenuHeader, type MenuItem } from "./menu.tsx";
export { PartFailed, partFailedText, RETRY, type Gender } from "./part-failed.tsx";
export { UiProvider } from "./provider.tsx";
export { RunningText, parseBlocks, type Paint, type Resolve, type RunningTextProps } from "./running-text.tsx";
export { comboboxValueText, CountCombobox, CountSelect, OptionCount, SELECT_MAX_OPTIONS, type CountOption } from "./select.tsx";
export { Dot, StatusDot, stateWord, type DotState, type StatusDotProps } from "./status-dot.tsx";
export { readPref, usePref, writePref } from "./storage.ts";
export { AppToaster, copyText, notify, TOAST_MAX_TITLE, toastTitle, type ToastAction } from "./toast.tsx";
export { GlossaryTooltip, glossaryFrom, glossaryLines, GLOSSARY_MAX_ENTRIES, GLOSSARY_MAX_LINE, Hint, type GlossaryEntry } from "./tooltip.tsx";
export { dialogOpen, isTextField, useShortcut } from "./use-shortcut.ts";
