# AGENTS.md: Garage Sale

Garage Sale is an iOS app where people bulk-upload photos of clothes, AI writes each listing, buyers within about 2 mi search and pick items, and they pay through Whop for local pickup. The source of truth is the handoff in Capy Drive: `garage-sale-handoff/PRD.md`, `garage-sale-handoff/DRIVERS.md`, and the mockups in `garage-sale-handoff/mockups/*.dc.html` (project drive). When this file and the PRD disagree, the PRD wins; when the PRD's prose and a mockup disagree, build the mockup and flag the difference to the requirement's driver.

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
| Capy | App screens, schema, seed data, AI photo step, item and order queries/mutations | `app/`, `components/`, `lib/`, `convex/schema.ts`, `convex/items.ts`, `convex/garages.ts`, `convex/orders.ts`, `convex/users.ts`, `convex/ai.ts`, `convex/seed.ts` |
| Sean | Whop checkout endpoint, `payment.succeeded` webhook, Revyl QA | `convex/http.ts`, `convex/whop.ts` |
| Hailey | Keiki agent, its tools and how it talks | `convex/keiki/` |

Mounting the Keiki routes in `convex/http.ts` is a one-line change that Sean approves.

## Commands

The repository starts empty. Once the Expo and Convex projects exist, keep this section current with the real commands. Expected:

- `npx convex dev` runs and syncs the Convex backend against the shared dev deployment.
- `npx expo start` runs the app.
- `npx tsc --noEmit` typechecks; run it before every push.

## Environment variables

Configured on the project's machines; never print, log, or commit their values, and never ship a secret in the app bundle.

| Variable | Used by |
| --- | --- |
| `ConvexKey` | Convex deploy/CLI access to the shared dev deployment |
| `OPENAI_API_KEY` | `convex/ai.ts` (set it as a Convex environment variable too) |
| `WHOP_API_KEY` | Creating checkout configurations, server side |
| `WHOP_WEBHOOK_SECRET` | Verifying `payment.succeeded` webhooks |
| `WHOP_ENVIRONMENT` | `sandbox` or production; selects the Whop API host |
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
- **Only `live` items appear in search**, within 2 mi (not adjustable), nearest first. Search matches title and description.
- **Reserving happens on the Whop `payment.succeeded` webhook**, not when the buyer taps Buy. The webhook sets the order to `paid`, its items to `reserved`, and texts the seller.
- **Two buyers can't pay for the same item.** Check every item is still `live` when creating the order and again in the webhook. If an item became `reserved` while it sat in someone's selection, remove it and tell the buyer before checkout.
- **One garage per checkout.**
- The seller can mark an item `sold` after pickup, or put it back to `live`. No timers for MVP.
- Clothes only: the AI prompt and the size filter assume clothing.
- Sign-in is phone number only.

## Whop checkout flow

1. On Buy, the server creates an `orders` row (`pending`), then calls Create Checkout Configuration with an inline plan: `billing_type: "one_time"`, `initial_price` = cart total, `force_create_new_plan: true`, `metadata: { orderId }`.
2. The app opens the returned `purchase_url` in an in-app browser; `redirect_url` returns the buyer to the Paid screen.
3. The `payment.succeeded` webhook is verified with `WHOP_WEBHOOK_SECRET`, reads `orderId` from metadata, and does the reserve step above.

Contract between the buyer screens (Capy) and Sean's endpoint: input is `orderId`, `itemIds`, `totalCents`; output is `purchase_url`. Cut rule: if the webhook isn't working at the cut check, mark the order paid on the redirect back, and say so in the PR.

## AI photo step

One call per photo on the Price it screen, from a Convex action, returning JSON `{ title, size, description, suggestedPriceCents }`. Show a spinner per card until it returns. Three photos must fill in within 10 seconds, so run the calls in parallel. Keiki's `add_item` reuses this same step.

## Screens

Build to match the mockups exactly: Seller 1A Home → 2 Price it → 3 Garage open, and Buyer 1A Near you → 2 Garage → 3 Paid. The Paid screen has no mockup; follow the PRD spec. Map view (1B) and grouped-by-garage view (1C) are cut.

- 20px side padding, 56–60px top padding, buttons at least 44px tall and fully rounded, big CTAs 60px tall.
- Colors: brand blue `#2340FF`, cream `#FFF6E5`, price-tag yellow `#FFE14D`, ink `#111111`, muted text `#5A5245`. Keep them in one theme module, not inline.
- Type: headings in Bricolage Grotesque 800, body in Inter.
- Items look like polaroids with yellow price stickers.
- Copy is fixed: home headline "Clear your closet. Sell to people around you." and the AI label "Written by AI · tap to edit". Don't rewrite copy.

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
