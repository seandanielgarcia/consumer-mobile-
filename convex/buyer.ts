import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { haversineMiles, roundCoord } from "./lib/location";
import { heldItemIds } from "./orders";

const MAX_RADIUS_MILES = 10;

function roughMiles(lat: number, lng: number, garage: Doc<"garages">) {
  const miles = haversineMiles(roundCoord(lat), roundCoord(lng), garage.approxLat, garage.approxLng);
  return Math.round(miles * 10) / 10;
}

export const search = query({
  args: { q: v.string(), lat: v.number(), lng: v.number(), radiusMiles: v.number() },
  handler: async (ctx, { q, lat, lng, radiusMiles }) => {
    const radius = Math.min(Math.max(radiusMiles, 0), MAX_RADIUS_MILES);
    const term = q.trim();
    let items: Doc<"items">[];
    if (term) {
      const [byTitle, byDescription] = await Promise.all([
        ctx.db
          .query("items")
          .withSearchIndex("search_title", (s) => s.search("title", term).eq("status", "live"))
          .take(200),
        ctx.db
          .query("items")
          .withSearchIndex("search_description", (s) => s.search("description", term).eq("status", "live"))
          .take(200),
      ]);
      const seen = new Set<Id<"items">>();
      items = [...byTitle, ...byDescription].filter((i) => !seen.has(i._id) && seen.add(i._id));
    } else {
      items = await ctx.db
        .query("items")
        .withIndex("by_status", (s) => s.eq("status", "live"))
        .order("desc")
        .take(200);
    }

    const garages = new Map<Id<"garages">, Doc<"garages"> | null>();
    const owners = new Map<Id<"users">, Doc<"users"> | null>();
    const results = [];
    for (const item of items) {
      if (item.status !== "live") continue;
      if (!garages.has(item.garageId)) garages.set(item.garageId, await ctx.db.get(item.garageId));
      const garage = garages.get(item.garageId);
      if (!garage) continue;
      const distanceMi = roughMiles(lat, lng, garage);
      if (distanceMi > radius) continue;
      if (!owners.has(garage.ownerId)) owners.set(garage.ownerId, await ctx.db.get(garage.ownerId));
      results.push({
        _id: item._id,
        title: item.title,
        size: item.size,
        priceCents: item.priceCents,
        photoUrl: item.photoUrl,
        garageId: garage._id,
        ownerName: owners.get(garage.ownerId)?.name ?? "Someone",
        neighborhood: garage.neighborhood,
        distanceMi,
      });
    }
    return results.sort((a, b) => a.distanceMi - b.distanceMi);
  },
});

export const garage = query({
  args: { garageId: v.id("garages"), lat: v.number(), lng: v.number(), buyerId: v.optional(v.id("users")), now: v.optional(v.number()) },
  handler: async (ctx, { garageId, lat, lng, buyerId, now }) => {
    const garage = await ctx.db.get(garageId);
    if (!garage) return null;
    const owner = await ctx.db.get(garage.ownerId);
    const held = await heldItemIds(ctx, garageId, buyerId, now);
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garageId))
      .collect();
    return {
      _id: garage._id,
      ownerName: owner?.name ?? "Someone",
      avatarColor: owner?.avatarColor,
      neighborhood: garage.neighborhood,
      distanceMi: roughMiles(lat, lng, garage),
      items: items
        .filter((i) => i.status === "live" && !held.has(i._id))
        .map((i) => ({ _id: i._id, title: i.title, size: i.size, priceCents: i.priceCents, photoUrl: i.photoUrl })),
    };
  },
});
