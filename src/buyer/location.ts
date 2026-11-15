import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type BuyerLocation = { lat: number; lng: number; label: string };

const SF_FALLBACK: BuyerLocation = { lat: 37.78, lng: -122.41, label: "San Francisco" };
const round = (x: number) => Math.round(x * 100) / 100;

let cached: Promise<BuyerLocation> | null = null;

async function locate(): Promise<BuyerLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return SF_FALLBACK;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 3000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const lat = round(pos.coords.latitude);
    const lng = round(pos.coords.longitude);
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
    return { lat, lng, label: place?.district ?? place?.city ?? "Near you" };
  } catch {
    return SF_FALLBACK;
  }
}

export function useBuyerLocation() {
  const [location, setLocation] = useState<BuyerLocation | null>(null);
  useEffect(() => {
    cached ??= Promise.race([locate(), new Promise<BuyerLocation>((resolve) => setTimeout(() => resolve(SF_FALLBACK), 8000))]);
    cached.then(setLocation);
  }, []);
  return location;
}
