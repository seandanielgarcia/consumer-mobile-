/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

export const webhookSecret = "ws_test_secret";

export async function signedPayment(orderId: string) {
  const id = `msg_checkout_${orderId}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    id,
    type: "payment.succeeded",
    data: { id: `pay_${orderId}`, metadata: { orderId } },
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

export async function checkoutFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ({ db }) => {
    const sellerPhone = "+15559770001";
    const sellerId = await db.insert("users", { name: "Maya Rivera", phone: sellerPhone, avatarColor: "#2340FF" });
    const buyerId = await db.insert("users", { name: "Jo", phone: "+15559770002", avatarColor: "#2340FF" });
    const otherBuyerId = await db.insert("users", { name: "Sam", phone: "+15559770003", avatarColor: "#2340FF" });
    const yard = { ownerId: sellerId, neighborhood: "Mission", approxLat: 37.76, approxLng: -122.42, isOpen: true };
    const garageId = await db.insert("garages", yard);
    const otherGarageId = await db.insert("garages", { ...yard, ownerId: otherBuyerId });
    const item = { garageId, photoUrl: "https://example.test/item.jpg", description: "Fixture", aiGenerated: false };
    const firstId = await db.insert("items", { ...item, title: "Silk top", priceCents: 100, status: "live" });
    const secondId = await db.insert("items", { ...item, title: "Jacket", priceCents: 1250, status: "live" });
    const reservedId = await db.insert("items", { ...item, title: "Reserved jeans", priceCents: 200, status: "reserved" });
    const soldId = await db.insert("items", { ...item, title: "Sold shoes", priceCents: 300, status: "sold" });
    const foreignId = await db.insert("items", { ...item, garageId: otherGarageId, title: "Boots", priceCents: 300, status: "live" });
    return { sellerPhone, buyerId, otherBuyerId, garageId, firstId, secondId, reservedId, soldId, foreignId };
  });
  return { t, ...ids };
}
