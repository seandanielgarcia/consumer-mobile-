import type { ConvexReactClient } from "convex/react";
import { anyApi } from "convex/server";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function waitForReturn(purchaseUrl: string, returnUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (returned: boolean) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      resolve(returned);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith(returnUrl) && !url.startsWith("garagesale://buyer/paid")) return;
      finish(true);
      setTimeout(() => WebBrowser.dismissBrowser(), 300);
    });
    WebBrowser.openBrowserAsync(purchaseUrl).then(
      () => finish(false),
      () => finish(false),
    );
  });
}

export const PAID_GRACE_MS = 10000;

export async function waitForPaid(convex: ConvexReactClient, orderId: Id<"orders">): Promise<boolean> {
  const deadline = Date.now() + PAID_GRACE_MS;
  while (true) {
    const status = (await convex.query(api.orders.getOrder, { orderId }).catch(() => null))?.status;
    if (status === "paid" || status === "picked_up") return true;
    if (status !== "pending" || Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function startCheckout(
  convex: ConvexReactClient,
  buyerId: Id<"users">,
  garageId: Id<"garages">,
  itemIds: Id<"items">[],
  onOrder: (orderId: Id<"orders">) => void,
): Promise<{ orderId: Id<"orders">; paid: boolean }> {
  const { orderId } = await convex.mutation(api.orders.createPending, { buyerId, garageId, itemIds });
  const returnUrl = Linking.createURL("buyer/paid", { queryParams: { garageId, items: itemIds.join(",") } });
  onOrder(orderId);
  const { purchaseUrl } = (await convex.action(anyApi.whop.createOrderCheckout, { orderId, returnUrl })) as { purchaseUrl: string };
  const returned = await waitForReturn(purchaseUrl, returnUrl);
  if (!returned) {
    const status = (await convex.query(api.orders.getOrder, { orderId }).catch(() => null))?.status;
    return { orderId, paid: status === "paid" || status === "picked_up" };
  }
  await convex.mutation(api.orders.confirmReturn, { orderId }).catch(() => undefined);
  return { orderId, paid: await waitForPaid(convex, orderId) };
}
