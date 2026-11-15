import { isCheckingOut } from "../src/buyer/checkout";

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (!initial && isCheckingOut() && path.includes("buyer/paid")) return null;
  return path;
}
