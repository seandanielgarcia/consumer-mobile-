import { expect, test } from "vitest";
import { STOCK } from "../../src/lib/stock";

const files = Object.keys(import.meta.glob("../../assets/stock/*.jpg")).map((path) => path.split("/").pop());

test("every stock photo is used exactly once and exists on disk", () => {
  const listed = STOCK.map((s) => s.file);
  expect(new Set(listed).size).toBe(listed.length);
  expect([...listed].sort()).toEqual([...files].sort());
});

test("the Landing stack shows four distinct items at varied realistic prices", () => {
  const landing = STOCK.filter((s) => s.use === "landing");
  expect(landing).toHaveLength(4);
  expect(new Set(landing.map((s) => s.title)).size).toBe(4);
  expect(new Set(landing.map((s) => s.priceCents)).size).toBe(4);
  for (const s of STOCK) expect(s.priceCents).toBeGreaterThanOrEqual(500);
});

test("each seed yard lists its own photos", () => {
  const sellers = new Set(STOCK.filter((s) => s.use === "seed").map((s) => s.seller));
  expect(sellers.size).toBeGreaterThanOrEqual(3);
  for (const seller of sellers) {
    expect(STOCK.filter((s) => s.use === "seed" && s.seller === seller).length).toBeGreaterThan(0);
  }
});
