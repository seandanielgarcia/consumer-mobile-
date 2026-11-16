import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { isCheckingOut } from "../../../src/buyer/checkout";
import { EmptyState } from "../../../src/buyer/EmptyState";
import { aboutMiles, detailLine, formatPrice } from "../../../src/buyer/format";
import { ItemCard } from "../../../src/buyer/ItemCard";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { useBuyerLocation } from "../../../src/buyer/location";
import { formatPlace } from "../../../src/lib/place";
import { useCurrentUser } from "../../../src/lib/useCurrentUser";
import { pinFor } from "../../../src/buyer/pins";
import { colors, shadows, spacing, sys } from "../../../src/theme";

export default function BuyerGarage() {
  const { id, selected, notice: returnNotice } = useLocalSearchParams<{ id: string; selected?: string; notice?: string }>();
  const garageId = id as Id<"garages">;
  const location = useBuyerLocation();
  const buyerId = useCurrentUser()?.userId;
  const [now, setNow] = useState(() => Math.floor(Date.now() / 30000) * 30000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 30000) * 30000), 30000);
    return () => clearInterval(timer);
  }, []);
  const garage = useQuery(api.buyer.garage, { garageId, lat: location.lat, lng: location.lng, buyerId, now });
  const mine = useQuery(api.garages.mine, buyerId ? { ownerId: buyerId } : "skip");
  const isOwner = mine?.garage._id === garageId;
  const [picked, setPicked] = useState<Id<"items">[]>(selected ? (selected.split(",") as Id<"items">[]) : []);
  const [notice, setNotice] = useState<string | null>(returnNotice ?? null);
  const titles = useRef(new Map<string, string>());
  const removeUnavailable = useCallback((itemIds: Id<"items">[]) => {
    setPicked((current) => current.filter((id) => !itemIds.includes(id)));
    const names = itemIds.map((id) => titles.current.get(id) ?? "An item");
    setNotice(names.map((name) => `${name} just got taken, so we removed it from your picks.`).join(" "));
  }, []);
  const buy = () => router.push({ pathname: "/buyer/confirm", params: { garageId, items: pickedItems.map((i) => i._id).join(",") } });
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - 12) / 2;

  useEffect(() => {
    if (!garage) return;
    garage.items.forEach((i) => titles.current.set(i._id, i.title));
    const live = new Set<string>(garage.items.map((i) => i._id));
    const gone = picked.filter((p) => !live.has(p));
    if (gone.length > 0 && !isCheckingOut()) removeUnavailable(gone);
  }, [garage, picked, removeUnavailable]);

  const pickedItems = garage?.items.filter((i) => picked.includes(i._id)) ?? [];
  const total = pickedItems.reduce((sum, i) => sum + i.priceCents, 0);

  const allPicked = !!garage && garage.items.length > 0 && pickedItems.length === garage.items.length;
  const pickAll = () => {
    setNotice(null);
    setPicked(allPicked ? [] : (garage?.items.map((i) => i._id) ?? []));
  };

  const toggle = (itemId: Id<"items">) => {
    setNotice(null);
    setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };


  if (garage === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState headline="This yard is gone" line="The seller closed it." action="Back to browsing" onAction={() => router.dismissTo("/buyer")} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ marginHorizontal: 20, marginTop: 4, marginBottom: 4, padding: 12, borderRadius: spacing.card, backgroundColor: colors.white, flexDirection: "row", alignItems: "center", gap: 12, ...shadows.card }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: pinFor(garageId).bg, borderWidth: 3, borderColor: colors.white, alignItems: "center", justifyContent: "center", ...shadows.pin }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: pinFor(garageId).fg }}>{garage?.ownerName.charAt(0).toUpperCase() ?? ""}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ ...sys.header, fontWeight: "800" }}>
            {garage ? `${garage.ownerName}'s yard` : " "}
          </Text>
          <Text numberOfLines={1} style={{ ...sys.label, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11 }}>
              {garage
                ? detailLine([
                    formatPlace(garage),
                    garage.distanceMi <= 10 && aboutMiles(garage.distanceMi),
                    `${garage.items.length} ${garage.items.length === 1 ? "item" : "items"}`,
                  ])
                : " "}
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 20 }}>
        {notice && (
          <View style={{ padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.pink }}>
            <Text style={sys.row}>{notice}</Text>
          </View>
        )}

        {garage === undefined ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
        ) : garage.items.length === 0 ? (
          <EmptyState headline="Everything here sold" line="Check other yards nearby." action="Back to browsing" onAction={() => router.dismissTo("/buyer")} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 20 }}>
            {isOwner && <Text style={{ ...sys.label, width: "100%" }}>This is how buyers see your yard</Text>}
            {!isOwner && (
              <View style={{ width: "100%", flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ ...sys.label, flex: 1 }}>Tap an item for details or + to pick it.</Text>
                {garage.items.length > 1 && (
                  <Pressable
                    onPress={pickAll}
                    accessibilityRole="button"
                    style={({ pressed }) => ({
                      minHeight: 44, justifyContent: "center", paddingHorizontal: 14,
                      borderRadius: 999, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ ...sys.label, color: colors.ink }}>{allPicked ? "Clear picks" : "Pick all"}</Text>
                  </Pressable>
                )}
              </View>
            )}
            {garage.items.map((item) => {
              const inPicks = picked.includes(item._id);
              return (
                <View key={item._id} style={{ width: cardWidth }}>
                  <ItemCard
                    item={item}
                    width={cardWidth}
                    selected={!isOwner && inPicks}
                    onPress={() => router.push({ pathname: "/buyer/item/[id]", params: { id: item._id, fromYard: "1" } })}
                  />
                  {!isOwner && (
                    <Pressable
                      onPress={() => toggle(item._id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: inPicks }}
                      accessibilityLabel={`Pick ${item.title}`}
                      style={({ pressed }) => ({
                        position: "absolute", top: 9, right: 9, width: 44, height: 44,
                        alignItems: "center", justifyContent: "center",
                        transform: [{ scale: pressed ? 0.92 : 1 }],
                      })}
                    >
                      <View style={{
                        width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.white,
                        backgroundColor: inPicks ? colors.lime : colors.white,
                        alignItems: "center", justifyContent: "center", ...shadows.pin,
                      }}>
                        <Text style={{ ...sys.button, fontSize: inPicks ? 15 : 21, lineHeight: 24, color: colors.ink }}>
                          {inPicks ? "✓" : "+"}
                        </Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {!isOwner && pickedItems.length > 0 && (
        <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 34, backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <PrimaryButton
            label={`Buy ${pickedItems.length} · ${formatPrice(total)}`}
            onPress={buy}
          />
        </View>
      )}
    </View>
  );
}
