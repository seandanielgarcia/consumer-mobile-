import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type BuyerLocation = { lat: number; lng: number; label: string };

export const SF_FALLBACK: BuyerLocation = { lat: 37.78, lng: -122.41, label: "San Francisco" };
const round = (x: number) => Math.round(x * 100) / 100;

let current: BuyerLocation | null = null;
let generation = 0;
const listeners = new Set<(l: BuyerLocation) => void>();

function publish(location: BuyerLocation, gen: number) {
  if (gen !== generation) return location;
  current = location;
  listeners.forEach((l) => l(location));
  return location;
}

async function labelFor(lat: number, lng: number, fallback: string) {
  const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
  const city = place?.city ?? place?.subregion;
  if (place?.district && city && place.district !== city) return `${place.district}, ${city}`;
  return place?.district ?? city ?? fallback;
}

async function publishCoords(coords: { latitude: number; longitude: number }, gen: number, fallbackLabel: string) {
  const lat = round(coords.latitude);
  const lng = round(coords.longitude);
  const placed = publish({ lat, lng, label: current?.lat === lat && current?.lng === lng ? current.label : fallbackLabel }, gen);
  const label = await labelFor(lat, lng, fallbackLabel);
  if (current?.lat !== lat || current?.lng !== lng) return placed;
  return publish({ lat, lng, label }, gen);
}

export async function locateMe(): Promise<BuyerLocation> {
  const gen = ++generation;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return publish(SF_FALLBACK, gen);
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last) void publishCoords(last.coords, gen, "Near you");
    const live = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (live) return publishCoords(live.coords, gen, "Near you");
    return last && current ? current : publish(SF_FALLBACK, gen);
  } catch {
    return publish(SF_FALLBACK, gen);
  }
}

export async function locatePlace(query: string): Promise<BuyerLocation | null> {
  const gen = ++generation;
  const [hit] = await Location.geocodeAsync(query).catch(() => []);
  if (!hit) return null;
  return publishCoords(hit, gen, "Chosen spot");
}

export function useBuyerLocation() {
  if (!current) {
    current = SF_FALLBACK;
    void locateMe();
  }
  const [location, setLocation] = useState<BuyerLocation>(current);
  useEffect(() => {
    listeners.add(setLocation);
    if (current) setLocation(current);
    return () => {
      listeners.delete(setLocation);
    };
  }, []);
  return location;
}
