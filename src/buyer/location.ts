import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type BuyerLocation = { lat: number; lng: number; label: string };

const SF_FALLBACK: BuyerLocation = { lat: 37.78, lng: -122.41, label: "San Francisco" };
const round = (x: number) => Math.round(x * 100) / 100;

let current: BuyerLocation | null = null;
let pending: Promise<BuyerLocation> | null = null;
const listeners = new Set<(l: BuyerLocation) => void>();

function publish(location: BuyerLocation) {
  current = location;
  listeners.forEach((l) => l(location));
  return location;
}

async function labelFor(lat: number, lng: number, fallback: string) {
  const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
  return place?.district ?? place?.city ?? place?.subregion ?? fallback;
}

async function locate(): Promise<BuyerLocation> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return SF_FALLBACK;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 3000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const lat = round(pos.coords.latitude);
    const lng = round(pos.coords.longitude);
    return { lat, lng, label: await labelFor(lat, lng, "Near you") };
  } catch {
    return SF_FALLBACK;
  }
}

export function locateMe() {
  pending = Promise.race([locate(), new Promise<BuyerLocation>((resolve) => setTimeout(() => resolve(SF_FALLBACK), 8000))]);
  return pending.then(publish);
}

export async function locatePlace(query: string): Promise<BuyerLocation | null> {
  const [hit] = await Location.geocodeAsync(query).catch(() => []);
  if (!hit) return null;
  const lat = round(hit.latitude);
  const lng = round(hit.longitude);
  return publish({ lat, lng, label: await labelFor(lat, lng, "Chosen spot") });
}

export function useBuyerLocation() {
  const [location, setLocation] = useState<BuyerLocation | null>(current);
  useEffect(() => {
    listeners.add(setLocation);
    if (!current && !pending) locateMe();
    return () => {
      listeners.delete(setLocation);
    };
  }, []);
  return location;
}
