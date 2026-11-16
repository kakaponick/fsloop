// Frames (rules/ui → Layout 7; ui → Wheel): a thumbnail reserves its box before the image loads, so the list never
// shifts; a frame opens in a viewer over the page, named by its file, and steps through the set by ‹ ›, ←/→ and the
// wheel — one step per gesture, stopping at the ends; Escape closes it and focus returns to the thumbnail.
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useRef, useState, type WheelEvent } from "react";
import { count, NOUNS } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Hint } from "./tooltip.tsx";

export interface Frame {
  /** The image's address. */
  src: string;
  /** The file's name: «p1-final-shell.png». */
  name: string;
}

/** A wheel gesture ends after this pause; the next event starts a new step. */
export const WHEEL_GESTURE_GAP = 200;

/** The thumbnail's box is fixed by the theme's tokens before the image loads: 118 × 74 px. */
export const THUMB = { width: 118, height: 74 } as const;

export interface FrameThumbProps {
  frame: Frame;
  onOpen: () => void;
  ref?: React.Ref<HTMLButtonElement>;
}

export function FrameThumb({ frame, onOpen, ref }: FrameThumbProps) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      data-slot="frame-thumb"
      aria-label={`Открыть кадр ${frame.name}`}
      className="h-thumb-h w-thumb-w shrink-0 cursor-zoom-in overflow-hidden rounded-sm bg-muted p-0"
      onClick={onOpen}
    >
      <img src={frame.src} alt="" width={THUMB.width} height={THUMB.height} loading="lazy" decoding="async" className="size-full object-cover object-top" />
    </Button>
  );
}

export interface FrameViewerProps {
  frames: readonly Frame[];
  /** The open frame, or null when the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** Where focus lands on close: the thumbnail that opened the frame. */
  returnFocus?: () => HTMLElement | null | undefined;
  /** The clock of the wheel's gesture; a test passes its own. */
  now?: () => number;
}

export function FrameViewer({ frames, index, onIndexChange, returnFocus, now = () => performance.now() }: FrameViewerProps) {
  const lastWheel = useRef(Number.NEGATIVE_INFINITY);
  const stage = useRef<HTMLDivElement>(null);
  const open = index !== null && frames.length > 0;
  const at = Math.min(Math.max(index ?? 0, 0), Math.max(frames.length - 1, 0));
  const frame = frames[at];
  const step = (by: number) => {
    const next = at + by;
    if (next >= 0 && next < frames.length) onIndexChange(next);
  };
  const onWheel = (event: WheelEvent) => {
    const t = now();
    const fresh = t - lastWheel.current > WHEEL_GESTURE_GAP;
    lastWheel.current = t;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (fresh && delta !== 0 && frames.length > 1) step(delta > 0 ? 1 : -1);
  };
  const first = at === 0;
  const last = at === frames.length - 1;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      {frame && (
        <DialogContent
          showCloseButton={false}
          data-slot="frame-viewer"
          className="flex w-auto max-w-none flex-col gap-2 p-3 sm:max-w-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            stage.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            const target = returnFocus?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") step(1);
            else if (event.key === "ArrowLeft") step(-1);
            else return;
            event.preventDefault();
          }}
        >
          <div className="flex items-center gap-3">
            <DialogTitle className="min-w-0 truncate font-mono text-xs font-normal">{frame.name}</DialogTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {at + 1} из {count(frames.length, NOUNS.frame)}
            </span>
            <DialogDescription className="sr-only">← и → или колесо листают кадры, Esc закрывает просмотр</DialogDescription>
            <Hint label="Закрыть" keys={["Escape"]}>
              <DialogClose asChild>
                <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Закрыть">
                  <XIcon />
                </Button>
              </DialogClose>
            </Hint>
          </div>
          <div className="flex items-center gap-2">
            <Hint label="Предыдущий кадр" keys={["ArrowLeft"]}>
              <Button variant="outline" size="icon" aria-label="Предыдущий кадр" aria-disabled={first} className={cn(first && "opacity-50")} onClick={() => step(-1)}>
                <ChevronLeftIcon />
              </Button>
            </Hint>
            <div ref={stage} tabIndex={-1} data-slot="frame-stage" className="flex h-stage-h w-stage-w items-center justify-center overflow-hidden rounded-md bg-muted outline-none" onWheel={onWheel}>
              <img key={frame.src} src={frame.src} alt={`Кадр ${frame.name}`} className="max-h-full max-w-full object-contain" />
            </div>
            <Hint label="Следующий кадр" keys={["ArrowRight"]}>
              <Button variant="outline" size="icon" aria-label="Следующий кадр" aria-disabled={last} className={cn(last && "opacity-50")} onClick={() => step(1)}>
                <ChevronRightIcon />
              </Button>
            </Hint>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

export interface FrameStripProps {
  frames: readonly Frame[];
  /** Thumbnails shown before «ещё N»; the viewer steps through every frame. */
  limit?: number;
  now?: () => number;
  className?: string;
}

/** A finding's or a report's frames: thumbnails in reserved boxes, «ещё N кадров» past the limit, one viewer. */
export function FrameStrip({ frames, limit = 16, now, className }: FrameStripProps) {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const thumbs = useRef(new Map<number, HTMLButtonElement>());
  const more = useRef<HTMLButtonElement>(null);
  const shown = frames.slice(0, limit);
  const rest = frames.length - shown.length;
  const openAt = (i: number, from: HTMLElement | null) => {
    opener.current = from;
    setOpen(i);
  };
  return (
    <div data-slot="frame-strip" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((frame, i) => (
        <FrameThumb
          key={frame.src}
          frame={frame}
          ref={(el) => {
            if (el) thumbs.current.set(i, el);
            else thumbs.current.delete(i);
          }}
          onOpen={() => openAt(i, thumbs.current.get(i) ?? null)}
        />
      ))}
      {rest > 0 && (
        <Button ref={more} variant="outline" className="h-thumb-h" onClick={() => openAt(limit, more.current)}>
          ещё {count(rest, NOUNS.frame)}
        </Button>
      )}
      <FrameViewer frames={frames} index={open} onIndexChange={setOpen} now={now} returnFocus={() => opener.current} />
    </div>
  );
}
