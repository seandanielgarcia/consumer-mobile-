import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    phone: v.string(),
    avatarColor: v.string(),
    verified: v.optional(v.boolean()),
    verifyCode: v.optional(v.string()),
    verifyCodeExpiresAt: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_verifyCode", ["verifyCode"]),

  garages: defineTable({
    ownerId: v.id("users"),
    neighborhood: v.string(),
    approxLat: v.number(),
    approxLng: v.number(),
    isOpen: v.boolean(),
  }).index("by_owner", ["ownerId"]),

  items: defineTable({
    garageId: v.id("garages"),
    photoUrl: v.string(),
    storageId: v.optional(v.id("_storage")),
    title: v.string(),
    category: v.optional(v.string()),
    size: v.optional(v.string()),
    brand: v.optional(v.string()),
    condition: v.optional(v.string()),
    color: v.optional(v.string()),
    description: v.string(),
    priceCents: v.number(),
    status: v.union(v.literal("draft"), v.literal("live"), v.literal("reserved"), v.literal("sold")),
    aiGenerated: v.boolean(),
  })
    .index("by_garage", ["garageId"])
    .index("by_status", ["status"])
    .searchIndex("search_title", { searchField: "title", filterFields: ["status"] })
    .searchIndex("search_description", { searchField: "description", filterFields: ["status"] }),

  orders: defineTable({
    buyerId: v.id("users"),
    garageId: v.id("garages"),
    itemIds: v.array(v.id("items")),
    totalCents: v.number(),
    whopCheckoutId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("picked_up"), v.literal("cancelled")),
  })
    .index("by_garage", ["garageId"])
    .index("by_status", ["status"]),
});
