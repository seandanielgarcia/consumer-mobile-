import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSyncExternalStore } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type CurrentUser = { userId: Id<"users">; name?: string };

const STORAGE_KEY = "garage-sale/user";

let current: CurrentUser | null = null;
let loaded = false;
const listeners = new Set<() => void>();
let waiting: { resolve: (userId: Id<"users">) => void; reject: (error: Error) => void } | null = null;

const emit = () => listeners.forEach((listener) => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export class SignInCancelled extends Error {
  constructor() {
    super("Sign-in cancelled");
  }
}

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
  waiting?.resolve(user.userId);
  waiting = null;
}

export async function signOut() {
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  current = null;
  emit();
}

export function requireUser(): Promise<Id<"users">> {
  if (current) return Promise.resolve(current.userId);
  waiting?.reject(new SignInCancelled());
  return new Promise((resolve, reject) => {
    waiting = { resolve, reject };
    router.push("/signin");
  });
}

export function cancelSignIn() {
  waiting?.reject(new SignInCancelled());
  waiting = null;
}

export function useRequireUser() {
  return requireUser;
}

export function useCurrentUserLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => loaded);
}

export function useCurrentUser(): CurrentUser | null {
  return useSyncExternalStore(subscribe, () => current);
}
