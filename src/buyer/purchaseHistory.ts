import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Id } from "../../convex/_generated/dataModel";

const prefixFor = (buyerId: Id<"users">) => `yardsale/purchases/${buyerId}/`;

export async function rememberPurchase(buyerId: Id<"users">, orderId: Id<"orders">) {
  await AsyncStorage.setItem(prefixFor(buyerId) + orderId, String(Date.now()));
}

export async function loadPurchases(buyerId: Id<"users">) {
  const prefix = prefixFor(buyerId);
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (!keys.length) return [];
  const entries = await AsyncStorage.multiGet(keys);
  return entries
    .map(([key, time]) => ({ orderId: key.slice(prefix.length) as Id<"orders">, time: Number(time) }))
    .filter(({ orderId, time }) => /^[a-z0-9]{32}$/.test(orderId) && Number.isFinite(time) && time > 0)
    .sort((a, b) => b.time - a.time);
}
