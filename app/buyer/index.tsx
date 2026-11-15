import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, TextStyle, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { ItemCard } from "../../src/buyer/ItemCard";
import { locateMe, locatePlace, useBuyerLocation } from "../../src/buyer/location";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, type, typeSize } from "../../src/theme";

const noOutline = { outlineStyle: "none" } as unknown as TextStyle;

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
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
      <Text style={{ fontSize: typeSize.meta, fontFamily: active ? fonts.semibold : fonts.body, color: active ? colors.cream : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

const RADII = [1, 2, 5, 10];

function LocationSheet({
  visible,
  onClose,
  radiusMiles,
  onRadius,
}: {
  visible: boolean;
  onClose: () => void;
  radiusMiles: number;
  onRadius: (r: number) => void;
}) {
  const [place, setPlace] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setPlace("");
    setError(null);
    onClose();
  };
  const run = async (find: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    const found = await find().catch(() => null);
    setBusy(false);
    if (found) close();
    else setError("Couldn't find that place. Try a neighborhood or street.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(17,17,17,0.35)" }} onPress={close} />
      <KeyboardAvoidingView behavior="padding">
        <View style={{ backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, gap: 14 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: type.title.fontSize, color: colors.ink }}>Shop near…</Text>
          <View style={{ flexDirection: "row", backgroundColor: colors.white, borderRadius: 999, borderWidth: 1, borderColor: colors.line, padding: 3 }}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                onPress={() => onRadius(r)}
                accessibilityRole="button"
                accessibilityState={{ selected: radiusMiles === r }}
                style={{ flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: radiusMiles === r ? colors.ink : "transparent" }}
              >
                <Text style={{ fontFamily: fonts.semibold, fontSize: type.row.fontSize, color: radiusMiles === r ? colors.cream : colors.ink }}>{r} mi</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            disabled={busy}
            onPress={() => run(locateMe)}
            style={{ height: 52, borderRadius: 999, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.cream }}>Use my location</Text>
          </Pressable>
          <View style={{ height: 50, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 6 }}>
            <TextInput
              value={place}
              onChangeText={setPlace}
              placeholder="Neighborhood or address"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Neighborhood or address"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => place.trim() && run(() => locatePlace(place.trim()))}
              style={[{ flex: 1, fontSize: 16, fontFamily: fonts.body, color: colors.ink }, noOutline]}
            />
            <Pressable
              disabled={busy || !place.trim()}
              onPress={() => run(() => locatePlace(place.trim()))}
              style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, backgroundColor: colors.brand, justifyContent: "center", opacity: place.trim() ? 1 : 0.4 }}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.cream }}>Go</Text>
            </Pressable>
          </View>
          {busy && <ActivityIndicator color={colors.ink} />}
          {error && <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted }}>{error}</Text>}
          <Text style={{ fontFamily: fonts.body, fontSize: typeSize.meta, color: colors.muted }}>Only a rough area (about 1 km) is used.</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function BuyerNearYou() {
  const location = useBuyerLocation();
  const [q, setQ] = useState("");
  const [size, setSize] = useState<string | null>(null);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [under30, setUnder30] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(2);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 30000) * 30000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 30000) * 30000), 30000);
    return () => clearInterval(timer);
  }, []);
  const buyerId = useCurrentUser()?.userId;
  const { width } = useWindowDimensions();
  const cardWidth = (width - 32 - 12) / 2;

  const results = useQuery(api.buyer.search, { q, lat: location.lat, lng: location.lng, radiusMiles, buyerId, now });
  const sizes = useMemo(
    () => [...new Set((results ?? []).flatMap((r) => (r.size ? [r.size] : [])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [results],
  );
  const shown = useMemo(() => {
    return (results ?? []).filter((r) => (!size || !r.size || r.size === size) && (!under30 || r.priceCents < 3000));
  }, [results, size, under30]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: fonts.display, fontSize: typeSize.title, letterSpacing: -0.5, color: colors.ink }}>Near you</Text>

      <View style={{ height: 44, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2}>
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
          style={[{ flex: 1, fontSize: type.row.fontSize, fontFamily: fonts.body, color: colors.ink }, noOutline]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill label={`${location.label} · ${radiusMiles} mi ▾`} active={false} onPress={() => setSheetOpen(true)} />
        <Pill label={size ? `Size ${size} ▾` : "Size ▾"} active={!!size} onPress={() => setSizeOpen((o) => !o)} />
        <Pill label="Under $30" active={under30} onPress={() => setUnder30((u) => !u)} />
      </ScrollView>
      {sizeOpen && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sizes.length === 0 && <Text style={{ fontFamily: fonts.body, fontSize: type.meta.fontSize, color: colors.muted }}>No sizes in these results</Text>}
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
        <Text style={{ fontFamily: fonts.body, fontSize: type.row.fontSize, color: colors.muted, textAlign: "center", marginTop: 40 }}>
          {q.trim() ? `Nothing matching "${q.trim()}" within ${radiusMiles} mi yet.` : `Nothing within ${radiusMiles} mi yet.`}
        </Text>
      ) : (
        <>
          <Text style={{ fontFamily: fonts.body, fontSize: type.meta.fontSize, color: colors.muted }}>
            {shown.length} {shown.length === 1 ? "item" : "items"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 16 }}>
            {shown.map((item) => (
              <ItemCard key={item._id} item={item} width={cardWidth} onPress={() => router.push({ pathname: "/buyer/item/[id]", params: { id: item._id } })} />
            ))}
          </View>
        </>
      )}
      <LocationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} radiusMiles={radiusMiles} onRadius={setRadiusMiles} />
    </ScrollView>
  );
}
