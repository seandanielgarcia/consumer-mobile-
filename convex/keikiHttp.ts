import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { HttpRouter } from "convex/server";

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function asPrice(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  }
  return undefined;
}

function attachmentUrl(context: Json, attachmentId: string): string | undefined {
  const attachments = context.attachments;
  if (Array.isArray(attachments)) {
    const match = attachments.map(asObject).find((a) => a.id === attachmentId || a.attachment_id === attachmentId);
    return asString((match ?? (attachments.length === 1 ? asObject(attachments[0]) : {})).url);
  }
  return asString(asObject(asObject(attachments)[attachmentId]).url);
}

function reply(body: Json) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function keikiRoute(handler: (ctx: ActionCtx, input: Json, context: Json, phones: string[]) => Promise<Json>) {
  return httpAction(async (ctx, request) => {
    const token = process.env.KEIKI_TOOL_TOKEN;
    if (!token || new URL(request.url).searchParams.get("token") !== token) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    let body: Json;
    try {
      body = asObject(await request.json());
    } catch {
      return reply({ error: "invalid_json" });
    }
    const input = asObject(body.input);
    const context = asObject(body.context);
    const phones = [asString(context.phone), asString(context.userId), asString(request.headers.get("X-Orchid-User-Id"))]
      .filter((p): p is string => !!p);
    try {
      return reply(await handler(ctx, input, context, phones));
    } catch (e) {
      console.error("keiki tool failed", request.url, e);
      return reply({ error: "internal_error" });
    }
  });
}

export function registerKeikiRoutes(http: HttpRouter) {
  http.route({
    pathPrefix: "/i/",
    method: "GET",
    handler: httpAction(async (_ctx, request) => {
      const itemId = new URL(request.url).pathname.slice("/i/".length);
      if (!/^[a-z0-9]{10,64}$/.test(itemId)) return new Response("Not found", { status: 404 });
      const appUrl = `garagesale://buyer/item/${itemId}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>yard sale</title></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px 24px"><p>Opening the item in yard sale…</p><p><a href="${appUrl}" style="display:inline-block;background:#000;color:#fff;padding:14px 24px;border-radius:999px;text-decoration:none">Open in yardsale</a></p><script>location.href=${JSON.stringify(appUrl)}</script></body></html>`;
      return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }),
  });

  http.route({
    path: "/keiki/add_item",
    method: "POST",
    handler: keikiRoute(async (ctx, input, context, phones) => {
      const attachmentId = asString(input.attachment_id);
      if (!attachmentId) return { error: "missing_attachment_id" };
      const garageId = await ctx.runQuery(internal.keiki.garageIdForPhone, { phones });
      if (!garageId) return { error: "no_garage" };
      const photoUrl = attachmentUrl(context, attachmentId);
      if (!photoUrl) return { error: "attachment_not_found" };
      const price = asPrice(input.price);
      if (price !== undefined && !(price > 0)) return { error: "invalid_price" };
      return await ctx.runAction(internal.keiki.addItem, { phones, photoUrl, price });
    }),
  });

  http.route({
    path: "/keiki/set_price",
    method: "POST",
    handler: keikiRoute(async (ctx, input, _context, phones) => {
      const itemId = asString(input.item_id);
      const price = asPrice(input.price);
      const size = asString(input.size);
      if (!itemId) return { error: "missing_item_id" };
      if (price !== undefined && !(price > 0)) return { error: "invalid_price" };
      return await ctx.runMutation(internal.keiki.setPrice, { phones, itemId, price, size });
    }),
  });

  http.route({
    path: "/keiki/list_items",
    method: "POST",
    handler: keikiRoute(async (ctx, _input, _context, phones) => await ctx.runQuery(internal.keiki.listItems, { phones })),
  });

  http.route({
    path: "/keiki/update_item",
    method: "POST",
    handler: keikiRoute(async (ctx, input, _context, phones) => {
      const itemId = asString(input.item_id);
      if (!itemId) return { error: "missing_item_id" };
      return await ctx.runMutation(internal.keiki.updateItem, { phones, itemId, status: asString(input.status) ?? "" });
    }),
  });

  http.route({
    path: "/keiki/verify_phone",
    method: "POST",
    handler: keikiRoute(async (ctx, input, _context, phones) => {
      const code = asString(input.code);
      if (!code) return { error: "bad_code" };
      return await ctx.runMutation(internal.keiki.verifyPhone, { phones, code });
    }),
  });
}
