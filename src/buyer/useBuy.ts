import { useConvex, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { requireUser, SignInCancelled } from "../lib/useCurrentUser";
import { startCheckout } from "./checkout";

export const PAYMENT_FAILED = "Payment didn't go through. Your items are held for 10 min.";

const HOLD_MS = 10 * 60 * 1000;

export function useBuy(garageId: Id<"garages">, onUnavailable?: (itemId: Id<"items">) => void) {
  const convex = useConvex();
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<{ id: Id<"orders">; createdAt: number } | null>(null);
  const orderId = order?.id ?? null;
  const checkingOut = useRef(false);
  const status = useQuery(api.orders.getOrder, orderId ? { orderId } : "skip");
  const orderPaid = status?.status === "paid" || status?.status === "picked_up";

  useEffect(() => {
    if (!orderPaid || !orderId) return;
    checkingOut.current = true;
    router.replace({ pathname: "/buyer/paid", params: { orderId } });
  }, [orderPaid, orderId]);

  const buy = async (itemIds: Id<"items">[]) => {
    if (checkingOut.current || itemIds.length === 0) return;
    checkingOut.current = true;
    setBuying(true);
    setError(null);
    let paid = false;
    try {
      let buyer: Id<"users">;
      try {
        buyer = await requireUser("Sign in to buy");
      } catch (error) {
        if (!(error instanceof SignInCancelled)) setError("Couldn't sign you in. Try again.");
        return;
      }

      const result = await startCheckout(convex, buyer, garageId, itemIds, (id) => setOrder({ id, createdAt: Date.now() }));
      if (result.paid) {
        paid = true;
        return;
      }
      setError(PAYMENT_FAILED);
    } catch (error) {
      const data = error instanceof ConvexError ? error.data : undefined;
      if (onUnavailable && data?.code === "ITEM_UNAVAILABLE" && itemIds.includes(data.itemId)) {
        onUnavailable(data.itemId);
      } else {
        setError(typeof data?.message === "string" ? data.message : "Something went wrong. Try again.");
      }
    } finally {
      // Keep the paid cart guarded until the replacement screen unmounts it.
      if (!paid) {
        checkingOut.current = false;
        setBuying(false);
      }
    }
  };

  const holding = status?.status === "pending" && !!order && Date.now() - order.createdAt < HOLD_MS;
  const myOrderItemIds = status && (orderPaid || holding) ? status.items.map((i) => i._id) : [];
  return { buy, buying, error, checkingOut, myOrderItemIds };
}
