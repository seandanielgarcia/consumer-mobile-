import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type CurrentUser = { userId: Id<"users"> };

const STORAGE_KEY = "garage-sale/user";

let current: CurrentUser | null = null;
let loaded = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export async function loadCurrentUser() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  current = stored ? (JSON.parse(stored) as CurrentUser) : null;
  loaded = true;
  emit();
}

export async function setCurrentUser(user: CurrentUser) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  current = user;
  emit();
}

export function useCurrentUserLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded);
}

export function useCurrentUser(): CurrentUser | null {
  return useSyncExternalStore(subscribe, () => current);
}
