import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { detailLine, formatPrice } from "../../src/buyer/format";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { colors, fonts, type } from "../../src/theme";

export default function BuyerPaid() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const order = useQuery(api.orders.getOrder, orderId ? { orderId: orderId as Id<"orders"> } : "skip");

  if (order === undefined && orderId) {
    return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  }

  const paid = order?.status === "paid" || order?.status === "picked_up";
  const pending = order?.status === "pending";
  const heading = !order ? "Order not found" : paid ? "Paid" : pending ? "Confirming payment…" : "Order cancelled";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingTop: 72, paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}>
        {(paid || pending) && (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tag, alignItems: "center", justifyContent: "center" }}>
            {paid ? <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>✓</Text> : <ActivityIndicator color={colors.ink} />}
          </View>
        )}
        <Text style={{ fontFamily: fonts.display, fontSize: type.hero, letterSpacing: -1, color: colors.ink }}>{heading}</Text>
        {order && paid && (
          <Text style={{ fontFamily: fonts.body, fontSize: type.sentence, lineHeight: 24, color: colors.ink }}>{order.sellerName} will text you to meet up.</Text>
        )}
        {order && order.items.length > 0 && (
          <View style={{ backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 12, marginTop: 12 }}>
            {order.items.map((item, i) => (
              <View
                key={item._id}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}
              >
                <Image source={{ uri: item.photoUrl }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.line }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: type.row, color: colors.ink }}>
                    {item.title}
                  </Text>
                  {detailLine([item.condition, item.size, item.brand]) !== "" && (
                    <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: type.meta, color: colors.muted }}>
                      {detailLine([item.condition, item.size, item.brand])}
                    </Text>
                  )}
                </View>
                <Text style={{ fontFamily: fonts.display, fontSize: 16, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52, borderTopWidth: 1, borderTopColor: colors.hairline }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: type.row, color: colors.ink }}>Total</Text>
              <Text style={{ fontFamily: fonts.display, fontSize: type.listPrice, color: colors.ink }}>{formatPrice(order.totalCents)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 34 }}>
        <PrimaryButton label="Keep shopping" onPress={() => router.replace("/buyer")} />
      </View>
    </View>
  );
}
