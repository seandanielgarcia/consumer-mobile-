/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

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

describe("yard-open text", () => {
  async function sentTexts(user: { verified?: boolean; phone?: string }, opens = 1) {
    vi.useFakeTimers();
    vi.stubEnv("KEIKI_API_KEY", "test-key");
    vi.stubEnv("DEMO_PHONES", "+15550100001");
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, open } = await yardFixture(user);
    for (let i = 0; i < opens; i++) await open();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    return fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string));
  }

  it("texts a verified seller once, on the first open", async () => {
    const sent = await sentTexts({ verified: true }, 2);
    expect(sent).toHaveLength(1);
    expect(sent[0].phone).toBe("+15559880001");
    expect(sent[0].text).toMatch(/Your yard is open! Share it with friends: .*\/yard\/\w+/);
  });

  it("skips unverified sellers and demo phones", async () => {
    expect(await sentTexts({ verified: false })).toHaveLength(0);
    expect(await sentTexts({ verified: true, phone: "+15550100001" })).toHaveLength(0);
  });
});
