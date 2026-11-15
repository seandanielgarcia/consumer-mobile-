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
