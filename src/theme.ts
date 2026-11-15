export const colors = {
  brand: "#2340FF",
  cream: "#FFF6E5",
  tag: "#FFE14D",
  ink: "#111111",
  muted: "#5A5245",
  line: "#CFC3AA",
  hairline: "#EDE6D6",
  white: "#FFFFFF",
} as const;

export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
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

export const type = {
  hero: 40,
  title: 28,
  itemTitle: 22,
  sentence: 17,
  row: 15,
  meta: 13,
  listPrice: 18,
  heroPrice: 32,
} as const;

export const theme = { colors, fonts, spacing, type };
export default theme;
