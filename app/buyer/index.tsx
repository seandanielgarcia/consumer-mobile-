import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, TextStyle, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { EmptyState } from "../../src/buyer/EmptyState";
import { ItemCard } from "../../src/buyer/ItemCard";
import { locateMe, locatePlace, SF_FALLBACK, useBuyerLocation } from "../../src/buyer/location";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useHeaderBack } from "../../src/lib/headerBack";
import { startSelling } from "../../src/lib/sell";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, sys } from "../../src/theme";

const noOutline = { outlineStyle: "none" } as unknown as TextStyle;

function Pill({ label, suffix, active, onPress }: { label: string; suffix?: string; active: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        height: 36,
        maxWidth: 220,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: active ? colors.ink : "transparent",
        borderWidth: 1,
        borderColor: active ? colors.ink : colors.line,
      }}
    >
      <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: active ? "600" : "400", color: active ? colors.cream : colors.ink }}>
        {label}
      </Text>
      {suffix && <Text style={{ fontSize: 15, color: active ? colors.cream : colors.ink }}>{suffix}</Text>}
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
  const run = async (find: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    const found = await find().catch(() => null);
    setBusy(false);
    if (found) close();
    else setError(failure);
  };
  const findPlace = () => place.trim() && run(() => locatePlace(place.trim()), "Couldn't find that place. Try a neighborhood or street.");

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: colors.cream, paddingHorizontal: 20, gap: 20 }}>
        <View style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <Pressable onPress={close} accessibilityRole="button" style={{ position: "absolute", left: 0, height: 44, justifyContent: "center" }}>
            <Text style={{ ...sys.row, fontSize: 17, color: colors.brand }}>Close</Text>
          </Pressable>
          <Text style={{ ...sys.button, color: colors.ink }}>Shop near</Text>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={sys.label}>Distance</Text>
          <View style={{ flexDirection: "row", backgroundColor: colors.white, borderRadius: 999, borderWidth: 1, borderColor: colors.hairline, padding: 3 }}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                onPress={() => onRadius(r)}
                accessibilityRole="button"
                accessibilityState={{ selected: radiusMiles === r }}
                style={{ flex: 1, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: radiusMiles === r ? colors.ink : "transparent" }}
              >
                <Text style={{ ...sys.button, fontSize: 15, color: radiusMiles === r ? colors.cream : colors.ink }}>{r} mi</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={sys.label}>Neighborhood or address</Text>
          <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline, flexDirection: "row", alignItems: "center", paddingLeft: 14 }}>
            <TextInput
              value={place}
              onChangeText={setPlace}
              placeholder="Mission, San Francisco"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Neighborhood or address"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={findPlace}
              style={[{ flex: 1, ...sys.body }, noOutline]}
            />
            <Pressable disabled={busy || !place.trim()} onPress={findPlace} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 14, justifyContent: "center", opacity: place.trim() ? 1 : 0.4 }}>
              <Text style={{ ...sys.button, color: colors.brand }}>Go</Text>
            </Pressable>
          </View>
          {busy && <ActivityIndicator color={colors.ink} />}
          {error && <Text style={{ ...sys.row, color: colors.ink }}>{error}</Text>}
          <Text style={sys.label}>Only a rough area (about 1 km) is used.</Text>
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ paddingBottom: 34 }}>
          <PrimaryButton
            label="Use my location"
            loading={busy}
            onPress={() =>
              run(
                async () => ((await locateMe()) === SF_FALLBACK ? null : true),
                "Location is off, so we're showing San Francisco. Turn it on in Settings, or type a place.",
              )
            }
          />
        </View>
      </View>
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
  useHeaderBack("Home", () => router.dismissTo("/"));
  const myYard = useQuery(api.garages.mine, buyerId ? { ownerId: buyerId } : "skip");
  const isDemoUser = useQuery(api.users.isDemoUser, buyerId ? { userId: buyerId } : "skip");
  const { width } = useWindowDimensions();
  const cardWidth = (width - 40 - 12) / 2;

  const results = useQuery(api.buyer.search, { q, lat: location.lat, lng: location.lng, radiusMiles, buyerId, now });
  const sizes = useMemo(
    () => [...new Set((results ?? []).flatMap((r) => (r.size ? [r.size] : [])))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [results],
  );
  const shown = useMemo(() => {
    return (results ?? []).filter((r) => (!size || r.size === size) && (!under30 || r.priceCents < 3000));
  }, [results, size, under30]);
  const wider = RADII.find((r) => r > radiusMiles);
  const filtered = !!size || under30;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={sys.title}>Near you</Text>
          <Pressable
            onPress={() => (myYard ? router.dismissTo("/") : startSelling(__DEV__ || isDemoUser === true))}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: "center", paddingLeft: 12 }}
          >
            <Text style={{ ...sys.button, color: colors.brand }}>{myYard ? "Your yard" : "Sell"}</Text>
          </Pressable>
        </View>

        <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
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
            clearButtonMode="while-editing"
            style={[{ flex: 1, ...sys.body }, noOutline]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pill label={location.label} suffix={` · ${radiusMiles} mi ▾`} active={false} onPress={() => setSheetOpen(true)} />
          <Pill label={size ? `Size ${size} ▾` : "Size ▾"} active={!!size} onPress={() => setSizeOpen((o) => !o)} />
          <Pill label="Under $30" active={under30} onPress={() => setUnder30((u) => !u)} />
        </ScrollView>
        {sizeOpen && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {sizes.length === 0 && <Text style={sys.label}>No sizes in these results</Text>}
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
          <EmptyState
            headline={q.trim() ? `No "${q.trim()}" within ${radiusMiles} mi yet` : `Nothing within ${radiusMiles} mi yet`}
            line={filtered ? "Your filters may be hiding some." : wider ? "Try looking a little farther." : "Check back soon."}
            action={filtered ? "Clear filters" : wider ? `Try ${wider} mi` : undefined}
            onAction={() => {
              if (filtered) {
                setSize(null);
                setUnder30(false);
              } else if (wider) setRadiusMiles(wider);
            }}
          />
        ) : (
          <>
            <Text style={sys.label}>
              {shown.length} {shown.length === 1 ? "item" : "items"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 20 }}>
              {shown.map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  width={cardWidth}
                  onPress={() => {
                    Keyboard.dismiss();
                    router.push({ pathname: "/buyer/item/[id]", params: { id: item._id } });
                  }}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
      <LocationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} radiusMiles={radiusMiles} onRadius={setRadiusMiles} />
    </View>
  );
}
