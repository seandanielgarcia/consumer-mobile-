import type { ConvexReactClient } from "convex/react";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export async function startCheckout(
  convex: ConvexReactClient,
  buyerId: Id<"users">,
  garageId: Id<"garages">,
  itemIds: Id<"items">[],
): Promise<Id<"orders">> {
  const { orderId } = await convex.mutation(api.orders.createPending, { buyerId, garageId, itemIds });
  const { purchaseUrl } = await convex.action(api.whop.createOrderCheckout, { orderId });
  await WebBrowser.openAuthSessionAsync(purchaseUrl, "garagesale://buyer/paid");
  await convex.mutation(api.orders.confirmReturn, { orderId });
  return orderId;
}
