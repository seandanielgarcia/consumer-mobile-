import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { formatPrice, itemLabel } from "../../src/buyer/format";
import { useBuyerLocation } from "../../src/buyer/location";
import { colors, fonts } from "../../src/theme";

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{
        height: 32,
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? colors.ink : "transparent",
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.line,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: active ? fonts.semibold : fonts.body, color: active ? colors.cream : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BuyerNearYou() {
  const location = useBuyerLocation();
  const [q, setQ] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [under30, setUnder30] = useState(false);
  const [closest, setClosest] = useState(true);
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 12) / 2;

  const results = useQuery(api.buyer.search, location ? { q, lat: location.lat, lng: location.lng } : "skip");
  const sizes = useMemo(
    () => [...new Set((results ?? []).flatMap((r) => (r.size ? [r.size] : [])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [results],
  );
  const shown = useMemo(() => {
    const list = (results ?? []).filter((r) => (!size || !r.size || r.size === size) && (!under30 || r.priceCents < 3000));
    return closest ? [...list].sort((a, b) => a.distanceMi - b.distanceMi) : list;
  }, [results, size, under30, closest]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40, gap: 14 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 4 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 30, letterSpacing: -1, color: colors.ink }}>Near you</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{location ? `${location.label} · 2 mi` : "Finding you…"}</Text>
      </View>

      <View style={{ height: 50, borderRadius: 25, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.ink, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2}>
          <Circle cx={11} cy={11} r={7} />
          <Path d="M20 20l-4-4" />
        </Svg>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search jeans, jackets…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search items"
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, fontSize: 17, fontFamily: fonts.body, color: colors.ink }}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pill label={size ? `Size ${size}` : "Size"} active={!!size} onPress={() => setSizeOpen((o) => !o)} />
        <Pill label="Under $30" active={under30} onPress={() => setUnder30((u) => !u)} />
        <Pill label="Closest first" active={closest} onPress={() => setClosest((c) => !c)} />
      </View>
      {sizeOpen && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sizes.length === 0 && <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>No sizes in these results</Text>}
          {sizes.map((s) => (
            <Pill
              key={s}
              label={s}
              active={size === s}
              onPress={() => {
                setSize(size === s ? null : s);
                setSizeOpen(false);
              }}
            />
          ))}
        </View>
      )}

      {results === undefined ? (
        <ActivityIndicator color={colors.ink} style={{ marginTop: 40 }} />
      ) : shown.length === 0 ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: "center", marginTop: 40 }}>
          {q.trim() ? `Nothing matching "${q.trim()}" within 2 mi yet.` : "No garages open within 2 mi yet."}
        </Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 16 }}>
          {shown.map((item) => (
            <Pressable
              key={item._id}
              style={{ width: cardWidth, gap: 6 }}
              onPress={() => router.push({ pathname: "/buyer/garage/[id]", params: { id: item.garageId, selected: item._id } })}
            >
              <View style={{ height: 180, borderRadius: 14, overflow: "hidden", backgroundColor: colors.line }}>
                <Image source={{ uri: item.photoUrl }} style={{ flex: 1 }} contentFit="cover" transition={150} />
                <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: colors.tag, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
                </View>
              </View>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }}>
                {itemLabel(item)}
              </Text>
              {/* TODO(SEA-3 C): second half of the badge, distance ("· 1 mi") vs neighborhood ("· Hayes Valley"). */}
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>
                {item.ownerName}'s garage
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
