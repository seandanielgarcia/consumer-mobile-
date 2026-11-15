import type { Id } from "../../convex/_generated/dataModel";

export type CurrentUser = { userId: Id<"users"> };

// TODO(SEA-3 F): sign-in is undecided. Until it is, the app runs as the dev user whose id
// comes from EXPO_PUBLIC_DEV_USER_ID (create one with scripts/create-dev-user.sh, which calls
// users.getOrCreateByPhone). Replace this body with the real session once F is answered.
export function useCurrentUser(): CurrentUser | null {
  const userId = process.env.EXPO_PUBLIC_DEV_USER_ID;
  return userId ? { userId: userId as Id<"users"> } : null;
}
