# UX Law

Flow, cognition and words — fsloop's base law for every surface a run builds or judges. Form — components, sizes, spacing, density, color tokens — is `law/ui.md` and the product's `DESIGN.md`, binding: where they meet the laws below, they win. Law 0 is the exception — a form rule never leaves a new user's question open; the question is closed in a form those files allow. Users, voice and volume — `PRODUCT.md`. The project's own UX rules (`common.md` names them) refine or override these where both speak. In a review, cite a law by its number: `ux 0`.

## 0. No Questions at First Sight

The interface and the whole experience are as simple, convenient and clear as they can be: a new user has no questions about what is happening and what is asked of them. Every other law serves this one and loses to it.

Judge every element by the question a new user would ask about it, and close it in this order:

1. The system does it — infers the value, fills a default, recognizes the format.
2. Remove — an element that tells nothing, or raises a question of its own.
3. Explain in place — an example, a preview of what was recognized, a status. An addition that closes a question is not noise.

Explaining is the last rung: a review accepts it once it names why the system cannot do it and removing would lose a fact.

An internal term (an API field, a protocol name, a storage format) never appears without its explanation in place.

A surface is judged by walking its task, not by a still frame: every state a user reaches doing it, whatever opens over the surface included. Each element the walk meets reads on its own — what it is, what it does, where it leads — without prior knowledge or a hover; a glossary explains a term (`ui` → Glossary), the element carries its own meaning. A form's walk: empty → filled → partly wrong → result; at each step the user sees what to enter, what was recognized, what is missing, and after submit — what happened and what to do next.

## 1. Microcopy: a String Answers the Reader's Questions

A string is done when a reader who sees it for the first time, on its page, finds each question answered — by the string itself, or one step away where it leads. The questions follow the string's kind:

* any string — what is this;
* a control or a setting — also what it acts on, when it acts, what changes;
* an error — what went wrong, how to fix it;
* a result — what was done, what was not and why, what is next;
* an empty state — why it is empty, what to do;
* the reason on a disabled action — why it cannot run now, what would let it.

A string's room is set by its place, not by what it has to say. A string in the interface's frame — a toolbar fact or state, a button, a tab, a column header, a cell, a status-bar label, a menu row, a select option (`ui` → Page chrome, #10) — is **compact**: one line that answers «what is this»; the other questions are answered one step away, where it leads: the list its count filters to, the dialog or page its link opens; a term in it, by its glossary, which answers only what the term means. Only running text — a description, a dialog's body, an empty state, an error's message — takes a sentence or two. A question a compact string leaves open is closed at that step, never by lengthening the string; a finding that asks it to say more moves the answer to the step its question belongs to — a term's meaning to its glossary, a cause, a fix or what comes next to where the link leads. Within its room, a string keeps only words that answer its questions. Each language's string is written from these questions on its own: a string rendered from another sentence — the other language, a Surfaces row of `PRODUCT.md`, a brief — keeps that sentence's gaps, which the author fills from memory and the reader cannot. The author cannot judge this: they know the code. A string change is done when `cold-read` has read the added and changed strings, passed as text, and each word it named is owned or explained — a word the string's own page explains one step away passes.

A header **covers** what sits under it — a column header its cells, a status-bar lead its counts. The test: list every kind of value the cell can render — each branch of its component in the code, since a frame shows only the kinds its fixture holds — and read each as «<header>: <value>». A kind is covered when the pair reads to a new user as one correct statement: «Organization: waiting for the next day» is covered, «Organization: sign-in failed» is not. An uncovered kind moves to the column it belongs to, or the header widens its subject until every kind passes. A header that passes only by naming part of its column is the defect itself. The column widens to the covering header (`ui` #10).

* A setting's name is its subject and condition as a phrase: «Pause before retry», not «Retry in»; «Channels at once», not «Parallel». A name from the code is never a label.
* A description says trigger → effect and names the thing and where it lives: «When you add an API key on the Keys page, …».
* No ownerless word: a noun says whose, of what, after what («key», «retry», «limit», «failure»); a verb or a pronoun names its actor and its object — unless the same row already names it («No key» in a provider's row). A limit names its scope («for the whole system, not per account»).
* One concept — one word, the word the product's strings already use for it; two concepts never share one.

## 2. Each Fact Once

Every element carries a fact, an action, or the answer to a question. An element that repeats a neighbour — the label in its tooltip, the section title in its description, a header in every cell, one count shown twice — goes; the one new fact it carried stays where the user looks for it. An action counts only when, at production's real row counts and a typical row, using it can change what the user sees or has: a select with its only option chosen, a link to the page the user is on, carry nothing.

## 3. The System Fills, Defaults Never Commit

The user reaches the result with the fewest actions — clicks, choices, fields: a task never stops to ask for a value the system could have filled. A value the user would otherwise have entered is shown as what was filled and from what, and stays changeable; where nothing can be inferred, the default is the safest common value. Nothing the system fills or starts on its own spends money, publishes, deletes, or starts work the user did not ask for.

## 4. Errors: Prevented Before Submit, Recoverable After

Before submit: requirements are visible, input formats are accepted loosely, an action that cannot run now is disabled and says why (`ui` → Blocked action), a destructive one opens a confirmation that names what is lost — in place only inside a modal (`ui` → Destructive action). After a failure: the input stays, the message says what went wrong and how to fix it in the user's words, and retry or undo sits beside it.

## 5. Work Shows Where It Is and Ends on a Result

Work that takes steps or runs in the background shows what is done, what is left, the current step and how long it has been there. Interrupted work resumes where it stopped. A flow ends on a result that says what was done, what was not and why, and what is next — never on an empty or ambiguous screen.

## 6. Built for Volume

A screen is a view over the volume `PRODUCT.md` states, at production's real counts — for a working tool, thousands of rows. An action the user repeats per item also runs on a selection or a filter; a flow never makes the user do per item what they mean for a set.

## 7. One Modal at a Time

A modal opened from a modal buries context, splits focus and Escape, and leaves the user unsure which layer they are in.

* Never open a dialog from inside a dialog.
* A sub-task inside a modal switches the modal's view in place (list → form → result), with Back to return.
* Confirm inline — a confirm step or armed button in the same modal, not a confirmation dialog on top.
* Content that outgrows its modal moves to a page or side panel, never a second layer.

## 8. Color Earns Its Place

Every color is a claim on the user's attention; palette and meanings — `DESIGN.md`.

* Red and amber mark only a state the user should act on — name that action before coloring. Green says something is healthy or succeeded and asks for nothing. Destructive controls and chart series follow `DESIGN.md`.
* Color follows what the value means to the user, whatever raw value or code path produced it.
* A mark that a value differs from the rest compares it only with values of the same kind, produced the same way — values among which a difference means something.

## 9. An Object Page Answers the User, Not the Pipeline

A page for one object — an order, an account, a project, a document — is grouped by the user's questions, in this order, never by the subsystems that produced its data. Under the identity, the outcome, the verdict and the facts are one label–value table (`ui` → Fact list) — one label column, one value column, one fact to a row at every width; two facts never share a row. The outcome and the verdict open it as its first rows, and the facts follow — no separate lines, no gaps between them. A layout grouped by subsystem stays reachable as the page's debug view, so no fact is lost.

1. **Identity** — what this is, as the outside world shows it: name, handle, avatar, description. The page adds what the object's own representation has and the data lacks.
2. **Outcome** — the current state with its age, then «Next action» with the next action and, when the system starts it at a known time, the time left until it («Check before the campaign in 27 days»).
3. **Verdict** — the latest check in one line: result, score, date, «Details» to its details. The threshold, the attempt and the rule list are details.
4. **Facts** — the static attributes as label–value rows, one fact to a row, under the outcome and the verdict in the same table, what the object is apart from how it was produced. Every value keeps its visible label: a value that reads alone to its author turns into a riddle beside its neighbours («Turkish Turkey» — language or country?). The facts are ranked by how often the user decides by them: in view stay those that say which object this is and how old it is; the rest fold in place behind one «More» row at the table's end, open or closed as the user last left it. A fact that asks for action (a missing resource that blocks work, a spend over its limit) is outcome, not a fact: it shows in the outcome rows.
5. **Product** — what the object produced: an order's items, a channel's posts. It is the page's body, shown in full, where an older page had a count and a link; a stage names a group of it, never a block of its own.
6. **Provenance** — how the system produced the object: stages, attempts, generation, events, rules passed. On the page only while a step runs or has failed, under the outcome, as the answer to «what next»; once done it lives on the debug view, behind «Details». Nothing is deleted; it moves.

A section that must fold to fit is provenance; the folded secondary facts of item 4 are not a section and stay on the page. Done when a first-time user reads the state, the next action and the product in the first viewport.
