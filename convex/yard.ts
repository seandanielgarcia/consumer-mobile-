import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isDemoPhone } from "./users";

export function yardLink(garageId: Id<"garages">) {
  return `${process.env.CONVEX_SITE_URL}/yard/${garageId}`;
}

export const yardOpenNoticeDetails = internalQuery({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const garage = await ctx.db.get(garageId);
    const owner = garage && (await ctx.db.get(garage.ownerId));
    if (!owner?.verified || isDemoPhone(owner.phone)) return null;
    return { phone: owner.phone };
  },
});

export const notifyYardOpen = internalAction({
  args: { garageId: v.id("garages") },
  handler: async (ctx, { garageId }) => {
    const apiKey = process.env.KEIKI_API_KEY;
    if (!apiKey) {
      console.warn(`KEIKI_API_KEY is not set; skipping the yard-open text for ${garageId}`);
      return;
    }
    const details = await ctx.runQuery(internal.yard.yardOpenNoticeDetails, { garageId });
    if (!details) return;
    const message = `Your yard is open! Share it with friends: ${yardLink(garageId)}`;
    const text = `This seller just opened their yard. Text them exactly this, link included: "${message}"`;
    const base = process.env.KEIKI_API_BASE ?? "https://onkeiki.com";
    const agentId = process.env.KEIKI_AGENT_ID ?? "3f824c5c-0cd6-49fd-bf14-f13b29bcf927";
    const response = await fetch(`${base}/api/v1/developer/agents/${agentId}/notice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text, phone: details.phone }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`Keiki yard-open text failed for ${garageId}: ${response.status} ${body}`);
    console.log(`Keiki yard-open text for ${garageId}: ${body}`);
  },
});
