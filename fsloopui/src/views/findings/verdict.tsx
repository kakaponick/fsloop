// The user's verdict on a finding — fsloopUI's one write (rules/ui → Conventions 6; ux 6; ui → Toggles). One
// control in the finding's detail and in the «Оценить…» dialog: the four verdicts, an optional note, the saved
// line «Ваша оценка: согласен · 19:41 МСК». It is the user's own state, so it is optimistic: the rows show it at
// once, the write follows; a failed write reverts the rows, keeps the note in its field and raises a toast with
// «Повторить» that stays until closed. A later verdict replaces the earlier one; none is ever cleared.
import { createContext, useContext, useId, useMemo, useState } from "react";
import type { Finding, UserVerdict } from "../../../shared/model.ts";
import { VERDICT, type Verdict } from "../../../shared/states.ts";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AppDialog, notify, RETRY } from "@/ui";
import { failedCause, NOTE_LABEL, NOTE_PLACEHOLDER, SAVE_FAILED, SECTION, verdictLine, verdictTitle, VERDICT_PROMPT } from "@/finding/words.ts";

export const VERDICTS = Object.keys(VERDICT) as Verdict[];
/** The server's bound on a note (server/http.ts). */
export const NOTE_MAX = 4000;
export const NOTE_HINT = "Заметка сохраняется вместе с оценкой: выберите оценку ещё раз, чтобы сохранить новую заметку";
/** The dialog's lead on a selection: what one choice does to every selected finding. */
export const SELECTION_PROMPT = "Выберите оценку — она сразу сохранится для каждой выбранной находки вместе с заметкой";

// ── the write: a seam the tests answer through the server's own handler ────────────────────────

export interface VerdictBody {
  run: string;
  findings: string[];
  verdict: Verdict;
  note: string | null;
}

export type PostVerdict = (body: VerdictBody) => Promise<Response>;

export const httpPostVerdict: PostVerdict = (body) => fetch("/api/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

const PostContext = createContext<PostVerdict>(httpPostVerdict);
/** Where the view sends a verdict; the app's default is the server's `POST /api/verdict`. */
export const VerdictPostProvider = PostContext.Provider;

async function causeOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return `сервер ответил ${res.status}`;
}

export interface Verdicts {
  /** The verdict a row shows: the user's newest one, saved or still on its way. */
  of: (f: Pick<Finding, "id" | "verdict">) => UserVerdict | null;
  /** The note a failed write left for a finding, until a write of it succeeds. */
  draft: (id: string) => string | undefined;
  save: (ids: readonly string[], verdict: Verdict, note: string) => void;
  /** Changes whenever a shown verdict does: a key for the rows' memo. */
  version: number;
}

/** The view's verdicts: the run's own, with the user's newer ones laid over them until the run re-reads them. */
export function useVerdicts(runKey: string, now: number): Verdicts {
  const post = useContext(PostContext);
  const [overlay, setOverlay] = useState<Readonly<Record<string, UserVerdict>>>({});
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
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
        const res = await post({ run: runKey, findings: [...ids], verdict, note: kept });
        if (res.ok) saved = ((await res.json()) as { verdict: UserVerdict }).verdict;
        else cause = await causeOf(res);
      } catch (e) {
        cause = e instanceof Error ? e.message : String(e);
      }
      if (saved) {
        const done = saved;
        setOverlay((o) => settle(o, done));
        setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => !ids.includes(id))));
      } else {
        // the rows go back to what the run holds; the note stays in its field for another try
        setOverlay((o) => settle(o, null));
        setDrafts((d) => ({ ...d, ...Object.fromEntries(ids.map((id) => [id, note])) }));
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
    draft: (id) => drafts[id],
    save,
    version,
  };
}

// ── the control ─────────────────────────────────────────────────────────────────────────────────

export interface VerdictControlProps {
  /** The verdict pressed: the saved one, or the one every selected finding shares. */
  value: Verdict | null;
  /** The line above: the saved verdict with its time, or what choosing does. */
  lead: string;
  note: string;
  onNoteChange: (text: string) => void;
  /** Saves the verdict with the note; choosing the pressed verdict again saves a changed note. */
  onChoose: (verdict: Verdict) => void;
  autoFocusNote?: boolean;
}

export function VerdictControl({ value, lead, note, onNoteChange, onChoose, autoFocusNote = false }: VerdictControlProps) {
  const id = useId();
  return (
    <div data-slot="verdict-control" className="flex max-w-measure min-w-0 flex-col gap-2">
      {/* one line, always there: saving never moves what follows (Strict 1) */}
      <p data-slot="verdict-line" role="status" className="m-0 h-5 truncate" title={lead}>
        {lead}
      </p>
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
        <FieldDescription className="text-xs">{NOTE_HINT}</FieldDescription>
      </Field>
      {/* the four verdicts last: choosing one is the save, after the note is written */}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={SECTION.verdict}
        value={value ?? ""}
        onValueChange={(v) => {
          const chosen = (v || value) as Verdict | null;
          if (chosen) onChoose(chosen);
        }}
        className="flex-wrap"
      >
        {VERDICTS.map((v) => (
          <ToggleGroupItem key={v} value={v} className="data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground">
            {VERDICT[v].compact}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** The detail's verdict: the finding's saved verdict, the note it was saved with or the one being typed. */
export function FindingVerdict({ finding, verdicts, now }: { finding: Finding; verdicts: Verdicts; now: number }) {
  const saved = finding.verdict;
  // the text being typed lives here, so a keystroke redraws the field, not the table
  const [typed, setTyped] = useState<string | null>(null);
  const note = typed ?? verdicts.draft(finding.id) ?? saved?.note ?? "";
  return <VerdictControl value={saved?.verdict ?? null} lead={saved ? verdictLine(saved, now) : VERDICT_PROMPT} note={note} onNoteChange={setTyped} onChoose={(v) => verdicts.save([finding.id], v, note)} />;
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
          lead={rows.length === 1 && first?.verdict ? verdictLine(first.verdict, now) : rows.length === 1 ? VERDICT_PROMPT : SELECTION_PROMPT}
          note={text}
          onNoteChange={setNote}
          onChoose={(v) => {
            verdicts.save(ids, v, text);
            close();
          }}
          autoFocusNote
        />
      )}
    </AppDialog>
  );
}
