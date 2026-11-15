import type { Id } from "../../convex/_generated/dataModel";

// TODO(SEA-3 D): hosted Whop page in an in-app browser vs our own checkout UI.
// TODO(SEA-3 E): how two buyers are kept from paying for the same item.
// TODO(SEA-3 G): contract with convex/http.ts (createPending/markPaid, endpoint path, redirect deep link to /buyer/paid?orderId=).
export async function startCheckout(garageId: Id<"garages">, itemIds: Id<"items">[]): Promise<void> {
  throw new Error(`Checkout isn't connected yet (${itemIds.length} items in garage ${garageId}).`);
}
