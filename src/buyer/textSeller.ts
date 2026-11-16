import type { ConvexReactClient } from "convex/react";
import * as Linking from "expo-linking";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { requireUser, SignInCancelled } from "../lib/useCurrentUser";
import { formatPrice } from "./format";

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || "the seller";

export const askToBuyText = (seller: string, titles: string[], totalCents: number, neighborhood: string) =>
  `Hi ${seller}! I'd like to buy ${titles.join(", ")} for ${formatPrice(totalCents)}. When can I pick it up this week in ${neighborhood}?`;

export const pickupText = (seller: string, titles: string[], neighborhood: string) =>
  `Hi ${seller}! Just purchased ${titles.join(", ")} of yours. What day works best this week to pick it up in ${neighborhood}?`;

export async function textSeller(convex: ConvexReactClient, garageId: Id<"garages">, body: (seller: string) => string): Promise<string | null> {
  let buyerId: Id<"users">;
  try {
    buyerId = await requireUser("Sign in to text the seller");
  } catch (error) {
    return error instanceof SignInCancelled ? null : "Couldn't sign you in. Try again.";
  }
  try {
    const contact = await convex.query(api.users.sellerContact, { garageId, buyerId });
    if (!contact) return "This seller isn't accepting texts right now.";
    await Linking.openURL(`sms:${contact.phone}&body=${encodeURIComponent(body(contact.firstName))}`);
    return null;
  } catch {
    return "Couldn't open Messages. Try again.";
  }
}
