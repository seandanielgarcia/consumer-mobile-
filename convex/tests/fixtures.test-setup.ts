/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

export async function checkoutFixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ({ db }) => {
    const sellerPhone = "+15559990001";
    const sellerId = await db.insert("users", { name: "Maya Rivera", phone: sellerPhone, avatarColor: "#2340FF" });
    const buyerId = await db.insert("users", { name: "Jo", phone: "+15559990002", avatarColor: "#2340FF" });
    const otherBuyerId = await db.insert("users", { name: "Sam", phone: "+15559990003", avatarColor: "#2340FF" });
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
