import { v } from "convex/values";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isDemoPhone } from "./users";

export function yardLink(garageId: Id<"garages">) {
  return `${process.env.CONVEX_SITE_URL}/y/${garageId}`;
}

export const yardPage = internalQuery({
  args: { garageId: v.string() },
  handler: async (ctx, args): Promise<YardPage | null> => {
    const garageId = ctx.db.normalizeId("garages", args.garageId);
    const garage = garageId ? await ctx.db.get(garageId) : null;
    if (!garage) return null;
    const owner = await ctx.db.get(garage.ownerId);
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
      .order("desc")
      .collect();
    return {
      garageId: garage._id,
      firstName: owner?.name.trim().split(/\s+/)[0] || "Someone",
      neighborhood: garage.neighborhood,
      isOpen: garage.isOpen,
      items: items
        .filter((item) => item.status === "live")
        .map((item) => ({ title: item.title, size: item.size, priceCents: item.priceCents, photoUrl: item.photoUrl })),
    };
  },
});

type YardPage = {
  garageId: Id<"garages">;
  firstName: string;
  neighborhood: string;
  isOpen: boolean;
  items: { title: string; size?: string; priceCents: number; photoUrl: string }[];
};

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderYardPage(yard: YardPage, appBase: string) {
  const name = escape(yard.firstName);
  const appUrl = escape(`${appBase}buyer/garage/${yard.garageId}`);
  const cards = yard.items
    .map(
      (item, i) => `<div class="card" style="transform:rotate(${i % 2 ? 1.5 : -1.5}deg)"><div class="photo"><img src="${escape(item.photoUrl)}" alt="" loading="lazy"><span class="tag">$${Math.round(item.priceCents / 100)}</span></div><div class="title">${escape(item.title)}</div>${item.size ? `<div class="size">Size ${escape(item.size)}</div>` : ""}</div>`,
    )
    .join("");
  const empty = `<p class="empty">${yard.isOpen ? "Everything's spoken for right now. Check back soon." : "This yard is closed right now."}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}'s yard · yardsale</title>
<meta property="og:title" content="${name}'s yard on yardsale"><meta property="og:description" content="${yard.items.length} things for sale in ${escape(yard.neighborhood)}">
<style>
*{box-sizing:border-box}body{margin:0;background:#FFF6E5;color:#111;font-family:Inter,-apple-system,system-ui,sans-serif}
main{max-width:480px;margin:0 auto;padding:56px 20px 40px}
.brand{font-weight:800;font-size:18px;color:#2340FF;letter-spacing:-.02em}
h1{font-family:"Bricolage Grotesque",-apple-system,system-ui,sans-serif;font-weight:800;font-size:36px;line-height:1.05;margin:16px 0 6px;letter-spacing:-.03em}
.hood{color:#5A5245;font-size:16px;margin:0 0 20px}
.open{display:flex;align-items:center;justify-content:center;height:60px;border-radius:999px;background:#2340FF;color:#fff;font-weight:700;font-size:17px;text-decoration:none}
.hint{color:#5A5245;font-size:13px;text-align:center;margin:10px 0 28px}.hint a{color:#2340FF}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.card{background:#fff;padding:8px 8px 12px;box-shadow:0 2px 10px rgba(17,17,17,.12)}
.photo{position:relative;aspect-ratio:1;background:#eee}.photo img{width:100%;height:100%;object-fit:cover;display:block}
.tag{position:absolute;top:-8px;right:-8px;background:#FFE14D;font-weight:800;font-size:15px;padding:6px 10px;border-radius:999px;transform:rotate(6deg)}
.title{font-weight:600;font-size:14px;margin-top:8px;line-height:1.25}.size{color:#5A5245;font-size:12px;margin-top:2px}
.empty{color:#5A5245;text-align:center;padding:32px 0}
</style></head><body><main>
<div class="brand">yardsale</div>
<h1>${name}'s yard</h1>
<p class="hood">${escape(yard.neighborhood)} · ${yard.items.length} ${yard.items.length === 1 ? "thing" : "things"} for sale</p>
<a class="open" href="${appUrl}">Open in yardsale</a>
<p class="hint">Need the app? <a href="https://expo.dev/go">Get Expo Go</a>, then tap Open again.</p>
${yard.items.length ? `<div class="grid">${cards}</div>` : empty}
</main></body></html>`;
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
