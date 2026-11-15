import type { ConvexReactClient } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// TODO(SEA-3 D): hosted Whop page in an in-app browser vs our own checkout UI. Built here as the in-app browser per the PRD steps.
// TODO(SEA-3 G): Sean's endpoint contract. It should take the orderId and return the Whop purchase_url.
async function getPurchaseUrl(orderId: Id<"orders">): Promise<string> {
  throw new Error(`Checkout isn't connected yet (order ${orderId} is waiting).`);
}

export async function startCheckout(
  convex: ConvexReactClient,
  buyerId: Id<"users">,
  garageId: Id<"garages">,
  itemIds: Id<"items">[],
): Promise<Id<"orders">> {
  const { orderId } = await convex.mutation(api.orders.createPending, { buyerId, garageId, itemIds });
  const url = await getPurchaseUrl(orderId);
  await WebBrowser.openAuthSessionAsync(url, "garagesale://buyer/paid");
  await convex.mutation(api.orders.confirmReturn, { orderId });
  return orderId;
}
