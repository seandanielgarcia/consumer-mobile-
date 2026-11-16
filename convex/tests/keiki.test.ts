/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { checkoutFixture } from "./fixtures.test-setup";

const modules = import.meta.glob("../**/*.ts");
const phone = "+15559660001";

async function verifyFixture(withGarage: boolean) {
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  const t = convexTest(schema, modules);
  const garageId = await t.run(async ({ db }) => {
    const ownerId = await db.insert("users", {
      name: "Hailey",
      phone,
      avatarColor: "#2340FF",
      verified: false,
      verifyCode: "2495",
      verifyCodeExpiresAt: Date.now() + 60_000,
    });
    if (!withGarage) return null;
    return await db.insert("garages", { ownerId, neighborhood: "Mission", approxLat: 37.76, approxLng: -122.42, isOpen: true });
  });
  return { t, garageId };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("keiki verify_phone", () => {
  it("replies with the yard link when the seller has a yard", async () => {
    const { t, garageId } = await verifyFixture(true);
    const result = await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(result).toEqual({
      ok: true,
      reply: `You're verified! Share your yard with friends: https://example.convex.site/yard/${garageId}`,
    });
  });

  it("points sellers without a yard to the app", async () => {
    const { t } = await verifyFixture(false);
    const result = await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(result).toEqual({ ok: true, reply: "You're verified! Open your yard in the app to start selling." });
  });

  it("rejects a reused code after verifying", async () => {
    const { t } = await verifyFixture(true);
    await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" });
    expect(await t.mutation(internal.keiki.verifyPhone, { phones: [phone], code: "2495" })).toEqual({ error: "bad_code" });
  });
});

describe("Keiki photo submission", () => {
  it("publishes a priced photo, returns a browser preview, and shows it only to other shoppers", async () => {
    vi.stubEnv("KEIKI_TOOL_TOKEN", "test-token");
    vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
    const photoUrl = "https://attachments.example.test/mug.jpg";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === photoUrl) return new Response(new Blob(["mug"], { type: "image/jpeg" }));
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        title: "Blue ceramic mug", category: "Kitchen", size: null, brand: null,
        condition: "Good", color: "Blue", description: "Stoneware mug.", suggestedPriceCents: 500,
      }) } }] });
    }));

    const { t, sellerPhone, buyerId, garageId } = await checkoutFixture();
    const listed = await t.fetch("/keiki/add_item?token=test-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { attachment_id: "photo-1", price: 5 },
        context: { phone: sellerPhone, attachments: [{ id: "photo-1", url: photoUrl }] },
      }),
    });
    expect(listed.status).toBe(200);
    const result = await listed.json();
    expect(result).toMatchObject({ title: "Blue ceramic mug", price: 5, status: "live" });

    const preview = await t.fetch(new URL(result.link).pathname);
    expect(preview.status).toBe(200);
    expect(await preview.text()).toContain("Blue ceramic mug");

    const ownerId = await t.run(async ({ db }) => (await db.get(garageId))!.ownerId);
    const nearby = { q: "ceramic", lat: 37.76, lng: -122.42, radiusMiles: 2 };
    const shopper = await t.query(api.buyer.search, { ...nearby, buyerId });
    expect(shopper.map((item) => item._id)).toEqual([result.item_id]);
    await expect(t.query(api.buyer.search, { ...nearby, buyerId: ownerId })).resolves.toEqual([]);
  });
});

describe("Keiki item links", () => {
  it("shows the listing in Safari without launching an Expo development server", async () => {
    vi.stubEnv("YARDSALE_APP_LINK_BASE", undefined);
    vi.stubEnv("APP_LINK_BASE", "exp://anonymous-8081.exp.direct/--/");
    const { t, firstId } = await checkoutFixture();
    const response = await t.fetch(`/i/${firstId}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("Silk top");
    expect(html).toContain('<p class="description">Fixture</p>');
    expect(html).toContain("example.test/item.jpg");
    expect(html).toContain("$1");
    expect(html).not.toContain("location.href");
    expect(html).not.toContain("anonymous-8081.exp.direct");
    expect(html).not.toContain("Open in yardsale app");
  });

  it.each(["garagesale://", "exp://192.168.1.10:8084/--/"])("uses the configured launch URL %s", async (base) => {
    vi.stubEnv("YARDSALE_APP_LINK_BASE", base);
    const { t, firstId, garageId } = await checkoutFixture();

    const item = await t.fetch(`/i/${firstId}`);
    expect(await item.text()).toContain(`href="${base}buyer/item/${firstId}"`);

    const yard = await t.fetch(`/yard/${garageId}`);
    const html = await yard.text();
    expect(html).toContain(`href="${base}buyer/garage/${garageId}"`);
    expect(html).toContain(`href="/i/${firstId}"`);
    expect(html).toContain('<p class="description">Fixture</p>');
  });

  it("keeps yard listings browsable without an app launch URL", async () => {
    vi.stubEnv("YARDSALE_APP_LINK_BASE", "javascript:alert(1)");
    const { t, firstId, garageId } = await checkoutFixture();
    const response = await t.fetch(`/yard/${garageId}?appUrl=exp://untrusted.example/--/`);
    const html = await response.text();
    expect(html).not.toContain("Open in yardsale app");
    expect(html).toContain(`href="/i/${firstId}"`);
    expect((await t.fetch(`/i/${firstId}`)).status).toBe(200);
  });

  it("does not expose unavailable listings through a text link", async () => {
    const { t, reservedId } = await checkoutFixture();
    const response = await t.fetch(`/i/${reservedId}`);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("Reserved jeans");
  });
});
