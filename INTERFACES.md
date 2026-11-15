# Interfaces

Shared contract for the Garage Sale app. Convex dev deployment: `https://fleet-gnat-219.convex.cloud` (set `EXPO_PUBLIC_CONVEX_URL` from `.env.example`).

## Tables (`convex/schema.ts`)

| Table | Fields | Indexes |
| --- | --- | --- |
| users | name: string, phone: string, avatarColor: string | by_phone |
| garages | ownerId: Id<"users">, neighborhood: string, approxLat: number, approxLng: number, isOpen: boolean | by_owner |
| items | garageId: Id<"garages">, photoUrl: string, storageId?: Id<"_storage">, title: string, size: string, description: string, priceCents: number, status: "draft" \| "live" \| "reserved" \| "sold", aiGenerated: boolean | by_garage, by_status, search_title, search_description |
| orders | buyerId: Id<"users">, garageId: Id<"garages">, itemIds: Id<"items">[], totalCents: number, whopCheckoutId?: string, status: "pending" \| "paid" \| "picked_up" \| "cancelled" | by_garage, by_status |

Notes:

- **Search:** two search indexes on `items`, `search_title` (title) and `search_description` (description), both with filterField `status`. Buyer search queries both with `.eq("status", "live")` and merges by id. Only `live` items are ever returned.
- **Location:** no address fields exist anywhere. Every garage insert/patch must pass lat/lng through `roundCoord` from `convex/lib/location.ts` (0.01°, about 1 km). `haversineMiles` computes buyer distance; search radius is 2 mi.
- **storageId** is optional, for photos uploaded to Convex file storage; `photoUrl` is always set.

## Integration points (proposed, pending Sean/Hailey)

These will be **internal** Convex functions owned by Capy (`internalMutation`/`internalAction`), called via `ctx.runMutation`/`ctx.runAction` from Sean's `convex/http.ts` and Hailey's Keiki routes. Names and signatures are proposals until Sean and Hailey confirm.

| Function (proposed) | Caller | Behavior |
| --- | --- | --- |
| `internal.orders.create({ buyerId, garageId, itemIds })` → `{ orderId, totalCents }` | Sean's create-checkout endpoint | Validates all items are `live` and in one garage, inserts a `pending` order. Sean then creates the Whop checkout and calls `internal.orders.setCheckoutId({ orderId, whopCheckoutId })`. |
| `internal.orders.markPaid({ orderId })` | Sean's `payment.succeeded` webhook | Atomically sets order `paid` and its items `reserved`; fails if any item is no longer `live` (two buyers can't pay for the same item). Returns seller name/phone for the text. |
| `internal.items.addFromKeiki({ phone, photoUrl, priceCents })` | Hailey's Keiki `add_item` route | Finds the garage by `users.by_phone`, runs the AI photo step, inserts the item as `live`. |

`convex/http.ts` belongs to Sean; Keiki agent/tool/prompt files belong to Hailey. This repo's scaffold creates neither.
