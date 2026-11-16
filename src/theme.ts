// The map style is the app style: lavender ground, navy ink, one bright blue, lime price stickers,
// and pink/orange/navy as pin and status accents. White cards float on soft navy shadows.
// `cream` keeps its name for the many call sites but is the lavender ground now.
export const colors = {
  brand: "#2A52F0",
  cream: "#F3F2FA",
  tag: "#B6F03A",
  ink: "#1B1B3A",
  muted: "#6E6F8F",
  line: "#D9D9EA",
  hairline: "#E6E6F2",
  white: "#FFFFFF",
  surfaceMuted: "#ECEBF5",
  error: "#B3261E",
  destructive: "#D93025",
  badge: "rgba(27,27,58,0.85)",
  veil: "rgba(27,27,58,0.25)",
  frost: "rgba(255,255,255,0.7)",
  scrim: "rgba(27,27,58,0.4)",
  shadow: "#1B1B3A",
  // Accents (pins, status chips)
  lime: "#B6F03A",
  orange: "#FF7A1A",
  pink: "#FF4FA3",
  // Map (Search tab)
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
  card: 22,
  photo: 16,
  field: 14,
} as const;

// Soft navy shadows: cards sit on the lavender ground, pins and floating controls lift a little more.
export const shadows = {
  card: { shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  float: { shadowColor: colors.shadow, shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  pin: { shadowColor: colors.shadow, shadowOpacity: 0.22, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
} as const;

export const surfaces = {
  card: { backgroundColor: colors.white, borderRadius: spacing.card, ...shadows.card },
  sticker: { backgroundColor: colors.tag, borderRadius: 8, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, height: 28, justifyContent: "center" },
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
  ...shadows.float,
  shadowOpacity: 0.18,
} as const;

export const primaryButtonText = { ...fonts.semibold, fontSize: 17, color: colors.white } as const;

export const secondaryButton = {
  height: 56,
  borderRadius: spacing.radius,
  backgroundColor: colors.white,
  borderWidth: 1.5,
  borderColor: colors.ink,
  alignItems: "center",
  justifyContent: "center",
} as const;

export const secondaryButtonText = { ...fonts.semibold, fontSize: 17, color: colors.ink } as const;

export const theme = { colors, fonts, spacing, type, shadows, surfaces };
export default theme;
