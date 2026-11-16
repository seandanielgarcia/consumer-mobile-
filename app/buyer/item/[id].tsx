import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmptyState } from "../../../src/buyer/EmptyState";
import { aboutMiles, formatPrice } from "../../../src/buyer/format";
import { useBuyerLocation } from "../../../src/buyer/location";
import { useCurrentUser } from "../../../src/lib/useCurrentUser";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { pinFor } from "../../../src/buyer/pins";
import { colors, shadows, spacing, surfaces, sys } from "../../../src/theme";

export default function BuyerItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const location = useBuyerLocation();
  const item = useQuery(api.buyer.item, location ? { itemId: id as Id<"items">, lat: location.lat, lng: location.lng } : "skip");
  const userId = useCurrentUser()?.userId;
  const mine = useQuery(api.garages.mine, userId ? { ownerId: userId } : "skip");

  if (item === undefined) return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  if (item === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState headline="This one's gone" line="Someone else got it first." action="Back to browsing" onAction={() => router.dismissTo("/buyer")} />
        </View>
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 12 }}>
        <View style={{ ...surfaces.card, padding: 8 }}>
          <Image source={{ uri: item.photoUrl }} style={{ width: "100%", aspectRatio: 1, borderRadius: spacing.photo, backgroundColor: colors.line }} contentFit="cover" />
          <View style={{ position: "absolute", left: 16, bottom: 16, ...surfaces.sticker, height: 40, paddingHorizontal: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
          </View>
        </View>
        <Text style={sys.title}>{item.title}</Text>
        <Pressable
          onPress={() => router.push({ pathname: "/buyer/garage/[id]", params: { id: item.garage._id, selected: item._id } })}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, height: 68, paddingHorizontal: 12, ...surfaces.card }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pinFor(item.garage._id).bg, borderWidth: 3, borderColor: colors.white, alignItems: "center", justifyContent: "center", ...shadows.pin }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: pinFor(item.garage._id).fg }}>{item.garage.ownerName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...sys.row, fontWeight: "600" }}>{item.garage.ownerName}'s yard</Text>
            <Text style={sys.label}>
              {aboutMiles(item.garage.distanceMi)} · {item.garage.liveCount} {item.garage.liveCount === 1 ? "item" : "items"}
            </Text>
          </View>
          <Text style={{ fontSize: 22, color: colors.muted }}>›</Text>
        </Pressable>
        {rows.length > 0 && (
          <View style={{ ...surfaces.card, paddingHorizontal: 16 }}>
            {rows.map(([label, value], i) => (
              <View
                key={label}
                style={{ height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}
              >
                <Text style={{ ...sys.row, color: colors.muted }}>{label}</Text>
                <Text style={{ ...sys.row, fontWeight: "500" }}>{value}</Text>
              </View>
            ))}
          </View>
        )}
        {!!item.description.trim() && <Text style={sys.body}>{item.description}</Text>}
      </ScrollView>
      {mine?.garage._id === item.garage._id ? null : (
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, backgroundColor: colors.cream }}>
          <PrimaryButton label={`Buy · ${formatPrice(item.priceCents)}`} onPress={() => router.push({ pathname: "/buyer/confirm", params: { garageId: item.garage._id, items: item._id } })} />
        </View>
      )}
    </View>
  );
}
