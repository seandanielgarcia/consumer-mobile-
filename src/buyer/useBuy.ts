import { useConvex } from "convex/react";
import { router } from "expo-router";
import { useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { requireUser, SignInCancelled } from "../lib/useCurrentUser";
import { startCheckout } from "./checkout";

export function useBuy(garageId: Id<"garages">) {
  const convex = useConvex();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkingOut = useRef(false);

  const buy = async (itemIds: Id<"items">[]) => {
    setError(null);
    let buyer: Id<"users">;
    try {
      buyer = await requireUser("Sign in to buy");
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError("Couldn't sign you in. Try again.");
      return;
    }
    setBuying(true);
    checkingOut.current = true;
    try {
      const { orderId, returned } = await startCheckout(convex, buyer, garageId, itemIds);
      if (returned) {
        router.replace({ pathname: "/buyer/paid", params: { orderId } });
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    }
    checkingOut.current = false;
    setBuying(false);
  };

  return { buy, buying, error, checkingOut };
}
