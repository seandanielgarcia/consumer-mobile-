import { v } from "convex/values";
import { action } from "./_generated/server";

const MODEL = "gpt-5.4-mini";

const PROMPT = `You write listings for a neighborhood garage sale app. People sell anything: clothes, furniture, books, kitchenware, toys, electronics, decor.
Look at the photo of one item and return JSON:
- title: short item name a buyer would search for, at most 4 words, with brand if visible (e.g. "Levi's 501 jeans", "IKEA floor lamp").
- category: one or two plain words (e.g. "Clothing", "Shoes", "Furniture", "Books", "Kitchen", "Toys", "Electronics", "Decor").
- size: the size only when it is visible or the item is normally sized (clothing, shoes); otherwise null.
- brand: the brand only when visible or obvious; otherwise null.
- condition: one of "New", "Like new", "Good", "Fair".
- color: the main color in one or two words.
- description: one or two short sentences on what it is, material or style, and condition (e.g. "Light wash, straight leg. Barely worn."). Don't repeat the size, brand or color.
- suggestedPriceCents: a fair used garage-sale price in US cents, rounded to whole dollars.`;

export type PhotoListing = {
  title: string;
  category: string;
  size?: string;
  brand?: string;
  condition: string;
  color: string;
  description: string;
  suggestedPriceCents: number;
};

const nullableString = { type: ["string", "null"] };

export async function describeItemPhoto(imageUrl: string): Promise<PhotoListing> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: "none",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: [{ type: "image_url", image_url: { url: imageUrl, detail: "low" } }] },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "listing",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "category", "size", "brand", "condition", "color", "description", "suggestedPriceCents"],
            properties: {
              title: { type: "string" },
              category: { type: "string" },
              size: nullableString,
              brand: nullableString,
              condition: { type: "string", enum: ["New", "Like new", "Good", "Fair"] },
              color: { type: "string" },
              description: { type: "string" },
              suggestedPriceCents: { type: "integer" },
            },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const { size, brand, suggestedPriceCents, ...rest } = JSON.parse(data.choices[0].message.content);
  return {
    ...rest,
    size: size?.trim() || undefined,
    brand: brand?.trim() || undefined,
    suggestedPriceCents: Math.max(100, Math.round(suggestedPriceCents / 100) * 100),
  };
}

export const describeClothingPhoto = describeItemPhoto;

export const describePhoto = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<PhotoListing> => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Photo not found");
    return await describeItemPhoto(url);
  },
});
