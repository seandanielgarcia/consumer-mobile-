import type { ConvexReactClient } from "convex/react";
import { anyApi } from "convex/server";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

function waitForReturn(purchaseUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (returned: boolean) => {
      if (settled) return;
      settled = true;
      subscription.remove();
      resolve(returned);
    };
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!url.startsWith("garagesale://buyer/paid")) return;
      WebBrowser.dismissBrowser();
      finish(true);
    });
    WebBrowser.openBrowserAsync(purchaseUrl).then(
      () => finish(false),
      () => finish(false),
    );
  });
}

export async function startCheckout(
  convex: ConvexReactClient,
  buyerId: Id<"users">,
  garageId: Id<"garages">,
  itemIds: Id<"items">[],
): Promise<{ orderId: Id<"orders">; returned: boolean }> {
  const { orderId } = await convex.mutation(api.orders.createPending, { buyerId, garageId, itemIds });
  const { purchaseUrl } = (await convex.action(anyApi.whop.createOrderCheckout, { orderId })) as { purchaseUrl: string };
  const returned = await waitForReturn(purchaseUrl);
  if (returned) await convex.mutation(api.orders.confirmReturn, { orderId });
  return { orderId, returned };
}
