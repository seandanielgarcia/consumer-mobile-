import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useBuy } from "../../../src/buyer/useBuy";
import { EmptyState } from "../../../src/buyer/EmptyState";
import { aboutMiles, detailLine, formatPrice } from "../../../src/buyer/format";
import { ItemCard } from "../../../src/buyer/ItemCard";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { useBuyerLocation } from "../../../src/buyer/location";
import { useHeaderBack } from "../../../src/lib/headerBack";
import { formatPlace } from "../../../src/lib/place";
import { useCurrentUser } from "../../../src/lib/useCurrentUser";
import { colors, sys } from "../../../src/theme";

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
  const { buy: buyItems, buying, error, checkingOut, myOrderItemIds } = useBuy(garageId, (itemId) => removeUnavailable([itemId]));
  const buy = () => buyItems(pickedItems.map((i) => i._id));
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - 12) / 2;
  useHeaderBack("Back", () => (router.canGoBack() ? router.back() : router.replace("/buyer")));

  useEffect(() => {
    if (!garage) return;
    garage.items.forEach((i) => titles.current.set(i._id, i.title));
    const live = new Set<string>(garage.items.map((i) => i._id));
    const gone = picked.filter((p) => !live.has(p) && !myOrderItemIds.includes(p));
    if (gone.length > 0 && !checkingOut.current) removeUnavailable(gone);
  }, [garage, picked, buying, checkingOut, removeUnavailable, myOrderItemIds]);

  const pickedItems = garage?.items.filter((i) => picked.includes(i._id)) ?? [];
  const total = pickedItems.reduce((sum, i) => sum + i.priceCents, 0);

  const allPicked = !!garage && garage.items.length > 0 && pickedItems.length === garage.items.length;
  const everythingCents = garage?.items.reduce((sum, i) => sum + i.priceCents, 0) ?? 0;
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
      <View style={{ backgroundColor: colors.brand, paddingTop: 4, paddingHorizontal: 20, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.tag, alignItems: "center", justifyContent: "center" }}>
          <Text style={sys.header}>{garage?.ownerName.charAt(0) ?? ""}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ ...sys.title, color: colors.cream }}>
            {garage ? `${garage.ownerName}'s yard` : " "}
          </Text>
          <Text numberOfLines={1} style={{ ...sys.label, color: colors.cream }}>
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
        {(notice ?? error) && (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline }}>
            <Text style={sys.row}>{notice ?? error}</Text>
          </View>
        )}

        {garage === undefined ? (
          <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
        ) : garage.items.length === 0 ? (
          <EmptyState headline="Everything here sold" line="Check other yards nearby." action="Back to browsing" onAction={() => router.dismissTo("/buyer")} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 20 }}>
            {isOwner && <Text style={{ ...sys.label, width: "100%" }}>This is how buyers see your yard</Text>}
            {!isOwner && garage.items.length > 1 && (
              <Pressable
                onPress={pickAll}
                accessibilityRole="button"
                style={{ width: "100%", height: 44, justifyContent: "center", alignItems: "center", borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink }}
              >
                <Text style={{ ...sys.button, fontSize: 15, color: colors.ink }}>
                  {allPicked ? "Clear picks" : `Pick all ${garage.items.length} · ${formatPrice(everythingCents)}`}
                </Text>
              </Pressable>
            )}
            {garage.items.map((item) => (
              <ItemCard
                key={item._id}
                item={item}
                width={cardWidth}
                selected={isOwner ? undefined : picked.includes(item._id)}
                onPress={isOwner ? undefined : () => toggle(item._id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {!isOwner && (
        <View style={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 34, backgroundColor: colors.cream, borderTopWidth: 1, borderTopColor: colors.hairline }}>
          <PrimaryButton
            label={pickedItems.length ? `Buy ${pickedItems.length} · ${formatPrice(total)}` : "Tap items to pick"}
            onPress={buy}
            disabled={pickedItems.length === 0}
            loading={buying}
          />
        </View>
      )}
    </View>
  );
}
