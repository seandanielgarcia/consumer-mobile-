/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { renderYardPage } from "../yard";

const modules = import.meta.glob("../**/*.ts");

async function yardFixture(user: { verified?: boolean; phone?: string } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ({ db, storage }) => {
    const ownerId = await db.insert("users", { name: "Hailey <b>Kim</b>", phone: user.phone ?? "+15559880001", avatarColor: "#2340FF", verified: user.verified });
    const storageId = await storage.store(new Blob(["photo"], { type: "image/jpeg" }));
    return { ownerId, storageId };
  });
  const open = () =>
    t.mutation(api.garages.openWithItems, {
      ownerId: ids.ownerId,
      neighborhood: "Hayes Valley",
      lat: 37.776,
      lng: -122.424,
      items: [{ storageId: ids.storageId, title: "Lamp", description: "Brass", priceCents: 1500, aiGenerated: true }],
    });
  return { t, open, ...ids };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("public yard page", () => {
  it("lists only live items and escapes seller text", async () => {
    const { t, open } = await yardFixture();
    const { garageId } = await open();
    await t.run(async ({ db }) => {
      const item = { garageId, photoUrl: "https://example.test/x.jpg", description: "x", aiGenerated: false };
      await db.insert("items", { ...item, title: "Reserved coat", priceCents: 100, status: "reserved" });
      await db.insert("items", { ...item, title: "Sold boots", priceCents: 100, status: "sold" });
      await db.insert("items", { ...item, title: "Draft hat", priceCents: 100, status: "draft" });
    });
    const yard = await t.query(internal.yard.yardPage, { garageId });
    expect(yard?.items.map((i) => i.title)).toEqual(["Lamp"]);
    expect(yard?.firstName).toBe("Hailey");

    const html = renderYardPage({ ...yard!, firstName: "<script>x</script>" }, "garagesale://");
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;'s yard");
    expect(html).toContain(`href="garagesale://buyer/garage/${garageId}"`);
    expect(html).toContain("Hayes Valley");
    expect(html).not.toMatch(/37\.7|-122\.4/);
  });

  it("returns null for an unknown yard id", async () => {
    const { t } = await yardFixture();
    expect(await t.query(internal.yard.yardPage, { garageId: "nope" })).toBeNull();
  });
});

describe("yard-open text", () => {
  async function sentTexts(user: { verified?: boolean; phone?: string }, opens = 1) {
    vi.useFakeTimers();
    vi.stubEnv("KEIKI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PHONES", "+15550100001");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, open } = await yardFixture(user);
    for (let i = 0; i < opens; i++) await open();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
  }

  it("texts a verified seller once, on the first open", async () => {
    const sent = await sentTexts({ verified: true }, 2);
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe("+15559880001");
    expect(sent[0].text).toMatch(/Your yard is open! Share it with friends: .*\/y\/\w+/);
  });

  it("skips unverified sellers and demo phones", async () => {
    expect(await sentTexts({ verified: false })).toHaveLength(0);
    expect(await sentTexts({ verified: true, phone: "+15550100001" })).toHaveLength(0);
  });
});
