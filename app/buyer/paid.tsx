import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatPrice, itemLabel } from "../../src/buyer/format";
import { colors, fonts } from "../../src/theme";

export default function BuyerPaid() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const order = useQuery(api.orders.getOrder, orderId ? { orderId: orderId as Id<"orders"> } : "skip");

  if (order === undefined && orderId) {
    return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  }

  const firstName = order?.sellerName.trim().split(/\s+/, 1)[0] ?? "";
  const sellerName = /^\p{L}[\p{L}\p{M}ʼ’'.-]*$/u.test(firstName) ? firstName : "The seller";
  const paid = order?.status === "paid" || order?.status === "picked_up";
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingTop: 58, paddingHorizontal: 20, paddingBottom: 20, gap: 20 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 44, letterSpacing: -1.5, color: colors.ink }}>
          {!order
            ? "Order not found"
            : paid
              ? `Paid ${formatPrice(order.totalCents)}`
              : order.status === "cancelled"
                ? "Order cancelled"
                : "Confirming payment…"}
        </Text>
        {order?.status === "pending" && <ActivityIndicator color={colors.ink} style={{ alignSelf: "flex-start" }} />}
        {order?.items.map((item) => (
          <View key={item._id} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.white, borderRadius: 18, padding: 10 }}>
            <Image source={{ uri: item.photoUrl }} style={{ width: 56, height: 68, borderRadius: 10, backgroundColor: colors.line }} contentFit="cover" />
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink }}>
              {itemLabel(item)}
            </Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 18, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
          </View>
        ))}
        {order && paid && (
          <Text style={{ fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.ink }}>
            {sellerName} got a text. They'll message you to meet up.
          </Text>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 34 }}>
        <Pressable
          onPress={() => router.dismissTo("/buyer")}
          style={{ height: 60, borderRadius: 30, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.cream }}>Back to browsing</Text>
        </Pressable>
      </View>
    </View>
  );
}
