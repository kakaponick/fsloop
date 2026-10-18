# UI Law

How to build UI — fsloop's base law for every surface a run builds or judges; it overrides generic design instinct. Users, voice and anti-references — `PRODUCT.md`; tokens, color, type, density and the look of components — `DESIGN.md`; clarity and flow — `law/ux.md` (law 0 first); how to build — this file; data tables — `law/table.md`. Cite a rule by its section: `ui` → Widths.

**Precedence** — of the whole law, the one statement of it. Every law file (`code`, `tests`, `ui`, `table`, `ux`) is refined or overridden by the project's rule file on the same subject, as `common.md` names them, where both speak; where the project is silent the law stands. The design law runs `PRODUCT.md` → `DESIGN.md` → the project's UI rules and UX laws → `law/ui.md` and `law/table.md` → `law/ux.md`, with one exception: `ux 0` outranks every form rule — a new user's question is never left open, and it is closed in a form the rules above allow. A rule marked *default* is the choice for a dense working tool — an operator console, an admin, a dashboard; a product whose `PRODUCT.md` or `DESIGN.md` states another (a consumer app, a touch-first surface) overrides it, and that statement is the rule. impeccable works under this law: a point the law contradicts is void, never a finding or a candidate. Every surface keeps the world `DESIGN.md` commits; a new visual direction, a brand change, impeccable's direction roll and decision page run only with the user at the keyboard.

**The law grows with the code.** `PRODUCT.md` and `DESIGN.md` describe the product as built, so the change that alters what they describe updates them in the same commit:
- **`PRODUCT.md`** — a new surface adds its Surfaces row: the one question it answers. A surface whose question changes rewrites its row. Users, purpose and success criteria change only from the user's words.
- **`DESIGN.md`** — a new or changed token, a shared component's look or variant, a new shared component, or a new named rule updates its section; then the sidecar `.impeccable/design.json` is refreshed with impeccable `document`, the sidecar alone.
- **The role map** (Roles below) — a component that comes to play a role is named under the implementer's NOTES; the orchestrator records it (`ui.md` → A new surface).

A change that leaves any of them behind the code breaks this rule.

**On screen.** A component's states and interactions are proven by the code and the tests; a run's frames are `ui.md` → Frames.

## Roles

The rules below name the parts of an interface by **role**, not by component: the project's role map says which component plays each — the project's UI rules or `.claude/fsloop/facts.md` → Roles, quoted in `common.md`. A role the map leaves empty is filled once, by the rule «Existing component first»: the search for a component that already plays it, else one shared component under the project's component folder, recorded in `DESIGN.md` — never a one-off at a call site. A project with no UI has no map.

| role | what it is |
|---|---|
| primitives | the component library: input, select, combobox, radio group, textarea, switch, checkbox, slider, button, date and time pickers, file dropzone, dialog, tooltip, popover, tabs |
| status dot | a dot in a signal tone beside a label in regular text — the one way a state shows its color |
| glossary tooltip | a quiet help icon after a label whose tooltip defines a term or each value of a set |
| blocked action | a disabled control that stays focusable and says why it cannot run now and what would let it |
| confirm dialog / confirm button | the confirmation of a destructive action outside a modal; armed in place inside one |
| toast | the result of an async action that has no visible refresh |
| empty state | why a view is empty and what to do next; a table's own variant |
| fact list | the label–value table of an object page (`ux 9`), with its fold row |
| page header | the toolbar strip: navigation, title or breadcrumb, controls, the toolbar fact |
| adaptive toolbar | a one-line toolbar whose items collapse into a `…` overflow (`table #14`) |
| status bar | the page's bottom strip: pagination or counts, data age (`table #8`) |
| data table | the table machinery of `law/table.md`: server source, view state, columns menu, sortable header, row context menu, selection, pagination, search with history, column widths, pinned action |
| what's-new registry | where a new page or control announces itself, when the product keeps one |

## Layout Paradigm — content-out, never space-in

1. A component is sized by its content: intrinsic width (fit-content, fixed widths sized to the widest real value, floor + cap), never by the space around it. Stretching is a page-grid decision, never a component default — slack lives in the grid's gutters, not inside components.
2. Adaptivity cascades top-down: the page layout places containers and owns the only viewport breakpoints; a component adapts to the container it sits in (container queries), never to the viewport.
3. Compactness is inherited, not policed: a component built content-out is compact in any container — page column, side panel, dialog.

Light and dark are equal first-class surfaces when the product has both. *Default:* fixed sizes and widths, never fluid ones, so paginating or filtering never jitters; no oversized touch targets; accessibility best-effort — keyboard-operable, wheel-operable on desktop (Conventions → Wheel), reasonable contrast, no formal WCAG level.

## Conventions

- **Existing component first** — before any control: the project's primitives, then how another surface already solves it. Reuse or generalize with a prop; never build in parallel, never fork a flatter copy.
  - **No native control where a primitive exists** — no raw input, select, textarea or bare button beside a library that has them; a date or time goes through the library's picker, never the OS popup that ignores the theme.
  - **A brand-new component** only after the search fails, through the library's own generator when it has one — never hand-rolled markup.

- **A time names its zone** — a wall-clock time the server acts on is ambiguous without its zone: show the zone the executor actually uses; a browser-local picker states the local zone. A confidently wrong zone is worse than none.

- **Glossary** — the glossary tooltip defines a term, or each value of a set, a new user may not know (`ux 0`), right after the label that names it — a column header, a field label, a section title. A settings page has none: there a setting's description says what it is and does, and every setting stays in view, none folded. One line per term or value, `Value — meaning`; one muted closing line for an exception.
  - **A glossary line reads the same on every instance of its label** — true on every row, in every state, at any moment. What belongs to the instance — this row's cause, a date, a count, a consequence the user decides by, what a control does, the step that fixes it — is the element's own text or the step its link opens (`ux 1`): the fix a link or a button, an action that cannot run the blocked action, a destructive consequence its confirm.
  - **The icon is earned by a term**: a label the user reads without one, or a field whose description already says it, has none (`ux 2`). The values a column's cells show are defined once, in its header's glossary; a cell carries none of its own.
  - Built from the glossary role alone — a hand-rolled icon plus tooltip is a defect. Inside a sortable header it does not trigger the sort.

- **A new page or control announces itself** — when the product keeps a what's-new registry: a change that adds a page the menu opens, or a control on an existing page its user would not find unprompted, adds its entry with a title that names it and a body of two sentences — what the page or control does, with the system or the user as its subject, then when to open it (`ux 1`). An entry past its window goes whenever the registry is touched.

- **Status color is a dot, never a badge** — the status dot: a dot in the signal tone and the label in regular text. A badge, pill, border, fill or text in a status color to show a state is a defect. A badge stays only for neutral tags (role, kind). Tones come from one shared map, never the raw palette.

- **Widths** — a button, input, select or compound trigger sizes to its content; a flexible text input has a cap.
  - Toolbar filter, combobox and popover triggers hug their content — no floor, no fixed width; a dialog's combobox may floor; collapsed into the `…` overflow, controls span its width (`table #14`).
  - Inline table-cell editors — a floor **and** a cap, inner truncation; never a hard width, never a bare floor.
  - Search inputs: flexible with a cap in toolbars; a fixed width matching the field in dialogs.
  - Primary calls to action never span their container — right-aligned at content width in dialog footers; icon-only with a tooltip in toolbars with three or more controls.
  - Tabs stay content-width, left-aligned.
  - Full width only on layout-only containers, table cells, media wrappers and controls inside the `…` overflow.

- **Constrain sparse content** — anything that isn't a full-parity table or a dense row feed never runs edge-to-edge: the smallest centered cap the content fills, narrower for single-column forms. No lone centered island — give it a grid neighbour; no mostly-empty flexible column.

- **Content-sized cards keep their own height** — masonry or start-aligned; equal height only for structurally uniform stat tiles.

- **Truncation only for variable-length content in a hard-capped container** — never a defensive default; removing the width cap removes the truncation.

- **Empty states** — the empty-state role; a table its own variant. It says why it is empty and what to do next (`ux 0`).

- **Type, density and component sizes come from `DESIGN.md`** — set once in the shared components and the theme, chosen at a call site by the component's size prop, never by a height or size override; a container never sizes primary text smaller than the body size. Controls that sit together share one height — mixed heights in one group are a visible defect.

- **Row actions live in the context menu** (`table #4`) — no actions column.

- **Persisted preferences have one source of truth** — the persisted store, never mirrored into local state with a sync effect (the async load races the persist and overwrites). Persisted state renders on first paint — no flash of the default then a snap; fix the source of truth, never mask it with a loading gate.

- **Toggles are optimistic** — a switch, checkbox, pin or status flip changes at once: the optimistic value set before the request, no await-then-refresh gate, no disabling while pending.

- **Every async action surfaces its full lifecycle** — pending: a spinner and disabled. Result: a toast and/or a visible refresh — silent inaction and double-fire are both defects. A row-menu action also shows pending in the row (the menu closes on select), and its item reopens disabled with an «…ing» label. Optimistic toggles are exempt.

- **Destructive action** — destructive: it deletes, removes, cancels or stops something, or takes away what work runs on (a key, a token, a server), and the same control cannot undo it in one click. Outside a modal — a page, a settings row, a toolbar, a card — it opens the confirm dialog: the title asks the action on its object («Remove the DeepSeek key?»), the description names every loss and what stops, the confirm button repeats the verb. Inside a modal it arms in place, never a dialog on top (`ux 7`). It arms in place with no dialog when it spends but destroys nothing (a run, a build), or edits a draft applied only by Save.

- **Blocked action** — an action that cannot run now is the blocked-action role with its reason, never hidden and never silently inert.

- **Dialogs return focus** — a dialog returns focus to its opener on close; an opener gone by the close names where focus lands. Motion lives in the dialog primitive, never at a call site; navigations, refreshes and search-param changes stay still.

- **A dialog fits its viewport** — it scrolls only vertically, its height capped and scrolling inside; a long textarea is capped and scrolls; a table in a modal scrolls in its own bounded, bordered container with truncated cells (`table #10`); flex children with user text may shrink and truncate. The smallest dialog width that fits.

- **Wheel** — *default:* on desktop the wheel is a navigation input, not only a scroll: whatever the user steps through by ‹ › or ←/→ — a table's pages (`table #1`), a viewer walking a list item by item, a carousel, a step-by-step result — also steps by the wheel, on the scroll body that holds the current item. The wheel scrolls a long item first and steps only past its edge, one step per gesture, stopping at the ends; a sequence of one keeps the wheel for scrolling. The ‹ › sit in one stable place, and focus opens on the stepped region so ←/→ work at once.

## Page chrome — toolbar and status bar

- **Toolbar** is the page header strip: navigation, title or breadcrumb, then its controls, with the toolbar fact at the right; on a page with a table its root is the adaptive toolbar (`table #14`).
- **A toolbar fact is compact** (`ux 1`): the status dot, then `count state · cause` in six words at most, the count one word. The count is the button to its list; the cause is optional, and where it has a fix it is the link to it. The header takes its own short string; a longer sentence for a settings line or a dialog lives under another. Every fact the page can raise together fits beside its toolbar at the narrowest desktop width the product supports (`DESIGN.md`; none → 1280 px) — the facts keep their width up to half the strip while the toolbar folds its filters into `…`; a clipped fact is a lost fact (`ux 2`). A fact a change adds or rewords gets a test pinning its words at the widest count.
- **The page's main actions live in the toolbar** — the few the page exists for, acting on the page's own object: resume, cancel or replace on an order; add or run on a list. They sit in the right cluster, appear whenever the state allows them, and collapse into `…` when the strip is narrow. A user looks for «what can I do with this page» in one stable place; a button inside a fact block, a banner or next to a status moves with the text around it.
- **Stays in the body:** actions on a row or a selection (the context menu, `table #4`) and a link that is part of an explanatory message.
- A destructive toolbar action confirms in a dialog; one that cannot run now is the blocked action with its reason.
- **Status bar** is the page's bottom strip, under all the page content, on pages with or without a table: pagination or counts, and data age (`table #8`). It holds no actions.

