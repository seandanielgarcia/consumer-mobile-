import { v } from "convex/values";
import { action } from "./_generated/server";

const MODEL = "gpt-5.4-mini";

const PROMPT = `You write listings for a neighborhood garage sale app that sells clothes only.
Look at the photo of one clothing item and return JSON:
- title: short item name a buyer would search for, with brand if visible (e.g. "Levi's 501 jeans").
- size: the size if visible or a best guess (e.g. "28", "M", "S"); "One size" if unclear.
- description: one or two short sentences starting with "Size <size>," (skip that when the size is "One size"), then color, material or fit, and condition (e.g. "Size 28, light wash, straight leg. Barely worn.").
- suggestedPriceCents: a fair used garage-sale price in US cents, rounded to whole dollars.
If the photo is not clothing, still describe the main item the same way.`;

export type PhotoListing = {
  title: string;
  size: string;
  description: string;
  suggestedPriceCents: number;
};

export async function describeClothingPhoto(imageUrl: string): Promise<PhotoListing> {
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
            required: ["title", "size", "description", "suggestedPriceCents"],
            properties: {
              title: { type: "string" },
              size: { type: "string" },
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
  const listing = JSON.parse(data.choices[0].message.content) as PhotoListing;
  return { ...listing, suggestedPriceCents: Math.max(100, Math.round(listing.suggestedPriceCents / 100) * 100) };
}

export const describePhoto = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }): Promise<PhotoListing> => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("Photo not found");
    return await describeClothingPhoto(url);
  },
});
