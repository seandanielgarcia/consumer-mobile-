import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import { checkoutFixture } from "./fixtures.test-setup";

const webhookSecret = "ws_test_secret";

async function signedPayment(orderId: string) {
  const id = "msg_checkout_test";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id,
    type: "payment.succeeded",
    data: { id: "pay_checkout_test", metadata: { orderId } },
  });
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${id}.${timestamp}.${body}`));
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return {
    method: "POST",
    body,
    headers: new Headers({
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${encoded}`,
    }),
  };
}

const notifyFetch = vi.fn(async () => new Response("ok"));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  vi.stubEnv("WHOP_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("KEIKI_API_KEY", "fixture-key");
  vi.stubEnv("KEIKI_API_BASE", "https://keiki.example.test");
  notifyFetch.mockClear();
  vi.stubGlobal("fetch", notifyFetch);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function pendingOrderFixture() {
  const fixture = await checkoutFixture();
  const { t, buyerId, garageId, firstId, secondId } = fixture;
  const { orderId } = await t.mutation(api.orders.createPending, { buyerId, garageId, itemIds: [firstId, secondId] });
  const snapshot = () => t.run(async ({ db }) => ({
    orders: await db.query("orders").collect(),
    items: await db.query("items").collect(),
  }));
  return { t, orderId, firstId, secondId, snapshot };
}

describe("checkout money path", () => {
  it("creates a sandbox checkout and reflects signed payment in the public order", async () => {
    vi.stubEnv("WHOP_API_KEY", "fixture-whop-key");
    vi.stubEnv("WHOP_ENVIRONMENT", "sandbox");
    vi.stubEnv("CONVEX_SITE_URL", "https://yard.example.test");
    const sandboxCheckout = "https://sandbox.whop.com/checkout/fixture";
    const createCheckoutFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      expect(url.hostname).toBe("sandbox-api.whop.com");
      expect(url.pathname).toMatch(/checkout_configurations$/);
      expect(request.method).toBe("POST");
      expect(await request.json()).toMatchObject({
        metadata: { orderId },
        variant: { initial_price: 13.5, currency: "usd" },
      });
      return Response.json({ id: "ch_fixture", purchase_url: sandboxCheckout });
    });
    const { t, orderId, firstId, secondId } = await pendingOrderFixture();
    vi.stubGlobal("fetch", createCheckoutFetch);
    const { purchaseUrl } = await t.action(api.whop.createOrderCheckout, { orderId });
    expect(purchaseUrl).toMatch(/^https:\/\/sandbox\.whop\.com\/checkout\/fixture\?/);
    expect(createCheckoutFetch).toHaveBeenCalledTimes(1);
    expect(await t.run(({ db }) => db.get(orderId)))
      .toMatchObject({ status: "pending", whopCheckoutId: "ch_fixture" });

    vi.stubGlobal("fetch", notifyFetch);
    expect((await t.fetch("/whop", await signedPayment(orderId))).status).toBe(200);
    const statuses = await t.run(async ({ db }) =>
      Promise.all([orderId, firstId, secondId].map(async (id) => (await db.get(id))?.status)));
    expect(statuses).toEqual(["paid", "reserved", "reserved"]);
    expect(await t.query(api.orders.getOrder, { orderId })).toMatchObject({
      status: "paid",
      totalCents: 1350,
      items: [{ _id: firstId }, { _id: secondId }],
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(notifyFetch).toHaveBeenCalledTimes(1);
  });
});

describe("POST /whop", () => {
  it.each(["bad", "missing"] as const)("rejects a %s signature with 401", async (kind) => {
    const { t, orderId, snapshot } = await pendingOrderFixture();
    const before = await snapshot();
    const request = await signedPayment(orderId);
    if (kind === "bad") request.headers.set("webhook-signature", "v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    else request.headers.delete("webhook-signature");

    expect((await t.fetch("/whop", request)).status).toBe(401);
    expect(await snapshot()).toEqual(before);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(notifyFetch).not.toHaveBeenCalled();
  });

  it("accepts a signed payment and reserves both items", async () => {
    const { t, orderId, firstId, secondId } = await pendingOrderFixture();
    expect((await t.fetch("/whop", await signedPayment(orderId))).status).toBe(200);
    const statuses = await t.run(async ({ db }) =>
      Promise.all([orderId, firstId, secondId].map(async (id) => (await db.get(id))?.status)));
    expect(statuses).toEqual(["paid", "reserved", "reserved"]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(notifyFetch).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a signed payment with a garbage order ID without changes", async () => {
    const { t, snapshot } = await pendingOrderFixture();
    const before = await snapshot();
    expect((await t.fetch("/whop", await signedPayment("invalid-order-id"))).status).toBe(200);
    expect(await snapshot()).toEqual(before);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(notifyFetch).not.toHaveBeenCalled();
  });

  it("acknowledges a replay without changing records or sending another notice", async () => {
    const { t, orderId, snapshot } = await pendingOrderFixture();
    const request = await signedPayment(orderId);
    expect((await t.fetch("/whop", request)).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const afterPayment = await snapshot();

    expect((await t.fetch("/whop", request)).status).toBe(200);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await snapshot()).toEqual(afterPayment);
    expect(notifyFetch).toHaveBeenCalledTimes(1);
  });
});
