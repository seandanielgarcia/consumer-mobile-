# Revyl demo QA

Revyl runs demo steps 1–4 from AGENTS.md on one real iPhone (390×844). Each test below is written as natural-language steps Revyl can follow, with the exact copy the app shows. Owner: Sean (S lane). Update the copy here whenever a screen's text changes in Capy's PRs.

## Setup before a run

- Two phones or one phone plus a second simulator: **Seller** and **Buyer**. Both run the same build pointed at the shared Convex dev deployment (`EXPO_PUBLIC_CONVEX_URL`).
- Seller phone is signed out (no stored user), so the sign-in flow in Test 1 runs. Sign-in is phone-only: the app shows a 4-digit code and the seller texts it to Keiki's shared line; **Skip (dev)** bypasses the text on dev builds. Buyer phone is signed in ahead of time the same way.
- Seed data loaded with `scripts/seed.sh` so a search for "jeans" already returns Hailey's, Maya's and Jon's items. Both phones must be within 2 mi of the Mission / Hayes Valley seed garages, or use a simulated location there.
- Location permission: not yet granted on either phone, so the permission prompt is part of the test.
- Camera roll on the Seller phone has at least three clothing photos.
- Whop is in sandbox (`WHOP_ENVIRONMENT=sandbox`) with the sandbox webhook registered at `https://fleet-gnat-219.convex.site/whop`. Use a Whop sandbox test card.
- `KEIKI_API_KEY` is set on the deployment, or Test 4 step 1 is skipped and only the dashboard checks run.

Reset between runs: delete the demo order with `npx convex run seed:demoOrder '{"removeOrderId":"<id>"}'` and put reserved items back to `live` from the Convex dashboard. Seed garages are idempotent; running `scripts/seed.sh` again does not duplicate items.

## Test 1: Seller opens a garage from three photos (demo step 1)

**Device:** Seller. **Timer:** start when the third photo is picked.

1. Launch the app. Expect the headline **"Clear your closet. Sell to people around you."** and a drop zone **"Add photos in bulk"** with the sub-line **"Pick 5, 20, 50 at once from your camera roll"**.
2. Tap the drop zone. Expect the iOS photo picker. Pick three clothing photos and confirm.
3. Expect the Price it screen with the headline **"We wrote it. You price it."** and three cards, each showing a spinner.
4. Within **10 seconds** of step 2, every card shows a title, a description that starts with "Size …", and a price. No card says **"Couldn't upload this one"**.
5. Tap the price field on card 1, clear it, type `25`. Expect the field to show **$25**.
6. Tap the **"Set all to"** pill and pick a value. Expect all three prices to change.
7. Tap the open-garage button at the bottom. Expect the sign-in screen with headline **"Who's selling?"** and fields **"First name"** and **"Phone number"**. Enter both and tap **"Continue"**.
8. Expect the headline **"Text us this code."** with a 4-digit code and **"Waiting for your text"**. Tap **"Verify by text"**, send the code to Keiki from Messages, and return to the app. Expect it to continue on its own within 10 s. (On a dev build, **"Skip (dev)"** may be used instead and the test notes it.)
9. Back on Price it, tap the open-garage button again. If iOS asks for location, allow it.
10. Expect the Garage open screen with headline **"Your garage is open."** listing the three items with their prices, and a Keiki card **"Find more stuff later?"** with **"Save Keiki to contacts"**.

Fail if: any card still spinning after 10 s; price field accepts non-numbers; location denied shows anything other than **"Location is needed so buyers nearby can find your garage."**

## Test 2: Buyer sees the new item live without refreshing (demo step 2)

**Devices:** Buyer open on the Near you screen before Test 1 step 7 runs.

1. On Buyer, from the seller home tap **"Browse near you"** (or the footer **"Browse"**). If iOS asks for location, allow it.
2. Expect the headline **"Near you"** and a label ending in **"· 2 mi"** (for example "Mission · 2 mi"), with the **"2 mi"** radius pill selected by default and **"Closest first"** shown selected. Fail if it stays on **"Finding you…"** for more than 8 s.
3. Tap the search field (placeholder **"Search jeans, jackets…"**) and type `jeans`. Expect seed results such as **"Levi's 501 jeans"**, **"Mom jeans"**, **"Wide leg jeans"**, each with a yellow price sticker and a neighborhood plus a distance like "0.4 mi".
4. Keep the Buyer screen open. On Seller, finish Test 1 step 7 with at least one item titled with the word "jeans".
5. Within **2 seconds**, the new item appears in the Buyer list with no pull-to-refresh or navigation.
6. Tap **"Under $30"**. Expect only items priced below $30. Tap it again to clear.
7. Expect results already ordered by distance ascending (the server sorts nearest first; the **"Closest first"** pill is not tappable).
8. Clear the search. Expect every live item within 2 mi, and never an item that is reserved or sold.

Fail if: the new item needs a refresh; an item from a garage more than 2 mi away appears; empty state copy differs from **"Nothing matching "jeans" within 2 mi yet."** when nothing matches.

## Test 3: Buyer picks two items and pays (demo step 3)

**Device:** Buyer. Requires the Whop checkout endpoint (`convex/http.ts`) and the orders functions to be merged.

1. From the Near you results, tap one of the Seller's new items. Expect the Garage screen with the seller's name, neighborhood and a rough distance, that item already selected, and a **"Buy"** button at the bottom.
2. Tap a second item from the same garage to add it. Expect the Buy button total to equal the sum of the two prices.
3. Tap **"Buy"**. Expect a spinner on the button, then an in-app browser showing the Whop sandbox checkout for the same total. No Whop-branded UI appears inside the app itself.
4. Pay with the sandbox test card.
5. Expect the browser to close and the Paid screen to show **"Confirming payment…"** briefly, then **"Paid $NN"** with both items listed and the line **"<Seller name> got a text. They'll message you to meet up."**
6. Tap **"Back to browsing"**. Expect the Near you screen, and neither item is in the results any more.

Fail if: the Paid screen stays on **"Confirming payment…"** for more than 15 s (webhook not firing; see the cut rule in AGENTS.md); the total on Whop differs from the app's; the Buy button is enabled with zero items selected.

## Test 4: Seller is notified and items are reserved (demo step 4)

**Device:** Seller, right after Test 3.

1. Expect a Keiki iMessage on the Seller phone within 30 s saying the buyer paid, naming both items and the total, and that the buyer will text to arrange pickup.
2. Open the app. On the seller home card **"Your garage"**, the two sold items are no longer listed as live.
3. In the Convex dashboard, the `orders` row is `paid` with `whopCheckoutId` set, and both `items` rows are `reserved`. The Convex logs show the `notifySellerSold` action succeeded (or the `KEIKI_API_KEY is not set` warning if the key is absent).

Fail if: either item is still `live`; the order is `paid` but a still-available item is not `reserved`; the text arrives but names the wrong items.

## Test 5 (negative): two buyers can't pay for the same item

**Devices:** Buyer A and Buyer B, both on the same garage with the same single item selected.

0. Buyer A taps **"Buy"** but does not pay yet. Within a few seconds, expect the item to disappear from Buyer B's view of the garage (a pending order holds its items for 10 minutes). If B had already tapped Buy, expect the error **"Someone else is checking out <item> right now"**.
1. Buyer A completes payment.
2. On Buyer B, after the hold is released or the item is reserved, expect the notice **"<Item title> just got picked up by someone else, so we took it out of your picks."** and the item removed from the selection.
3. If Buyer B had already opened Whop before A paid, completing B's payment must not reserve the item twice. Per the SEA-3 E decision (Sean, 2026-11-15, posted on PR #2): B's order still ends `paid`, the item stays `reserved` to A, and the seller's text for B's order names the item as already taken with an instruction to refund that line manually in Whop. No automatic refund in MVP.
4. In the Convex dashboard, the item has exactly one `reserved` status and appears in both orders' `itemIds`. Fail if the item flips to a second buyer or the seller text for B omits the taken item.

## Not covered

Demo step 5 (Keiki text → item appears) is Hailey's lane and a stretch goal; add a test here once `registerKeikiRoutes` is mounted in `convex/http.ts`.
