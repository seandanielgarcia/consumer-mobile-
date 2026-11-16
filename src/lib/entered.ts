import { useSyncExternalStore } from "react";

let entered = false;
const listeners = new Set<() => void>();

export function markEntered() {
  if (entered) return;
  entered = true;
  listeners.forEach((listener) => listener());
}

export function useEntered(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entered,
  );
}
