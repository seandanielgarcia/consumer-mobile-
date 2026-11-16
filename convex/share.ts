import { v } from "convex/values";
import type { HttpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction, internalQuery } from "./_generated/server";
import { formatPlace } from "../src/lib/place";

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
      neighborhood: formatPlace(garage),
      items: items
        .filter((i) => i.status === "live")
        .map((i) => ({ itemId: i._id, title: i.title, description: i.description, photoUrl: i.photoUrl, priceCents: i.priceCents })),
    };
  },
});

export const item = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const itemId = ctx.db.normalizeId("items", id);
    const item = itemId && (await ctx.db.get(itemId));
    if (!item || item.status !== "live") return null;
    const garage = await ctx.db.get(item.garageId);
    if (!garage?.isOpen) return null;
    return {
      itemId: item._id,
      garageId: garage._id,
      title: item.title,
      description: item.description,
      photoUrl: item.photoUrl,
      priceCents: item.priceCents,
      neighborhood: formatPlace(garage),
    };
  },
});

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const priceLabel = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" };

// Share pages may be opened by anyone, including people without an app build.
// Use an explicit deployment setting, never a launch URL supplied by the request.
function appLaunchUrl(route: string) {
  const base = process.env.YARDSALE_APP_LINK_BASE?.trim();
  if (base === "garagesale://") return base + route;
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (
      (url.protocol === "exp:" || url.protocol === "exps:") && url.hostname &&
      url.pathname === "/--/" && !url.username && !url.password && !url.search && !url.hash
    ) {
      return url.href + route;
    }
  } catch {
    // Keep the share page available even when the launch URL is misconfigured.
  }
  return undefined;
}

function page(title: string, description: string, image: string | undefined, body: string, appUrl?: string) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${image ? `<meta property="og:image" content="${escape(image)}">` : ""}
<style>
body{margin:0;background:#F3F2FA;color:#1B1B3A;font-family:-apple-system,system-ui,sans-serif}
header{padding:44px 20px 18px}
h1{margin:0;font-size:32px;font-weight:800;letter-spacing:-1px}
p{margin:8px 0 0;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#6E6F8F}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:4px 16px 120px}
.grid.single{grid-template-columns:minmax(0,440px);justify-content:center}
.card{position:relative;background:#fff;border-radius:22px;padding:8px 8px 12px;box-shadow:0 8px 24px rgba(27,27,58,.10)}
.card-link{display:block;color:inherit;text-decoration:none}
.card img{display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:16px;background:#D9D9EA}
.photo{position:relative}
.price{position:absolute;left:8px;bottom:8px;padding:3px 9px;border:2px solid #1B1B3A;border-radius:8px;background:#B6F03A;font-weight:800;font-size:15px}
.description{padding:0 4px;margin:6px 0 10px;color:#525371;font-size:14px;font-weight:400;line-height:1.4;letter-spacing:normal;text-transform:none}
.card-link .description{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.title{font-size:15px;font-weight:600;margin-top:8px;padding:0 4px}
.yard-link{display:inline-flex;align-items:center;min-height:44px;color:#2A52F0;font-weight:600}
.cta{position:fixed;left:16px;right:16px;bottom:28px;display:block;height:56px;line-height:56px;border-radius:999px;background:#2A52F0;color:#fff;text-align:center;font-weight:800;font-size:18px;text-decoration:none;box-shadow:0 10px 24px rgba(42,82,240,.3)}
</style></head><body>${body}
${appUrl ? `<a class="cta" href="${escape(appUrl)}">Open in yardsale app</a>` : ""}
</body></html>`;
}

export function registerShareRoutes(http: HttpRouter) {
  http.route({
    pathPrefix: "/i/",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const id = new URL(request.url).pathname.slice("/i/".length);
      const item = await ctx.runQuery(internal.share.item, { id });
      if (!item) {
        const message = "This item is no longer available.";
        return new Response(page("yardsale", message, undefined, `<header><h1>${message}</h1></header>`), { status: 404, headers });
      }

      const description = `${priceLabel(item.priceCents)} · ${item.neighborhood} · pickup only`;
      const body = `<header><h1>${escape(item.title)}</h1><p>${escape(description)}</p></header>
<main class="grid single"><div class="card">
<img src="${escape(item.photoUrl)}" alt="${escape(item.title)}">
<p class="description">${escape(item.description)}</p>
<a class="yard-link" href="/yard/${item.garageId}">See the yard</a>
</div></main>`;
      // Render the link in Safari first; the native app is optional for the person opening it.
      return new Response(page(item.title, description, item.photoUrl, body, appLaunchUrl(`buyer/item/${item.itemId}`)), { headers });
    }),
  });

  http.route({
    pathPrefix: "/yard/",
    method: "GET",
    handler: httpAction(async (ctx, request) => {
      const id = new URL(request.url).pathname.slice("/yard/".length);
      const yard = await ctx.runQuery(internal.share.yard, { id });
      if (!yard) {
        return new Response(page("yardsale", "This yard is gone.", undefined, "<header><h1>This yard is gone.</h1></header>"), { status: 404, headers });
      }
      const title = `${yard.ownerName}'s yard`;
      const description = `${yard.items.length} item${yard.items.length === 1 ? "" : "s"} in ${yard.neighborhood} · pickup only`;
      const cards = yard.items
        .map(
          (i) =>
            `<a class="card card-link" href="/i/${i.itemId}"><div class="photo"><img src="${escape(i.photoUrl)}" alt=""><div class="price">${priceLabel(i.priceCents)}</div></div><div class="title">${escape(i.title)}</div><p class="description">${escape(i.description)}</p></a>`,
        )
        .join("");
      const body = `<header><h1>${escape(title)}</h1><p>${escape(description)}</p></header><div class="grid">${cards}</div>`;
      return new Response(page(title, description, yard.items[0]?.photoUrl, body, appLaunchUrl(`buyer/garage/${yard.garageId}`)), { headers });
    }),
  });
}
