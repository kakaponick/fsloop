// The user's verdict on a finding — fsloopUI's one write (rules/ui → Conventions 6; ux 6; ui → Toggles). One
// control in the finding's detail and in the «Оценить…» dialog: the four verdicts, an optional note, the saved
// line «согласен · 19:41 МСК» under the detail's heading «Ваша оценка». It is the user's own state, so it is
// optimistic: the rows show it at once, the write follows; a failed write reverts the rows, keeps the note in its
// field and raises a toast with «Повторить» that stays until closed. A later verdict replaces the earlier one; none
// is ever cleared. A note being typed is a draft in the view's store, by finding id: it outlives a collapse, a page
// change and a live re-render, and the detail says, in a line reserved for it, while the note is not saved (ux 4).
import { useId, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Finding, UserVerdict } from "../../../shared/model.ts";
import { VERDICT, type Verdict } from "../../../shared/states.ts";
import { useApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AppDialog, ChoiceToggles, notify, RETRY, useShortcut } from "@/ui";
import {
  DIALOG_PROMPT,
  failedCause,
  NOTE_LABEL,
  NOTE_PLACEHOLDER,
  NOTE_SAVE,
  NOTE_UNSAVED,
  NOTE_UNSAVED_FIRST,
  SAVE_FAILED,
  SECTION,
  verdictLine,
  verdictTitle,
  verdictValue,
  VERDICT_PROMPT,
} from "@/finding/words.ts";

export const VERDICTS = Object.keys(VERDICT) as Verdict[];
/** The verdicts' keys, in their order: 1 «согласен» … 4 «ложная находка» (craft-review cand-4; physical keys,
 * rules/ui → Conventions 11). */
export const VERDICT_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4"] as const;

/** Binds 1–4 to `rate` with the verdict of that place; the shortcut hook keeps them off in a text field and under a
 * dialog. */
export function useVerdictKeys(rate: (verdict: Verdict) => void): void {
  useShortcut(VERDICT_KEYS[0], () => rate(VERDICTS[0]));
  useShortcut(VERDICT_KEYS[1], () => rate(VERDICTS[1]));
  useShortcut(VERDICT_KEYS[2], () => rate(VERDICTS[2]));
  useShortcut(VERDICT_KEYS[3], () => rate(VERDICTS[3]));
}
/** The words of a verdict toggle's tooltip before its key's cap: «Оценить клавишей 1» (design-10; ui → Tooltip). */
export const VERDICT_KEY_HINT = "Оценить клавишей";
/** The server's bound on a note (server/http.ts). */
export const NOTE_MAX = 4000;
/** The dialog's lead on a selection: what one choice does to every selected finding. */
export const SELECTION_PROMPT = "Выберите оценку — она сразу сохранится для каждой выбранной находки вместе с заметкой";

// ── drafts: the notes being typed, by finding id ────────────────────────────────────────────────

interface Drafts {
  get: (id: string) => string | undefined;
  set: (id: string, text: string | undefined) => void;
  subscribe: (listener: () => void) => () => void;
}

/** A store outside React's state: a keystroke redraws its own field, never the table around it. */
function createDrafts(): Drafts {
  const texts = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    get: (id) => texts.get(id),
    set(id, text) {
      if (texts.get(id) === text) return;
      if (text === undefined) texts.delete(id);
      else texts.set(id, text);
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export interface Verdicts {
  /** The verdict a row shows: the user's newest one, saved or still on its way. */
  of: (f: Pick<Finding, "id" | "verdict">) => UserVerdict | null;
  /** The note typed for a finding and not yet saved — or left by a failed write, until a write of it succeeds. */
  draft: (id: string) => string | undefined;
  setDraft: (id: string, text: string) => void;
  subscribe: (listener: () => void) => () => void;
  save: (ids: readonly string[], verdict: Verdict, note: string) => void;
  /** Changes whenever a shown verdict does: a key for the rows' memo. */
  version: number;
}

/** A finding's draft, read so that only its own field redraws as it changes. */
export const useDraft = (verdicts: Pick<Verdicts, "draft" | "subscribe">, id: string): string | undefined => useSyncExternalStore(verdicts.subscribe, () => verdicts.draft(id));

/** The view's verdicts: the run's own, with the user's newer ones laid over them until the run re-reads them. */
export function useVerdicts(runKey: string, now: number): Verdicts {
  // the write goes through the API module: `POST /api/verdict`, or the tests' own handler
  const api = useApi();
  const [overlay, setOverlay] = useState<Readonly<Record<string, UserVerdict>>>({});
  const [drafts] = useState(createDrafts);
  const [version, setVersion] = useState(0);

  function save(ids: readonly string[], verdict: Verdict, note: string) {
    const kept = note.trim() || null;
    const mine: UserVerdict = { verdict, note: kept, at: new Date(now).toISOString() };
    // settles this write's own entries only: a later verdict on the same finding keeps its place
    const settle = (o: Readonly<Record<string, UserVerdict>>, put: UserVerdict | null) => {
      const next = { ...o };
      for (const id of ids) {
        if (next[id] !== mine) continue;
        if (put) next[id] = put;
        else delete next[id];
      }
      return next;
    };
    setOverlay((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, mine])) }));
    setVersion((v) => v + 1);
    void (async () => {
      let saved: UserVerdict | null = null;
      let cause = "";
      try {
        saved = await api.verdict({ run: runKey, findings: [...ids], verdict, note: kept });
      } catch (e) {
        cause = e instanceof Error ? e.message : String(e);
      }
      if (saved) {
        const done = saved;
        setOverlay((o) => settle(o, done));
        // the saved note is the field's text now; a text typed on since stays a draft
        for (const id of ids) if (drafts.get(id) === note) drafts.set(id, undefined);
      } else {
        // the rows go back to what the run holds; the note stays in its field for another try
        setOverlay((o) => settle(o, null));
        for (const id of ids) drafts.set(id, note);
        notify.error(SAVE_FAILED, { cause: failedCause(cause), action: { label: RETRY, onClick: () => save(ids, verdict, note) } });
      }
      setVersion((v) => v + 1);
    })();
  }

  return {
    of: (f) => {
      const o = overlay[f.id];
      const s = f.verdict;
      if (!o) return s;
      return !s || !s.at || !o.at || o.at >= s.at ? o : s;
    },
    draft: drafts.get,
    setDraft: drafts.set,
    subscribe: drafts.subscribe,
    save,
    version,
  };
}

// ── the control ─────────────────────────────────────────────────────────────────────────────────

export interface VerdictControlProps {
  /** The verdict pressed: the saved one, or the one every selected finding shares. */
  value: Verdict | null;
  /** The line above the choices: the saved verdict with its time, or what choosing does. */
  lead: string;
  note: string;
  onNoteChange: (text: string) => void;
  /** Saves the verdict with the note; choosing the pressed verdict again saves a changed note. */
  onChoose: (verdict: Verdict) => void;
  /** The detail: the choices right under the line, the note after them, and the note's reserved status line.
   * The dialog («note-first»): the note is written first, then a choice saves it and closes. */
  order?: "choice-first" | "note-first";
  /** The note's status in the detail: whether its text differs from the saved one, and how to save it alone. */
  noteStatus?: { unsaved: boolean; onSave: (() => void) | null };
  autoFocusNote?: boolean;
  /** The detail's keys, one per verdict in its order, each shown as a `Kbd` cap in its own toggle's tooltip
   * (Conventions 11). The dialog has none: its note takes the keys. */
  keys?: readonly string[];
}

export function VerdictControl({ value, lead, note, onNoteChange, onChoose, order = "choice-first", noteStatus, autoFocusNote = false, keys }: VerdictControlProps) {
  const id = useId();
  // the shared choice toggles (improve-2): the pressed verdict in ink; each toggle's own key in its own tooltip
  const choice: ReactNode = (
    <div data-slot="verdict-choice" className="flex min-w-0 flex-col gap-1.5">
      {/* one line, always there: saving never moves what follows (Strict 1) */}
      <p data-slot="verdict-line" role="status" className="m-0 h-5 truncate" title={lead}>
        {lead}
      </p>
      <ChoiceToggles label={SECTION.verdict} value={value} choices={VERDICTS.map((v, i) => ({ value: v, label: VERDICT[v].compact, keyCode: keys?.[i] }))} onChoose={onChoose} keyHint={VERDICT_KEY_HINT} />
    </div>
  );
  const field: ReactNode = (
    <Field className="gap-1">
      <FieldLabel htmlFor={`${id}-note`} className="text-xs font-normal text-muted-foreground">
        {NOTE_LABEL}
      </FieldLabel>
      <Textarea
        id={`${id}-note`}
        value={note}
        maxLength={NOTE_MAX}
        placeholder={NOTE_PLACEHOLDER}
        autoFocus={autoFocusNote}
        onChange={(e) => onNoteChange(e.target.value)}
        className="field-sizing-fixed h-16 max-h-40 min-h-16 resize-y bg-background text-sm"
      />
      {noteStatus && (
        // reserved whether or not the note is saved: the cue and its button never move a thing (Strict 1)
        <div data-slot="note-status" className="flex h-6 min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span role="status" className="min-w-0 truncate">
            {noteStatus.unsaved ? (noteStatus.onSave ? NOTE_UNSAVED : NOTE_UNSAVED_FIRST) : null}
          </span>
          {noteStatus.unsaved && noteStatus.onSave && (
            <Button type="button" variant="outline" size="xs" className="shrink-0" onClick={noteStatus.onSave}>
              {NOTE_SAVE}
            </Button>
          )}
        </div>
      )}
    </Field>
  );
  return (
    <div data-slot="verdict-control" className="flex max-w-measure min-w-0 flex-col gap-3">
      {order === "note-first" ? (
        <>
          {field}
          {choice}
        </>
      ) : (
        <>
          {choice}
          {field}
        </>
      )}
    </div>
  );
}

/** The words the verdict line of the finding a key rated last adds when no finding of the list is left without a
 * verdict (improve-14): the keys stop there, and say why. */
export const ALL_RATED = "в этом списке всё оценено";

/** «согласен · 19:41 МСК · в этом списке всё оценено»: the saved value and its time first, so the line's cut takes only
 * the list's words (craft-4). */
export const allRatedLine = (v: Pick<UserVerdict, "verdict" | "at">, now: number | string): string => `${verdictValue(v, now)} · ${ALL_RATED}`;

/** The detail's verdict, under the article's heading «Ваша оценка»: the choices first, then the note — the saved
 * one, or the draft being typed, with the line that says it is not saved yet. `listRated` — this finding's key rated
 * the list's last one without a verdict: its line adds so after the saved value until the next choice. */
export function FindingVerdict({ finding, verdicts, now, listRated = false }: { finding: Finding; verdicts: Verdicts; now: number; listRated?: boolean }) {
  const saved = finding.verdict;
  const draft = useDraft(verdicts, finding.id);
  const note = draft ?? saved?.note ?? "";
  const unsaved = note.trim() !== (saved?.note ?? "");
  const save = (v: Verdict) => verdicts.save([finding.id], v, note);
  return (
    <VerdictControl
      value={saved?.verdict ?? null}
      lead={saved && listRated ? allRatedLine(saved, now) : saved ? verdictValue(saved, now) : VERDICT_PROMPT}
      note={note}
      onNoteChange={(text) => verdicts.setDraft(finding.id, text)}
      onChoose={save}
      noteStatus={{ unsaved, onSave: saved ? () => save(saved.verdict) : null }}
      keys={VERDICT_KEYS}
    />
  );
}

/** «Оценить…»: the same control over one finding or a selection, one note for all; choosing saves and closes. */
export function VerdictDialog({ rows, verdicts, now, onClose }: { rows: readonly Finding[] | null; verdicts: Verdicts; now: number; onClose: () => void }) {
  const ids = useMemo(() => (rows ?? []).map((r) => r.id), [rows]);
  const shared = rows && rows.length && rows.every((r) => r.verdict?.verdict === rows[0].verdict?.verdict) ? (rows[0].verdict?.verdict ?? null) : null;
  const first = rows?.[0];
  const draft = first ? verdicts.draft(first.id) : undefined;
  const sameDraft = rows?.every((r) => verdicts.draft(r.id) === draft);
  const [note, setNote] = useState<string | null>(null);
  const text = note ?? (sameDraft && draft !== undefined ? draft : rows?.length === 1 ? (first?.verdict?.note ?? "") : "");
  const close = () => {
    setNote(null);
    onClose();
  };
  return (
    <AppDialog
      open={rows !== null && rows.length > 0}
      onOpenChange={(open) => !open && close()}
      title={verdictTitle(ids)}
      returnFocus={() => [...document.querySelectorAll<HTMLElement>("tr[data-row-id]")].find((tr) => tr.dataset.rowId === ids[0])}
      className="sm:max-w-lg"
    >
      {rows && rows.length > 0 && (
        <VerdictControl
          value={shared}
          lead={rows.length === 1 && first?.verdict ? verdictLine(first.verdict, now) : rows.length === 1 ? DIALOG_PROMPT : SELECTION_PROMPT}
          note={text}
          onNoteChange={setNote}
          onChoose={(v) => {
            verdicts.save(ids, v, text);
            close();
          }}
          order="note-first"
          autoFocusNote
        />
      )}
    </AppDialog>
  );
}
