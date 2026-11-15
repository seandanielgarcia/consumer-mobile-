import { v } from "convex/values";
import type { HttpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction, internalQuery } from "./_generated/server";

export const yard = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const garageId = ctx.db.normalizeId("garages", id);
    const garage = garageId && (await ctx.db.get(garageId));
    if (!garage) return null;
    const owner = await ctx.db.get(garage.ownerId);
    const items = await ctx.db
      .query("items")
      .withIndex("by_garage", (q) => q.eq("garageId", garage._id))
      .collect();
    return {
      garageId: garage._id,
      ownerName: owner?.name ?? "Someone",
      neighborhood: garage.neighborhood,
      items: items
        .filter((i) => i.status === "live")
        .map((i) => ({ title: i.title, photoUrl: i.photoUrl, priceCents: i.priceCents })),
    };
  },
});

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function page(title: string, description: string, image: string | undefined, body: string, appUrl?: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${image ? `<meta property="og:image" content="${escape(image)}">` : ""}
<style>
body{margin:0;background:#FFF6E5;color:#111;font-family:-apple-system,system-ui,sans-serif}
header{background:#2340FF;color:#FFF6E5;padding:40px 20px 22px}
h1{margin:0;font-size:30px;letter-spacing:-1px}
p{margin:6px 0 0;font-size:15px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 16px 120px}
.card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;background:#CFC3AA}
.price{display:inline-block;margin-top:6px;padding:2px 8px;border:2px solid #111;border-radius:8px;background:#FFE14D;font-weight:800}
.title{font-size:14px;margin-top:4px}
.cta{position:fixed;left:16px;right:16px;bottom:28px;display:block;height:56px;line-height:56px;border-radius:999px;background:#2340FF;color:#fff;text-align:center;font-weight:800;font-size:18px;text-decoration:none}
</style></head><body>${body}
${appUrl ? `<a class="cta" href="${escape(appUrl)}">Open in yardsale</a><script>location.href=${JSON.stringify(appUrl)}</script>` : ""}
</body></html>`;
}

export function registerShareRoutes(http: HttpRouter) {
  http.route({
    pathPrefix: "/yard/",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const id = new URL(request.url).pathname.slice("/yard/".length);
      const yard = await ctx.runQuery(internal.share.yard, { id });
      const headers = { "Content-Type": "text/html; charset=utf-8" };
      if (!yard) {
        return new Response(page("yardsale", "This yard is gone.", undefined, "<header><h1>This yard is gone.</h1></header>"), { status: 404, headers });
      }
      const title = `${yard.ownerName}'s yard`;
      const description = `${yard.items.length} item${yard.items.length === 1 ? "" : "s"} in ${yard.neighborhood} · pickup only`;
      const cards = yard.items
        .map(
          (i) =>
            `<div class="card"><img src="${escape(i.photoUrl)}" alt=""><div class="price">$${(i.priceCents / 100).toFixed(i.priceCents % 100 ? 2 : 0)}</div><div class="title">${escape(i.title)}</div></div>`,
        )
        .join("");
      const body = `<header><h1>${escape(title)}</h1><p>${escape(description)}</p></header><div class="grid">${cards}</div>`;
      return new Response(page(title, description, yard.items[0]?.photoUrl, body, `${process.env.APP_LINK_BASE ?? "garagesale://"}buyer/garage/${yard.garageId}`), { headers });
    }),
  });
}
