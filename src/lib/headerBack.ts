import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useSyncExternalStore } from "react";

type HeaderBack = { onPress: () => void; owner: object };

let current: HeaderBack | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useHeaderBackState(): HeaderBack | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function useHeaderBack(onPress: () => void) {
  const handler = useRef(onPress);
  handler.current = onPress;
  useFocusEffect(
    useCallback(() => {
      const owner = {};
      current = { onPress: () => handler.current(), owner };
      emit();
      return () => {
        if (current?.owner !== owner) return;
        current = null;
        emit();
      };
    }, []),
  );
}

type LeaveGuard = (leave: () => void) => void;
let guard: LeaveGuard | null = null;

export function guardedLeave(leave: () => void) {
  if (guard) return guard(leave);
  leave();
}

export function useLeaveGuard(onLeave: LeaveGuard) {
  const handler = useRef(onLeave);
  handler.current = onLeave;
  useFocusEffect(
    useCallback(() => {
      const mine: LeaveGuard = (leave) => handler.current(leave);
      guard = mine;
      return () => {
        if (guard === mine) guard = null;
      };
    }, []),
  );
}
