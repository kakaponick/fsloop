// The one browser-storage module (ui → Persisted preferences; rules/ui → Tables 4): folds, «Подробнее», the pin
// and every table's view state. It is the single source of truth — read synchronously, so a persisted value is on
// the first paint, never a default that snaps; every read and write is guarded, so blocked storage only forgets.
import { useCallback, useSyncExternalStore } from "react";

const PREFIX = "fsloopui:";
const listeners = new Map<string, Set<() => void>>();
/** The value last written per key, also when storage refused it: the session keeps working without persistence. */
const memory = new Map<string, string | null>();

function rawRead(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function emit(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/** The stored value of `key`, or `fallback` when none is stored, storage is blocked or the value is not JSON. */
export function readPref<T>(key: string, fallback: T): T {
  const raw = rawRead(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Stores `value` under `key` (undefined removes it) and tells every reader of the key. */
export function writePref<T>(key: string, value: T | undefined): void {
  const raw = value === undefined ? null : JSON.stringify(value);
  memory.set(key, raw);
  try {
    if (raw === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, raw);
  } catch {
    // blocked or full storage: the value lives for this session only
  }
  emit(key);
}

/** Forgets the session's copies; a test calls it between cases. */
export function resetPrefsMemory(): void {
  memory.clear();
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFIX + key) {
      memory.delete(key);
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** A persisted preference as React state: the stored value on the first render, every writer and tab in sync. */
export function usePref<T>(key: string, fallback: T): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(key, listener), [key]),
    () => rawRead(key),
    () => null,
  );
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback((next: T) => writePref(key, next), [key]);
  return [value, set];
}
