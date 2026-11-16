// The browser tab's title (rules/ui → Conventions 9): «fsloopUI · <project> · <id> · <stage>», with «● » first when
// the open run changed while the tab was hidden — the third of the three change marks; it clears when the tab is
// seen again.
import { useEffect, useState, useSyncExternalStore } from "react";
import { PRODUCT, tabTitle } from "./words.ts";

/** The tab's visibility and the run's version, as one small store: «changed» is a version that moved while hidden. */
function createTracker() {
  let version: number | null = null;
  let atHide: number | null = null;
  let changed = false;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
  };
  const onVisibility = () => {
    const hidden = document.visibilityState === "hidden";
    atHide = hidden ? version : null;
    if (changed) {
      changed = false;
      emit();
    }
  };
  return {
    subscribe(listener: () => void) {
      if (!listeners.size) document.addEventListener("visibilitychange", onVisibility);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) document.removeEventListener("visibilitychange", onVisibility);
      };
    },
    changed: () => changed,
    setVersion(next: number | null) {
      if (next === version) return;
      if (document.visibilityState === "hidden" && atHide !== null && next !== null && next !== atHide && !changed) {
        changed = true;
        emit();
      }
      if (document.visibilityState === "hidden" && atHide === null) atHide = version;
      version = next;
    },
  };
}

/** Sets the tab's title for the open run; `run` null leaves the product's name alone. */
export function useRunTitle(run: { project: string; id: string; stage: string } | null, version: number | null) {
  const [tracker] = useState(createTracker);
  const changed = useSyncExternalStore(tracker.subscribe, tracker.changed, tracker.changed);
  useEffect(() => tracker.setVersion(version), [tracker, version]);
  const title = run ? tabTitle(run, changed) : PRODUCT;
  useEffect(() => {
    document.title = title;
  }, [title]);
}
