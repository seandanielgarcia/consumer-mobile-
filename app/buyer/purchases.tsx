import { useQueries } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EmptyState } from "../../src/buyer/EmptyState";
import { formatPrice } from "../../src/buyer/format";
import { loadPurchases } from "../../src/buyer/purchaseHistory";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, surfaces, sys } from "../../src/theme";

type Order = NonNullable<FunctionReturnType<typeof api.orders.getOrder>>;
const statusLabel = {
  pending: "Payment pending",
  paid: "Paid",
  picked_up: "Picked up",
  cancelled: "Cancelled",
} satisfies Record<Order["status"], string>;

export default function MyPurchases() {
  const user = useCurrentUser();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={sys.title}>My purchases</Text>
      {user ? (
        <PurchaseList key={user.userId} buyerId={user.userId} />
      ) : (
        <Text style={sys.body}>Sign in to see purchases saved on this phone.</Text>
      )}
    </ScrollView>
  );
}

function PurchaseList({ buyerId }: { buyerId: Id<"users"> }) {
  const [purchases, setPurchases] = useState<Awaited<ReturnType<typeof loadPurchases>>>();
  const [storageError, setStorageError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setStorageError(false);
    loadPurchases(buyerId).then(
      (rows) => { if (active) setPurchases(rows); },
      () => { if (active) setStorageError(true); },
    );
    return () => { active = false; };
  }, [buyerId]));

  const queries = useMemo(() => Object.fromEntries((purchases ?? []).map(({ orderId }) => [
    orderId, { query: api.orders.getOrder, args: { orderId } },
  ])), [purchases]);
  const orders = useQueries(queries) as Record<string, Order | null | Error | undefined>;

  if (storageError) return <Text style={sys.body}>Couldn't load purchases. Reopen this screen to try again.</Text>;
  if (!purchases) return <ActivityIndicator color={colors.brand} />;
  if (!purchases.length) {
    return (
      <View style={styles.empty}>
        <EmptyState headline="No purchases yet" line="Checkouts from this phone will appear here." action="Browse nearby" onAction={() => router.dismissTo("/buyer")} />
      </View>
    );
  }

  return purchases.map(({ orderId, time }) => {
    const order = orders[orderId];
    if (order === undefined) return <ActivityIndicator key={orderId} color={colors.brand} />;
    if (!order || order instanceof Error) {
      return <Text key={orderId} style={sys.label}>This purchase is unavailable.</Text>;
    }
    const item = order.items[0];
    const canOpen = order.status === "paid" || order.status === "picked_up";
    const title = !item ? "Purchase" : order.items.length > 1 ? `${item.title} + ${order.items.length - 1} more` : item.title;

    return (
      <Pressable
        key={orderId}
        onPress={canOpen ? () => router.push({ pathname: "/buyer/paid", params: { orderId, fromPurchases: "1" } }) : undefined}
        disabled={!canOpen}
        accessibilityRole={canOpen ? "button" : undefined}
        accessibilityHint={canOpen ? "Opens your receipt" : undefined}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        {item && <Image source={{ uri: item.photoUrl }} contentFit="cover" style={styles.photo} />}
        <View style={styles.summary}>
          <Text numberOfLines={1} style={styles.itemTitle}>{title}</Text>
          <Text numberOfLines={1} style={sys.label}>
            {order.sellerName} · {new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </Text>
          <View style={[styles.badge, canOpen && { backgroundColor: colors.lime }]}>
            <Text style={styles.status}>{statusLabel[order.status]}</Text>
          </View>
        </View>
        <Text style={sys.price}>{formatPrice(order.totalCents)}{canOpen ? " ›" : ""}</Text>
      </Pressable>
    );
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 14 },
  empty: { ...surfaces.card, padding: 20 },
  card: { ...surfaces.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  photo: { width: 62, height: 68, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  summary: { flex: 1, minWidth: 0, gap: 4 },
  itemTitle: { ...sys.row, fontWeight: "700" },
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surfaceMuted },
  status: { ...sys.label, color: colors.ink, fontWeight: "600" },
});
