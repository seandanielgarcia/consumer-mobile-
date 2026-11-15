# Revyl demo QA

Revyl runs demo steps 1–4 from AGENTS.md on a real iPhone (390×844). Each test is written as natural-language steps Revyl can follow, with the exact copy the current build shows. Owner: Sean (S lane).

**Source of truth for copy:** the screens on `origin/capy/integration` (the only deploy source) and AGENTS.md → "Product decisions since the PRD". Strings in **bold** are copied from the code. Where the "garage" → "yard" rename is still pending in open PRs #9 and #10, this plan uses the yard wording and marks it **(after #9/#10)**. Until those merge, the current build still shows the garage wording; Revyl should accept either for those lines only. Update this file whenever a screen's text changes.

## Setup before a run

- **Build:** any build pointed at the shared Convex dev deployment (`fleet-gnat-219`, `EXPO_PUBLIC_CONVEX_URL`). Release is fine with the demo phones below.
- **Two devices:** **Seller** and **Buyer**, both signed out at the start (no stored user), so sign-in runs inside the tests.
- **Demo phones:** Revyl signs in as
  - Seller: first name `Sam`, phone `(555) 555-0101`
  - Buyer: first name `Maya B`, phone `(555) 555-0102`

  Both numbers are in `DEMO_PHONES` on the deployment (as `+15555550101,+15555550102`), so `users:startVerification` marks them verified on the server in any build. Sign-in goes straight back to the screen that asked for it: no code screen, no **"Skip (dev)"**, no CLI step.
- **Any other phone number** gets the real code flow (see "Sign-in with a non-demo number" below). A Release build has no **"Skip (dev)"** because it is gated on `__DEV__`. For a non-demo number either run Revyl against a dev/Debug build and tap **"Skip (dev)"**, or verify from the CLI with `npx convex run users:devSkipVerification '{"userId":"..."}'`, which needs `DEV_ALLOW_SKIP=true` on the deployment (it is set today).
- **Seed data:** `scripts/seed.sh` so a search for "jeans" already returns the seed yards' items. Both devices must be within 2 mi of the Mission / Hayes Valley seed yards, or set the location to "Mission" through the Buyer's **"Change location"** sheet.
- **Location permission:** not yet granted on either device, so the iOS prompt is part of the test.
- **Photos:** the Seller camera roll has at least three photos of things to sell (anything sells, not just clothes). Include at least one pair of jeans so Test 2 can find it. Demo users and dev builds also see **"Use sample photos"** on the landing, which Revyl may use instead of the picker.
- **Whop:** sandbox (`WHOP_ENVIRONMENT=sandbox`) with the sandbox webhook registered at `https://fleet-gnat-219.convex.site/whop`.
- **Keiki sold text:** only a seller phone that has really verified by texting Keiki can receive it. In the live demo the seller is Hailey's real number, verified by text, which is a precondition for Test 4 step 1. With the demo phones Keiki has never seen the number, returns 404, and sends nothing, so in Revyl runs Test 4 step 1 is **manual**, not failed.

## Reset between runs

Run `scripts/reset-demo.sh` (coming in PR #9) with `CONVEX_DEPLOY_KEY="$ConvexKey"`. It puts the demo yards and items back to their starting state so Tests 1–5 can run again. Until #9 merges, reset by hand: delete the demo orders and put reserved items back to `live` from the Convex dashboard. Running `scripts/seed.sh` again does not duplicate seed items. Sign both devices out (landing → **"Sign out"**) before the next run.

## Test 1: Seller opens a yard from three photos (demo step 1)

**Device:** Seller. **Timer:** start when the third photo is picked.

1. Launch the app. Expect the two-path landing: wordmark **"yard sale"** (after #9/#10), tagline **"Share a photo and set a price, we'll take care of the rest"**, a polaroid stack with yellow price stickers, and two buttons **"Sell your stuff"** and **"Shop near you"**.
2. Tap **"Sell your stuff"**. Expect the iOS photo picker. Pick three photos and confirm. (Or tap **"Use sample photos"** if shown.)
3. Expect the review queue: **"← Back"**, the counter **"Review 1 of 3"**, a large photo and buttons **"Edit"**, **"Approve"** and **"skip / remove"**. While the AI runs, **"Approve"** shows a spinner and is disabled.
4. Within **10 seconds** of step 2, the card shows a title, a price sticker, and chips for brand, condition and colour (plus **"Size …"** only for items where size applies). No AI label appears anywhere (no "Written by AI"). No card says **"Couldn't upload this one"**.
5. Tap **"Edit"**. Expect editable fields with placeholders **"Title"**, **"Description"** and the **"Price"** field. Clear the price, type `25`, and leave edit mode. Expect the sticker to show **$25**. Tap **"Approve"**.
6. Expect **"Review 2 of 3"**. Tap **"Approve"**. Expect **"Review 3 of 3"**. Tap **"Approve"**.
7. Expect the summary **"Ready to go"** listing the three items with their prices and an edit pencil each, and the button **"Open my yard (3 items)"**.
8. Tap **"Open my yard (3 items)"**. Expect sign-in: **"Cancel"**, **"What's your first name?"** (placeholder **"First name"**, sub-line **"Buyers see your first name only."**), **"Your phone number"** (placeholder **"Phone number"**) and **"Continue"**. Enter `Sam` and `(555) 555-0101`, tap **"Continue"**.
9. Expect to return to **"Ready to go"** with no code screen (demo phone). Tap **"Open my yard (3 items)"** again if it did not continue on its own. If iOS asks for location, allow it.
10. Expect Yard open: a line **"<neighborhood> · visible within about 2 mi"**, the headline **"Your yard is open."** (after #9/#10), the three items as polaroids with prices, and a one-line Keiki card **"More later? Text Keiki a pic and a price."** with **"Save Keiki to contacts"**.

Fail if: any card is still loading 10 s after the photos are picked; the price field accepts non-numbers; **"Approve"** is enabled with an empty title or a $0 price; an AI label is shown; **"Couldn't open your yard. Try again."** appears.

## Test 2: Buyer sees the new item live without refreshing (demo step 2)

**Device:** Buyer, open on Near you before Test 1 step 9 runs.

1. Launch the app on Buyer. On the landing tap **"Shop near you"**. If iOS asks for location, allow it.
2. Expect the headline **"Near you"** and an underlined location label **"<place> · 2 mi"** (for example "Mission · 2 mi"). Expect pills **"Size"**, **"Under $30"**, **"Closest first"** (always selected) and radius pills **"1 mi"**, **"2 mi"**, **"5 mi"**, **"10 mi"** with **"2 mi"** selected. Fail if the label stays on **"Finding you…"** for more than 8 s.
3. Tap the location label. Expect the **"Shop near…"** sheet with **"Use my location"**, a field with placeholder **"Neighborhood or address"**, a **"Go"** button and the line **"Only a rough area (about 1 km) is used."** Type `Mission`, tap **"Go"**. Expect the sheet to close and the label to read the new place plus **"· 2 mi"**. A place that doesn't geocode shows **"Couldn't find that place. Try a neighborhood or street."**
4. Tap **"5 mi"**. Expect the label to end in **"· 5 mi"** and the results to grow or stay the same. Tap **"2 mi"** again.
5. Tap the search field (placeholder **"Search jeans, jackets…"**) and type `jeans`. Expect seed results, each with a photo, a yellow price sticker, a title (with **", <size>"** when the item has a size) and a line **"<name>'s yard · <distance> mi"** (after #9/#10).
6. Keep Buyer on this screen. On Seller, finish Test 1 step 9 with at least one item whose title or description contains "jeans".
7. Within **2 seconds**, the new item appears in the Buyer list with no pull-to-refresh and no navigation.
8. Tap **"Under $30"**. Expect only items priced below $30. Tap it again to clear.
9. Expect results ordered by distance, nearest first (**"Closest first"** is not tappable).
10. Clear the search. Expect every live item within the radius and never a reserved or sold item.

Fail if: the new item needs a refresh; an item from a yard outside the selected radius appears; the empty state differs from **"Nothing matching "jeans" within 2 mi yet."** when nothing matches, or from **"No yards open within 2 mi yet."** (after #9/#10) with an empty search.

## Test 3: Buyer picks two items and pays (demo step 3)

**Device:** Buyer.

1. From the Near you results, tap one of Sam's new items. Expect the yard screen: **"← Nearby"**, **"Sam's yard"** (after #9/#10), **"<neighborhood> · about <N> mi from you · pickup only"**, that item already checked, a footer **"1 picked"** with its price, and a **"Buy"** button.
2. Tap a second item from the same yard. Expect **"2 picked"** and a total equal to the sum of the two prices.
3. Tap **"Buy"**. Because Buyer is signed out, expect sign-in. Enter `Maya B` and `(555) 555-0102`, tap **"Continue"**. Expect to return to the yard with both items still picked (no code screen). Tap **"Buy"** again if checkout didn't start on its own.
4. Expect a spinner on **"Buy"**, then the iOS system alert **"<App> Wants to Use "sandbox.whop.com" to Sign In"**. Tap **"Continue"**.
5. Expect the in-app browser on the Whop sandbox checkout. Its header shows the sandbox business name and the amount equals the app's total. No Whop-branded UI appears inside the app itself.
6. Pay with card `4242 4242 4242 4242`, expiry `12/34`, CVC `123`, and any US address.
7. Expect the browser to close by itself and the Paid screen to show **"Confirming payment…"** briefly, then **"Paid $NN"** within about 10 s, both items listed with their prices, and the line **"Sam will text you to meet up."** (The current build still says **"Sam got a text. They'll message you to meet up."**; accept either until the copy change lands.)
8. Tap **"Back to browsing"**. Expect Near you, and neither item is in the results any more.

Fail if: Paid stays on **"Confirming payment…"** for more than 15 s (webhook not firing; see the cut rule in AGENTS.md); the Whop amount differs from the app total; **"Buy"** is enabled with zero items picked; the screen shows **"Order cancelled"** or **"Order not found"**.

## Test 4: Seller is notified and items are reserved (demo step 4)

**Device:** Seller, right after Test 3.

1. **Manual in Revyl runs with the demo phones; required in the live demo.** Precondition: the seller's phone has really verified by texting Keiki (Hailey's number in the live demo). Expect a Keiki iMessage on the seller phone within 30 s saying the buyer paid, naming both items and the total, and that the buyer will text to arrange pickup. With `(555) 555-0101`, Keiki returns 404 and no text is sent: record the step as manual, not failed.
2. In the app, open the landing / Home. The two sold items are no longer shown as live in **"Your yard"** (after #9/#10; Home as the yard shows them with a **Reserved** sticker).
3. In the Convex dashboard, the `orders` row is `paid` with `whopCheckoutId` set and both `items` rows are `reserved`. The Convex logs show the `notifySellerSold` action ran (a Keiki 404 is expected with demo phones).

Fail if: either item is still `live`; the order is `paid` but a still-available item is not `reserved`; in the live demo the text arrives but names the wrong items.

## Test 5 (negative): two buyers can't pay for the same item

**Devices:** Buyer A and Buyer B, both on the same yard with the same single item picked.

1. Buyer A taps **"Buy"** but does not pay yet. Within a few seconds the item disappears from Buyer B's view of the yard (a pending order holds its items for 10 minutes). If B taps **"Buy"** while A's hold is active, expect the error **"Someone else is checking out <title> right now"**.
2. Buyer A completes payment.
3. On Buyer B, expect the notice **"<title> just got picked up by someone else, so we took it out of your picks."** and the item removed from B's selection. If it was B's only item, expect **"0 picked"** and **"Buy"** disabled.
4. If Buyer B had already opened Whop before A paid, completing B's payment must not reserve the item twice. Per the SEA-3 E decision (Sean, 2026-11-15, posted on PR #2): B's order still ends `paid`, the item stays `reserved` to A, and the seller's text for B's order names the item as already taken with an instruction to refund that line manually in Whop. No automatic refund in MVP.
5. In the Convex dashboard, the item has exactly one `reserved` status and appears in both orders' `itemIds`.

Fail if: the item flips to the second buyer; the notice text differs; the seller text for B omits the taken item (live demo only).

## Sign-in with a non-demo number

For reference when Revyl uses a real number. After **"Continue"** the screen shows **"← Back"**, **"Text this to Keiki"**, a chip **"K-FERUEU verify <4-digit code>"**, **"to +1 779-625-1378"**, **"from <phone>"**, a spinner with **"Waiting for your text…"** and the button **"Open Messages"** (dev builds also show **"Skip (dev)"**). Sending the code from that phone continues the app on its own within 10 s. If skip is disabled on the backend, tapping **"Skip (dev)"** shows **"Skip is turned off on this backend."**

## Timing targets

- AI fills all three cards in under **10 s** from picking the photos.
- A new live item appears in buyer search in under **2 s**, with no refresh.
- **"Paid $NN"** appears within about **10 s** of paying on Whop (fail at 15 s).

## Not covered

Demo step 5 (Keiki text → item appears) is Hailey's lane and a stretch goal; add a test here once `registerKeikiRoutes` is mounted in `convex/http.ts`.
