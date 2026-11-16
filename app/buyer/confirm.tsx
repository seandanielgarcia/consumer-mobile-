import { useConvex, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { isCheckingOut } from "../../src/buyer/checkout";
import { EmptyState } from "../../src/buyer/EmptyState";
import { detailLine, formatPrice } from "../../src/buyer/format";
import { useBuyerLocation } from "../../src/buyer/location";
import { askToBuyText, firstName, textSeller } from "../../src/buyer/textSeller";
import { useBuy } from "../../src/buyer/useBuy";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { SecondaryButton } from "../../src/components/SecondaryButton";
import { formatPlace } from "../../src/lib/place";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { pinFor } from "../../src/buyer/pins";
import { colors, shadows, surfaces, sys } from "../../src/theme";

export default function BuyerConfirm() {
  const params = useLocalSearchParams<{ garageId: string; items: string }>();
  const garageId = typeof params.garageId === "string" && /^[a-z0-9]{32}$/.test(params.garageId)
    ? params.garageId as Id<"garages">
    : null;
  if (!garageId || typeof params.items !== "string" || !params.items) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, paddingHorizontal: 20 }}>
        <EmptyState headline="Nothing selected" line="Pick something you'd like to buy." action="Back to browsing" onAction={() => router.dismissTo("/buyer")} />
      </View>
    );
  }
  return <Confirmation garageId={garageId} selection={params.items} />;
}

function Confirmation({ garageId, selection }: { garageId: Id<"garages">; selection: string }) {
  const convex = useConvex();
  const location = useBuyerLocation();
  const buyerId = useCurrentUser()?.userId;
  const [now, setNow] = useState(() => Math.floor(Date.now() / 30000) * 30000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 30000) * 30000), 30000);
    return () => clearInterval(timer);
  }, []);
  const textable = useQuery(api.users.sellerTextable, { garageId });
  const garage = useQuery(api.buyer.garage, { garageId, lat: location.lat, lng: location.lng, buyerId, now });
  const [itemIds, setItemIds] = useState(() => selection.split(",").filter(Boolean) as Id<"items">[]);
  const [notice, setNotice] = useState<string | null>(null);
  const [textProblem, setTextProblem] = useState<string | null>(null);
  const [texting, setTexting] = useState(false);
  const openingMessages = useRef(false);
  const titles = useRef(new Map<string, string>());
  const drop = useCallback((gone: Id<"items">[]) => {
    setItemIds((current) => current.filter((id) => !gone.includes(id)));
    setNotice(gone.map((id) => `${titles.current.get(id) ?? "An item"} just got taken, so we removed it.`).join(" "));
  }, []);
  const { buy, buying, error, checkingOut, myOrderItemIds } = useBuy(garageId, (itemId) => drop([itemId]));
  const back = () => (router.canGoBack() ? router.back() : router.replace({ pathname: "/buyer/garage/[id]", params: { id: garageId } }));

  useEffect(() => {
    if (!garage) return;
    garage.items.forEach((i) => titles.current.set(i._id, i.title));
    const live = new Set<string>(garage.items.map((i) => i._id));
    const gone = itemIds.filter((id) => !live.has(id) && !myOrderItemIds.includes(id));
    if (gone.length > 0 && !checkingOut.current && !isCheckingOut()) drop(gone);
  }, [garage, itemIds, myOrderItemIds, checkingOut, drop]);

  if (garage === undefined) return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;

  const items = garage?.items.filter((i) => itemIds.includes(i._id)) ?? [];
  if (buying && items.length === 0) return <ActivityIndicator color={colors.ink} style={{ flex: 1, backgroundColor: colors.cream }} />;
  if (!garage || items.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream, paddingHorizontal: 20 }}>
        {notice && <Text style={{ ...sys.row, marginTop: 12 }}>{notice}</Text>}
        <EmptyState headline="Nothing left to buy" line="These items aren't available anymore." action={garage ? "Back to your picks" : "Back to browsing"} onAction={garage ? back : () => router.dismissTo("/buyer")} />
      </View>
    );
  }

  const total = items.reduce((sum, i) => sum + i.priceCents, 0);
  const seller = firstName(garage.ownerName);
  const text = async () => {
    if (openingMessages.current || checkingOut.current) return;
    openingMessages.current = true;
    setTexting(true);
    setTextProblem(null);
    try {
      setTextProblem(await textSeller(convex, garageId, (name) => askToBuyText(name, items.map((i) => i.title), total, garage.neighborhood)));
    } finally {
      openingMessages.current = false;
      setTexting(false);
    }
  };
  const pay = () => {
    if (openingMessages.current) return;
    setTextProblem(null);
    void buy(items.map((i) => i._id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 12 }}>
        <Text style={{ ...sys.title, fontWeight: "800" }}>Confirm</Text>
        <View style={{ ...surfaces.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: pinFor(garageId).bg, borderWidth: 3, borderColor: colors.white, alignItems: "center", justifyContent: "center", ...shadows.pin }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: pinFor(garageId).fg }}>{seller.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...sys.row, fontWeight: "700" }}>{seller}'s yard</Text>
            <Text style={{ ...sys.label, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11 }}>{formatPlace(garage)}</Text>
          </View>
        </View>
        <View style={{ ...surfaces.card, paddingHorizontal: 16 }}>
          {items.map((item, i) => (
            <View key={item._id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.hairline }}>
              <Image source={{ uri: item.photoUrl }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.line }} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ ...sys.row, fontWeight: "600" }}>{item.title}</Text>
                {detailLine([item.condition, item.size && `Size ${item.size}`, item.brand]) !== "" && (
                  <Text numberOfLines={1} style={sys.label}>{detailLine([item.condition, item.size && `Size ${item.size}`, item.brand])}</Text>
                )}
              </View>
              <Text style={sys.price}>{formatPrice(item.priceCents)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 52, borderTopWidth: 1, borderTopColor: colors.hairline }}>
            <Text style={{ ...sys.row, fontWeight: "600" }}>Total</Text>
            <Text style={sys.price}>{formatPrice(total)}</Text>
          </View>
        </View>
        {notice && <Text style={{ ...sys.row, fontWeight: "500" }}>{notice}</Text>}
        {(textProblem ?? error) && <Text style={{ ...sys.row, fontWeight: "500" }}>{textProblem ?? error}</Text>}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, gap: 12, backgroundColor: colors.cream }}>
        {textable ? (
          <>
            <PrimaryButton label={`Text ${seller}`} onPress={text} loading={texting} disabled={buying} />
            <SecondaryButton label={buying ? "Opening checkout…" : `Pay ${formatPrice(total)} online`} onPress={pay} disabled={buying || texting} />
          </>
        ) : (
          <PrimaryButton label={`Pay ${formatPrice(total)}`} onPress={pay} loading={buying} disabled={textable === undefined} />
        )}
      </View>
    </View>
  );
}
