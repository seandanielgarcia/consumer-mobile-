export const colors = {
  brand: "#2340FF",
  cream: "#FFF6E5",
  tag: "#FFE14D",
  ink: "#111111",
  muted: "#5A5245",
  line: "#CFC3AA",
  hairline: "#EDE6D6",
  white: "#FFFFFF",
  surfaceMuted: "#F2F2F2",
  error: "#B3261E",
  destructive: "#D93025",
  badge: "rgba(17,17,17,0.85)",
  veil: "rgba(17,17,17,0.25)",
  frost: "rgba(255,255,255,0.7)",
  scrim: "rgba(0,0,0,0.35)",
  // Map (Search tab): lavender ground, navy ink, saturated pins
  mapGround: "#F3F2FA",
  mapInk: "#1B1B3A",
  mapBlue: "#2F5BFF",
  mapLime: "#B6F03A",
  mapOrange: "#FF7A1A",
  mapPink: "#FF4FA3",
  mapWash: "rgba(243,242,250,0.28)",
  mapRadiusFill: "rgba(47,91,255,0.10)",
  mapRadiusLine: "rgba(47,91,255,0.25)",
} as const;

export const fonts = {
  wordmark: { fontWeight: "800" },
  display: { fontWeight: "700" },
  body: { fontWeight: "400" },
  medium: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
} as const;

export const spacing = {
  sidePad: 20,
  topPad: 58,
  topPadMin: 56,
  topPadMax: 60,
  minButton: 44,
  cta: 60,
  radius: 999,
} as const;

export const typeSize = {
  hero: 32,
  title: 28,
  itemTitle: 22,
  sentence: 17,
  row: 16,
  meta: 13,
  listPrice: 18,
  heroPrice: 32,
} as const;

export const type = {
  hero: { ...fonts.display, fontSize: typeSize.hero, lineHeight: 38, letterSpacing: -0.8 },
  title: { ...fonts.display, fontSize: typeSize.title, lineHeight: 32, letterSpacing: -0.5 },
  itemTitle: { ...fonts.display, fontSize: typeSize.itemTitle, lineHeight: 28 },
  sentence: { ...fonts.body, fontSize: typeSize.sentence, lineHeight: 23 },
  row: { ...fonts.body, fontSize: typeSize.row, lineHeight: 21 },
  meta: { ...fonts.body, fontSize: typeSize.meta, lineHeight: 18 },
  listPrice: { ...fonts.display, fontSize: typeSize.listPrice, lineHeight: 22 },
  heroPrice: { ...fonts.display, fontSize: typeSize.heroPrice, lineHeight: 36 },
} as const;

export const sys = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: "700", color: colors.ink },
  hero: { fontSize: 32, lineHeight: 38, fontWeight: "700", color: colors.ink },
  header: { fontSize: 20, lineHeight: 25, fontWeight: "600", color: colors.ink },
  button: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400", color: colors.ink },
  sentence: { fontSize: 17, lineHeight: 23, fontWeight: "400", color: colors.ink },
  row: { fontSize: 15, lineHeight: 20, fontWeight: "400", color: colors.ink },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500", color: colors.muted },
  price: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: colors.ink },
} as const;

export const primaryButton = {
  height: 56,
  borderRadius: spacing.radius,
  backgroundColor: colors.brand,
  alignItems: "center",
  justifyContent: "center",
} as const;

export const primaryButtonText = { ...fonts.semibold, fontSize: 17, color: colors.white } as const;

export const theme = { colors, fonts, spacing, type };
export default theme;
