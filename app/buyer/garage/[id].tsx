import { useConvex, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { startCheckout } from "../../../src/buyer/checkout";
import { formatPrice, itemLabel } from "../../../src/buyer/format";
import { useBuyerLocation } from "../../../src/buyer/location";
import { colors, fonts } from "../../../src/theme";

export default function BuyerGarage() {
  const { id, selected } = useLocalSearchParams<{ id: string; selected?: string }>();
  const garageId = id as Id<"garages">;
  const location = useBuyerLocation();
  const convex = useConvex();
  const garage = useQuery(api.buyer.garage, location ? { garageId, lat: location.lat, lng: location.lng } : "skip");
  const [picked, setPicked] = useState<Id<"items">[]>(selected ? [selected as Id<"items">] : []);
  const [notice, setNotice] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const titles = useRef(new Map<string, string>());
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - 14) / 2;

  useEffect(() => {
    if (!garage) return;
    garage.items.forEach((i) => titles.current.set(i._id, i.title));
    const live = new Set<string>(garage.items.map((i) => i._id));
    const gone = picked.filter((p) => !live.has(p));
    if (gone.length === 0) return;
    setPicked(picked.filter((p) => live.has(p)));
    const names = gone.map((g) => titles.current.get(g) ?? "An item");
    setNotice(`${names.join(" and ")} just got picked up by someone else, so we took ${gone.length > 1 ? "them" : "it"} out of your picks.`);
  }, [garage, picked]);

  const pickedItems = garage?.items.filter((i) => picked.includes(i._id)) ?? [];
  const total = pickedItems.reduce((sum, i) => sum + i.priceCents, 0);

  const toggle = (itemId: Id<"items">) => {
    setNotice(null);
    setPicked((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : [...p, itemId]));
  };

  const buy = async () => {
    setBuying(true);
    try {
      // TODO(SEA-3 F): sign-in is undecided; the buyer is the dev user from EXPO_PUBLIC_DEV_USER_ID, same as the seller screens.
      const buyerId = process.env.EXPO_PUBLIC_DEV_USER_ID as Id<"users"> | undefined;
      if (!buyerId) throw new Error("Set EXPO_PUBLIC_DEV_USER_ID to check out.");
      const orderId = await startCheckout(convex, buyerId, garageId, pickedItems.map((i) => i._id));
      router.replace({ pathname: "/buyer/paid", params: { orderId } });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setBuying(false);
    }
  };

  if (garage === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.muted }}>This garage is gone.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ backgroundColor: colors.brand, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 22, gap: 14 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/buyer"))} hitSlop={12} style={{ alignSelf: "flex-start", minHeight: 24 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.cream }}>← Nearby</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tag, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>{garage?.ownerName.charAt(0) ?? ""}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 30, letterSpacing: -1, color: colors.cream }}>
              {garage ? `${garage.ownerName}'s garage` : " "}
            </Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.cream }}>
              {garage ? `${garage.neighborhood} · about ${garage.distanceMi} mi from you · pickup only` : " "}
            </Text>
          </View>
        </View>
      </View>

      {notice && (
        <View style={{ marginHorizontal: 20, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: colors.tag }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>{notice}</Text>
        </View>
      )}

      {garage === undefined ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 18, padding: 20 }}>
          {garage.items.length === 0 && (
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.muted }}>Everything here is spoken for.</Text>
          )}
          {garage.items.map((item, index) => {
            const on = picked.includes(item._id);
            return (
              <Pressable
                key={item._id}
                onPress={() => toggle(item._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                style={{
                  width: cardWidth,
                  backgroundColor: colors.white,
                  padding: 8,
                  paddingBottom: 12,
                  gap: 8,
                  transform: [{ rotate: index % 2 === 0 ? "-2deg" : "2deg" }],
                  shadowColor: "#E2D6BF",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 1,
                  shadowRadius: 0,
                }}
              >
                <View style={{ height: 150, backgroundColor: colors.line }}>
                  <Image source={{ uri: item.photoUrl }} style={{ flex: 1 }} contentFit="cover" transition={150} />
                  <View style={{ position: "absolute", top: 8, left: 8, backgroundColor: colors.tag, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
                  </View>
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: on ? colors.ink : "rgba(0,0,0,0.15)",
                      borderWidth: on ? 0 : 2,
                      borderColor: colors.white,
                    }}
                  >
                    {on && <Text style={{ color: colors.cream, fontSize: 15 }}>✓</Text>}
                  </View>
                </View>
                <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
                  {itemLabel(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 34, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: "#E2D6BF" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{pickedItems.length} picked</Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{formatPrice(total)}</Text>
        </View>
        <Pressable
          onPress={buy}
          disabled={pickedItems.length === 0 || buying}
          style={{ height: 56, paddingHorizontal: 32, borderRadius: 28, backgroundColor: colors.brand, justifyContent: "center", opacity: pickedItems.length === 0 ? 0.4 : 1 }}
        >
          {buying ? <ActivityIndicator color={colors.cream} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.cream }}>Buy</Text>}
        </Pressable>
      </View>
    </View>
  );
}
