export const PIN_GAP = 55;

export function mapScale(
  region: { latitude: number; latitudeDelta: number; longitudeDelta: number },
  size: { width: number; height: number },
) {
  const cos = Math.cos((region.latitude * Math.PI) / 180);
  const longitudePerPixel = Math.max(region.longitudeDelta / size.width, region.latitudeDelta / (size.height * cos));
  return { longitudePerPixel, latitudePerPixel: longitudePerPixel * cos };
}

export function spreadYards<T extends { garageId: string; lat: number; lng: number }>(
  yards: T[],
  longitudePerPixel: number,
  latitudePerPixel: number,
) {
  if (!(longitudePerPixel > 0 && latitudePerPixel > 0)) {
    return yards.map((yard) => ({ ...yard, pinLat: yard.lat, pinLng: yard.lng }));
  }

  const occupied: { x: number; y: number }[] = [];
  const positions = new Map<string, { pinLat: number; pinLng: number }>();
  const canPlace = (x: number, y: number) =>
    occupied.every((pin) => Math.hypot(pin.x - x, pin.y - y) >= PIN_GAP);

  for (const yard of [...yards].sort((a, b) => a.garageId.localeCompare(b.garageId))) {
    const x = yard.lng / longitudePerPixel;
    const y = yard.lat / latitudePerPixel;
    let spot = { x, y };
    for (let ring = 1; !canPlace(spot.x, spot.y); ring++) {
      const count = ring * 8;
      for (let index = 0; index < count; index++) {
        const angle = (2 * Math.PI * index) / count;
        const candidate = {
          x: x + PIN_GAP * ring * Math.cos(angle),
          y: y + PIN_GAP * ring * Math.sin(angle),
        };
        if (canPlace(candidate.x, candidate.y)) {
          spot = candidate;
          break;
        }
      }
    }
    occupied.push(spot);
    positions.set(yard.garageId, {
      pinLat: yard.lat + (spot.y - y) * latitudePerPixel,
      pinLng: yard.lng + (spot.x - x) * longitudePerPixel,
    });
  }

  return yards.map((yard) => ({ ...yard, ...positions.get(yard.garageId)! }));
}
