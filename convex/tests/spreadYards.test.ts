import { describe, expect, it } from "vitest";
import { mapScale, PIN_GAP, spreadYards } from "../../src/buyer/spreadYards";

function regionFor(latitude: number, longitude: number, radiusMiles: number) {
  const span = (radiusMiles * 2 * 1.25) / 69;
  return { latitude, longitude, latitudeDelta: span, longitudeDelta: span / Math.cos((latitude * Math.PI) / 180) };
}

const yards = [
  { garageId: "a-ravi", lat: 37.785, lng: -122.43 },
  { garageId: "b-ravi2", lat: 37.785, lng: -122.43 },
  { garageId: "c-ravi3", lat: 37.785, lng: -122.43 },
  { garageId: "d-diego", lat: 37.772, lng: -122.433 },
  { garageId: "e-diego2", lat: 37.772, lng: -122.433 },
  { garageId: "f-hailey", lat: 37.76, lng: -122.41 },
  { garageId: "g-priya", lat: 37.76, lng: -122.41 },
];

function screenGaps(region: ReturnType<typeof regionFor>, size: { width: number; height: number }) {
  const { longitudePerPixel, latitudePerPixel } = mapScale(region, size);
  const pins = spreadYards(yards, longitudePerPixel, latitudePerPixel);
  const cos = Math.cos((region.latitude * Math.PI) / 180);
  const truePerPixel = Math.max(region.longitudeDelta / size.width, region.latitudeDelta / (size.height * cos));
  const xy = pins.map((p) => ({ x: p.pinLng / truePerPixel, y: p.pinLat / (truePerPixel * cos) }));
  const gaps: number[] = [];
  for (let i = 0; i < xy.length; i++) for (let j = i + 1; j < xy.length; j++) gaps.push(Math.hypot(xy[i].x - xy[j].x, xy[i].y - xy[j].y));
  return gaps;
}

describe("spreadYards", () => {
  it.each([1, 2, 5, 10])("keeps every pin one pin apart on a tall phone map at %i mi", (radius) => {
    const region = regionFor(37.775, -122.42, radius);
    for (const gap of screenGaps(region, { width: 390, height: 700 })) expect(gap).toBeGreaterThanOrEqual(PIN_GAP - 0.01);
  });

  it("leaves a lone yard at its own spot", () => {
    const [pin] = spreadYards([{ garageId: "x", lat: 37.7, lng: -122.4 }], 0.0001, 0.00008);
    expect(pin).toMatchObject({ pinLat: 37.7, pinLng: -122.4 });
  });
});
