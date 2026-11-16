import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PAID_GRACE_MS } from "../../src/buyer/checkout";
import { detailLine, formatPrice } from "../../src/buyer/format";
import { PAYMENT_FAILED } from "../../src/buyer/useBuy";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { colors, sys } from "../../src/theme";

export default function BuyerPaid() {
  const { orderId, garageId, items } = useLocalSearchParams<{ orderId?: string; garageId?: string; items?: string }>();
  const order = useQuery(api.orders.getOrder, orderId ? { orderId: orderId as Id<"orders"> } : "skip");
  const [graceOver, setGraceOver] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setGraceOver(true), PAID_GRACE_MS);
    return () => clearTimeout(timer);
  }, []);
  const unpaid = order && (order.status === "cancelled" || (order.status === "pending" && graceOver));
  useEffect(() => {
    if (!unpaid || !garageId) return;
    router.replace({ pathname: "/buyer/garage/[id]", params: { id: garageId, selected: items ?? "", notice: PAYMENT_FAILED } });
  }, [unpaid, garageId]);

  if (order === undefined && orderId) {
    return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  }

  const paid = order?.status === "paid" || order?.status === "picked_up";
  const pending = order?.status === "pending";
  const heading = !order ? "Order not found" : paid ? "Paid" : pending ? "Confirming payment…" : "Order cancelled";

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}>
        {(paid || pending) && (
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tag, alignItems: "center", justifyContent: "center" }}>
            {paid ? <Text style={{ ...sys.title, lineHeight: 32 }}>✓</Text> : <ActivityIndicator color={colors.ink} />}
          </View>
        )}
        <Text style={sys.hero}>{heading}</Text>
        {order && paid && (
          <Text style={sys.sentence}>{order.sellerName} will text you to set up pickup.</Text>
        )}
        {order && order.items.length > 0 && (
          <View style={{ backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16, marginTop: 12 }}>
            {order.items.map((item, i) => (
              <View
                key={item._id}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}
              >
                <Image source={{ uri: item.photoUrl }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.line }} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ ...sys.row, fontWeight: "600" }}>
                    {item.title}
                  </Text>
                  {detailLine([item.condition, item.size && `Size ${item.size}`, item.brand]) !== "" && (
                    <Text numberOfLines={1} style={sys.label}>
                      {detailLine([item.condition, item.size && `Size ${item.size}`, item.brand])}
                    </Text>
                  )}
                </View>
                <Text style={sys.price}>{formatPrice(item.priceCents)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52, borderTopWidth: 1, borderTopColor: colors.hairline }}>
              <Text style={{ ...sys.row, fontWeight: "600" }}>Total</Text>
              <Text style={sys.price}>{formatPrice(order.totalCents)}</Text>
            </View>
          </View>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 34 }}>
        <PrimaryButton label="Back to browsing" onPress={() => router.dismissTo("/buyer")} />
      </View>
    </View>
  );
}
