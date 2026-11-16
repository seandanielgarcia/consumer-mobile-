import { colors } from "../theme";

// Pin palette: saturated, each pair passes 4.5:1 for the initial. Stable per id, shared by the map, yard headers and avatars.
export const PINS = [
  { bg: colors.mapBlue, fg: colors.white },
  { bg: colors.lime, fg: colors.ink },
  { bg: colors.orange, fg: colors.ink },
  { bg: colors.pink, fg: colors.white },
  { bg: colors.ink, fg: colors.white },
] as const;

export const pinFor = (id: string) => PINS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PINS.length];
