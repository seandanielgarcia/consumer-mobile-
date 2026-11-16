import { useFocusEffect, useRoute } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

const handlers = new Map<string, () => void>();

export const headerBackHandler = (routeKey: string) => handlers.get(routeKey);

export function useHeaderBack(onPress: () => void) {
  const { key } = useRoute();
  const handler = useRef(onPress);
  handler.current = onPress;
  useEffect(() => {
    handlers.set(key, () => handler.current());
    return () => {
      handlers.delete(key);
    };
  }, [key]);
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
