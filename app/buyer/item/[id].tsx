import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatPrice } from "../../../src/buyer/format";
import { useBuyerLocation } from "../../../src/buyer/location";
import { useBuy } from "../../../src/buyer/useBuy";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { colors, fonts, typeSize } from "../../../src/theme";

export default function BuyerItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useBuyerLocation();
  const item = useQuery(api.buyer.item, location ? { itemId: id as Id<"items">, lat: location.lat, lng: location.lng } : "skip");
  const { buy, buying, error } = useBuy((item?.garage._id ?? "") as Id<"garages">);

  if (item === undefined) return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  if (item === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", padding: 20, gap: 16 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, color: colors.muted }}>This one's no longer available.</Text>
        <Pressable onPress={() => router.replace("/buyer")}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: typeSize.row, color: colors.brand }}>Back to browsing</Text>
        </Pressable>
      </View>
    );
  }

  const rows = [
    ["Condition", item.condition],
    ["Size", item.size],
    ["Brand", item.brand],
    ["Color", item.color],
    ["Category", item.category],
  ].filter((r): r is [string, string] => !!r[1]?.trim());

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View>
          <Image source={{ uri: item.photoUrl }} style={{ width: "100%", aspectRatio: 4 / 5, backgroundColor: colors.line }} contentFit="cover" />
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/buyer"))}
            hitSlop={12}
            style={{ position: "absolute", top: 56, left: 16, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "rgba(255,246,229,0.92)", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: typeSize.row, color: colors.ink }}>← Nearby</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 18, gap: 10 }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: colors.tag, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontFamily: fonts.display, fontSize: typeSize.heroPrice, lineHeight: 36, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: typeSize.itemTitle, lineHeight: 28, color: colors.ink }}>{item.title}</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/buyer/garage/[id]", params: { id: item.garage._id, selected: item._id } })}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, height: 64 }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: item.garage.avatarColor ?? colors.tag, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontFamily: fonts.display, fontSize: typeSize.listPrice, color: colors.ink }}>{item.garage.ownerName.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: typeSize.row, color: colors.ink }}>{item.garage.ownerName}'s yard</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: typeSize.meta, color: colors.muted }}>
                {item.garage.distanceMi} mi · {item.garage.liveCount} {item.garage.liveCount === 1 ? "item" : "items"}
              </Text>
            </View>
            <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
          </Pressable>
          {rows.length > 0 && (
            <View style={{ backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16 }}>
              {rows.map(([label, value], i) => (
                <View
                  key={label}
                  style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}
                >
                  <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, color: colors.muted }}>{label}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: typeSize.row, color: colors.ink }}>{value}</Text>
                </View>
              ))}
            </View>
          )}
          {!!item.description.trim() && (
            <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, lineHeight: 22, color: colors.ink }}>{item.description}</Text>
          )}
          {error && <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>{error}</Text>}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 34, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <PrimaryButton label={`Buy · ${formatPrice(item.priceCents)}`} onPress={() => buy([item._id])} loading={buying} />
      </View>
    </View>
  );
}
