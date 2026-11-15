# AGENTS.md: yard sale (formerly Garage Sale)

yard sale is an iOS app where people bulk-upload photos of things to sell, AI writes each listing, buyers within about 2 mi search and pick items, and they pay through Whop for local pickup. The source of truth is the handoff in Capy Drive: `garage-sale-handoff/PRD.md`, `garage-sale-handoff/DRIVERS.md`, and the mockups in `garage-sale-handoff/mockups/*.dc.html` (project drive). The product decisions recorded in this file override the PRD; otherwise, when this file and the PRD disagree, the PRD wins; when the PRD's prose and a mockup disagree, build the mockup and flag the difference to the requirement's driver.

## Product decisions since the PRD

These override the PRD and the mockups.

- **Name:** the product is "yard sale" (lowercase). User-facing text says "yard" instead of "garage" ("Your yard", "Open my yard", "Hailey's yard"). Code identifiers (`garages`, `garageId`) stay as they are. (Hailey)
- **Anything sells**, not just clothes. Size is optional and shown only when it applies; the AI also extracts category, brand, condition and colour. (Hailey, overriding PRD Decision 5)
- **Review queue replaces the Price it list:** one item per screen with Approve, Edit and Skip, then a summary. (Hailey)
- **Landing and Home:** signed-out or first-time users see the two-path landing ("Sell your stuff" / "Shop near you" over a polaroid stack); sign-in is asked for only at "Open my yard" or Buy. A seller with a yard gets Home as their yard: an editable grid using the review queue's Edit card, Reserved and Sold stickers, Sold and Put back per item, "Add more" (library or camera into the review queue) and "Shop near you". (Compass for Hailey)
- **Keiki card on Yard open** is one line, "More later? Text Keiki a pic and a price.", plus "Save Keiki to contacts". (Compass)
- **Radius:** buyers pick 1, 2, 5 or 10 mi (default 2 mi). (Sean)
- **Sign-in:** a phone number verified by a code sent through Keiki, plus a first name. (Sean)
- **No AI label:** AI-written fields just appear filled in and editable. (Sean)

## Stack

- **App:** Expo (React Native, TypeScript, expo-router), iOS only, demoed on one phone. Design every screen for a 390×844 iPhone.
- **Backend:** Convex, one shared dev deployment for everyone. Convex live queries are how new items reach buyer search without a refresh, so read data with `useQuery`, never by polling.
- **AI:** OpenAI vision, called from a Convex action, never from the app.
- **Payments:** Whop, server side only, sandbox first (`sandbox-api.whop.com`). No Whop-branded UI in the app.
- **Texting:** Keiki (iMessage agent) calls our Convex HTTP tools. Stretch goal.
- **QA:** Revyl runs demo steps 1–4 on a real device.

## Lanes and file ownership

Three lanes never edit the same files. Stay in your lane; if you need a change in someone else's file, propose it to its owner instead of making it.

| Owner | Owns | Paths |
| --- | --- | --- |
| Capy | App screens, shared app code, schema, seed data, AI photo step, buyer search, item and order queries/mutations | `app/`, `src/` (`src/components/`, `src/lib/`, `src/buyer/`, `src/theme.ts`), `convex/schema.ts`, `convex/items.ts`, `convex/garages.ts`, `convex/buyer.ts`, `convex/orders.ts`, `convex/users.ts`, `convex/ai.ts`, `convex/seed.ts`, `convex/lib/`, `scripts/` |
| Sean | Whop checkout endpoint, `payment.succeeded` webhook, Revyl QA | `convex/http.ts`, `convex/whop.ts`, `qa/` |
| Hailey | Keiki agent, its tools and how it talks | `convex/keiki.ts`, `convex/keikiHttp.ts` |

`convex/http.ts` mounts the Keiki routes with `registerKeikiRoutes(http)` from `convex/keikiHttp.ts`; changing that mount is Sean's call.

## Commands

- `npm ci` installs dependencies.
- `npx tsc --noEmit` typechecks; run it before every push.
- `npx convex dev` runs and syncs the Convex backend against the shared dev deployment (`fleet-gnat-219`). It replaces every deployed function with your checkout's, so only push from a branch that contains everything currently deployed.
- `npx expo start` runs the app; set `EXPO_PUBLIC_CONVEX_URL` from `.env.example`.
- `scripts/seed.sh` uploads the seed photos and seeds the 3 demo garages.
- `scripts/create-dev-user.sh [phone] [name]` creates a dev user and prints its id for `EXPO_PUBLIC_DEV_USER_ID`.

Both scripts need `CONVEX_DEPLOY_KEY` set to the dev deploy key (`CONVEX_DEPLOY_KEY="$ConvexKey"` on Capy machines).

## Environment variables

Configured on the project's machines; never print, log, or commit their values, and never ship a secret in the app bundle.

| Variable | Used by |
| --- | --- |
| `ConvexKey` | Convex deploy/CLI access to the shared dev deployment |
| `OPENAI_API_KEY` | `convex/ai.ts` (set it as a Convex environment variable too) |
| `WHOP_API_KEY` | Creating checkout configurations, server side (set on fleet-gnat-219) |
| `WHOP_WEBHOOK_SECRET` | Verifying `payment.succeeded` webhooks (set on fleet-gnat-219) |
| `WHOP_ENVIRONMENT` | `sandbox` or `production`; selects the Whop API host (set to `sandbox` on fleet-gnat-219) |
| `KEIKI_API_KEY` | Keiki tools (added by Hailey when H5 is go) |

Only `EXPO_PUBLIC_*` variables may be read in app code, and none of them may hold a secret.

## Data model

Four Convex tables, defined in `convex/schema.ts`.

| Table | Fields | Notes |
| --- | --- | --- |
| users | name, phone, avatarColor | Phone is the sign-in and the link to Keiki texts |
| garages | ownerId, neighborhood, approxLat, approxLng, isOpen | Lat/lng rounded to about 0.01° (about 1 km) |
| items | garageId, photoUrl, title, size, description, priceCents, status, aiGenerated | status: `draft`, `live`, `reserved`, `sold` |
| orders | buyerId, garageId, itemIds, totalCents, whopCheckoutId, status | status: `pending`, `paid`, `picked_up`, `cancelled` |

Money is always integer cents.

## Rules that must hold

- **No exact address, ever.** Round coordinates to about 0.01° before they reach Convex; the app shows only the neighborhood and a rough distance ("about 1 mi"). This applies to the buyer's location too.
- **Only `live` items appear in search**, within the radius the buyer picks (1, 2, 5 or 10 mi; default 2 mi; the server clamps to 10), nearest first. Search matches title and description.
- **Reserving happens on the Whop `payment.succeeded` webhook**, not when the buyer taps Buy. The webhook sets the order to `paid`, its items to `reserved`, and texts the seller.
- **Two buyers can't pay for the same item.** Check every item is still `live` when creating the order and again in the webhook. If an item became `reserved` while it sat in someone's selection, remove it and tell the buyer before checkout.
- **One garage per checkout.**
- The seller can mark an item `sold` after pickup, or put it back to `live`. No timers for MVP.
- Sign-in is a phone number verified by a code (sent through Keiki), plus a first name.

## Whop checkout flow

1. On Buy, the server creates an `orders` row (`pending`), then calls Create Checkout Configuration with an inline plan: `billing_type: "one_time"`, `initial_price` = cart total, `force_create_new_plan: true`, `metadata: { orderId }`.
2. The app opens the returned `purchase_url` in an in-app browser; `redirect_url` returns the buyer to the Paid screen.
3. The `payment.succeeded` webhook is verified with `WHOP_WEBHOOK_SECRET`, reads `orderId` from metadata, and does the reserve step above.

Contract between the buyer screens (Capy) and Sean's endpoint: input is `orderId`, `itemIds`, `totalCents`; output is `purchase_url`. Cut rule: if the webhook isn't working at the cut check, mark the order paid on the redirect back, and say so in the PR.

## AI photo step

One call per photo on the Price it screen, from a Convex action, returning JSON `{ title, size, description, suggestedPriceCents }`. Show a spinner per card until it returns. Three photos must fill in within 10 seconds, so run the calls in parallel. Keiki's `add_item` reuses this same step.

## Screens

Build to match the mockups except where "Product decisions since the PRD" says otherwise: Landing / Home (yard), Review queue, Yard open, and Buyer Near you → Yard → Paid. The Paid screen has no mockup; follow the PRD spec. Map view (1B) and grouped-by-garage view (1C) are cut.

- 20px side padding, 56–60px top padding, buttons at least 44px tall and fully rounded, big CTAs 60px tall.
- Colors: brand blue `#2340FF`, cream `#FFF6E5`, price-tag yellow `#FFE14D`, ink `#111111`, muted text `#5A5245`. Keep them in one theme module, not inline.
- Type: headings in Bricolage Grotesque 800, body in Inter.
- Items look like polaroids with yellow price stickers.
- Don't show any AI label (no "Written by AI · tap to edit"): AI-written fields just appear filled in and editable.

## Seed data

Three fake garages near YC (Mission / Hayes Valley area) with about 10 real clothing photos, in `convex/seed.ts`, so a search for "jeans" returns results. Seed rows use rounded coordinates like everything else.

## Done criteria (demo)

1. The seller picks 3 photos; AI fills all 3 cards within 10 seconds; the seller prices them and opens the garage.
2. A buyer's search for "jeans" shows the new item within 2 seconds, with no refresh.
3. The buyer picks 2 items and pays (Whop sandbox).
4. The seller gets a "sold" text and both items show as reserved.
5. Bonus: the seller texts Keiki a pic and it appears in buyer search live.

## Working agreements

- Each requirement has a driver (see `DRIVERS.md`) who answers its questions, accepts it as done, and makes the cut call. Raise a cut before building around it.
- Post screenshots of every screen you change so its driver can reply "ok" or list fixes.
- Small PRs, one requirement each. Typecheck before pushing. Never merge without the owner asking.
