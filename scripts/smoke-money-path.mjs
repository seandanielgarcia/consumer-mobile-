import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";

const deployment = "https://fleet-gnat-219.convex.cloud";
const timeoutMs = 60_000;
const start = performance.now();
let orderId;
let attempted = false;
let pollingDeadline;

function elapsed(since) {
  return `${((performance.now() - since) / 1000).toFixed(1)}s`;
}

function deployedClient() {
  const url = new URL(process.argv[2] ?? process.env.EXPO_PUBLIC_CONVEX_URL ?? deployment);
  if (url.href !== `${deployment}/`) {
    throw new Error(`Refusing to run outside ${deployment}.`);
  }
  const key = process.env.CONVEX_DEPLOY_KEY;
  if (!key) throw new Error("Set CONVEX_DEPLOY_KEY for fleet-gnat-219 before running.");
  const client = new ConvexHttpClient(url.origin, {
    fetch: (input, init) => {
      const remaining = pollingDeadline === undefined ? 20_000 : pollingDeadline - performance.now();
      if (remaining <= 0) throw new Error("Payment confirmation timed out.");
      return fetch(input, { ...init, signal: AbortSignal.timeout(Math.ceil(remaining)) });
    },
  });
  client.setAdminAuth(key);
  return client;
}

async function smoke() {
  const client = deployedClient();
  const suffixes = new Set();
  while (suffixes.size < 2) suffixes.add(String(randomInt(10_000)).padStart(4, "0"));
  const [sellerPhone, buyerPhone] = [...suffixes].map((suffix) => `+1555999${suffix}`);

  attempted = true;
  const [sellerId, buyerId] = await Promise.all([
    client.mutation(api.users.getOrCreateByPhone, { name: "Smoke Seller", phone: sellerPhone }),
    client.mutation(api.users.getOrCreateByPhone, { name: "Smoke Buyer", phone: buyerPhone }),
  ]);
  if (await client.query(api.garages.mine, { ownerId: sellerId })) {
    throw new Error("The generated seller phone already has a yard. Rerun to choose new fixture numbers.");
  }
  const uploadUrl = await client.mutation(api.items.generateUploadUrl, {});
  const photo = await readFile(new URL("./seed-photos/silk-top.jpg", import.meta.url));
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "image/jpeg" },
    body: photo,
    signal: AbortSignal.timeout(20_000),
  });
  if (!upload.ok) throw new Error(`Photo upload failed (HTTP ${upload.status}).`);
  const { storageId } = await upload.json();
  const { garageId, itemIds } = await client.mutation(api.garages.openWithItems, {
    ownerId: sellerId,
    neighborhood: "McMurdo Smoke Test",
    lat: -77.85,
    lng: 166.67,
    items: [{
      storageId,
      title: "Smoke test silk top",
      description: "Throwaway sandbox checkout fixture",
      priceCents: 100,
      aiGenerated: false,
    }],
  });
  const order = await client.mutation(api.orders.createPending, { buyerId, garageId, itemIds });
  orderId = order.orderId;
  if (order.totalCents !== 100) throw new Error(`Expected 100 cents, got ${order.totalCents}.`);

  const { purchaseUrl } = await client.action(api.whop.createOrderCheckout, { orderId });
  if (new URL(purchaseUrl).origin !== "https://sandbox.whop.com") {
    throw new Error("Whop returned a checkout outside its sandbox.");
  }
  console.log(`Sandbox checkout ready in ${elapsed(start)} for order ${orderId}:\n${purchaseUrl}`);

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    await prompt.question("Complete the sandbox payment, then press Enter to check Convex. ");
  } finally {
    prompt.close();
  }

  const pollStart = performance.now();
  pollingDeadline = pollStart + timeoutMs;
  while (performance.now() < pollingDeadline) {
    const status = await client.query(api.orders.getOrder, { orderId });
    if (status?.status === "paid") {
      console.log(`PASS: order ${orderId} is paid (${elapsed(pollStart)} polling, ${elapsed(start)} total).`);
      return;
    }
    if (status === null || status.status === "cancelled") {
      throw new Error(`Order status is ${status?.status ?? "missing"}.`);
    }
    const remaining = pollingDeadline - performance.now();
    if (remaining > 0) await delay(Math.min(1_000, remaining));
  }
  throw new Error("Order did not become paid within 60 seconds.");
}

try {
  await smoke();
} catch (error) {
  console.error(`FAIL after ${elapsed(start)}${orderId ? ` (order ${orderId})` : ""}: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (attempted) console.log("Cleanup once PR #9 lands: npx convex run seed:resetDemo");
}
