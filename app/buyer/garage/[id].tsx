import { useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useBuy } from "../../../src/buyer/useBuy";
import { formatPrice } from "../../../src/buyer/format";
import { ItemCard } from "../../../src/buyer/ItemCard";
import { PrimaryButton } from "../../../src/components/PrimaryButton";
import { useBuyerLocation } from "../../../src/buyer/location";
import { useCurrentUser } from "../../../src/lib/useCurrentUser";
import { colors, fonts, typeSize } from "../../../src/theme";

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
  const [picked, setPicked] = useState<Id<"items">[]>(selected ? (selected.split(",") as Id<"items">[]) : []);
  const [notice, setNotice] = useState<string | null>(returnNotice ?? null);
  const titles = useRef(new Map<string, string>());
  const removeUnavailable = useCallback((itemIds: Id<"items">[]) => {
    setPicked((current) => current.filter((id) => !itemIds.includes(id)));
    const names = itemIds.map((id) => titles.current.get(id) ?? "An item");
    setNotice(names.map((name) => `${name} just got picked up by someone else, so we took it out of your picks.`).join(" "));
  }, []);
  const { buy: buyItems, buying, error, checkingOut } = useBuy(garageId, (itemId) => removeUnavailable([itemId]));
  const buy = () => buyItems(pickedItems.map((i) => i._id));
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 12) / 2;

  useEffect(() => {
    if (!garage) return;
    garage.items.forEach((i) => titles.current.set(i._id, i.title));
    const live = new Set<string>(garage.items.map((i) => i._id));
    const gone = picked.filter((p) => !live.has(p));
    if (gone.length > 0 && !checkingOut.current) removeUnavailable(gone);
  }, [garage, picked, buying, checkingOut, removeUnavailable]);

  const pickedItems = garage?.items.filter((i) => picked.includes(i._id)) ?? [];
  const total = pickedItems.reduce((sum, i) => sum + i.priceCents, 0);

  const toggle = (itemId: Id<"items">) => {
    setNotice(null);
    setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };


  if (garage === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, justifyContent: "center", alignItems: "center", padding: 20, gap: 16 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, color: colors.muted }}>This yard is gone.</Text>
        <Pressable onPress={() => router.dismissTo("/buyer")} hitSlop={12} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: typeSize.row, color: colors.brand }}>Back to browsing</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ backgroundColor: colors.brand, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 22, gap: 14 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/buyer"))} hitSlop={12} style={{ alignSelf: "flex-start", minHeight: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, color: colors.cream }}>← Nearby</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tag, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>{garage?.ownerName.charAt(0) ?? ""}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 30, letterSpacing: -1, color: colors.cream }}>
              {garage ? `${garage.ownerName}'s yard` : " "}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.cream }}>
              {garage ? `${garage.neighborhood} · about ${garage.distanceMi} mi from you · pickup only` : " "}
            </Text>
          </View>
        </View>
      </View>

      {(notice ?? error) && (
        <View style={{ marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.tag }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>{notice ?? error}</Text>
        </View>
      )}

      {garage === undefined ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 16, padding: 16 }}>
          {garage.items.length === 0 && (
            <Text style={{ fontFamily: fonts.body, fontSize: typeSize.row, color: colors.muted }}>Everything here is spoken for.</Text>
          )}
          {garage.items.map((item) => (
            <ItemCard key={item._id} item={item} width={cardWidth} selected={picked.includes(item._id)} onPress={() => toggle(item._id)} />
          ))}
        </ScrollView>
      )}

      <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 34, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.hairline }}>
        <PrimaryButton
          label={pickedItems.length ? `Buy ${pickedItems.length} · ${formatPrice(total)}` : "Tap items to pick"}
          onPress={buy}
          disabled={pickedItems.length === 0}
          loading={buying}
        />
      </View>
    </View>
  );
}
