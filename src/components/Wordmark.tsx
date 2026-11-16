import { Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function Wordmark({ size, color, inverse }: { size: number; color: string; inverse: string }) {
  const letter = { ...fonts.wordmark, fontSize: size, lineHeight: size * 1.25, letterSpacing: -size * 0.04, color };
  const cut = { paddingHorizontal: size * 0.08, marginHorizontal: size * 0.02 };
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }} accessible accessibilityLabel="yardsale">
      <Text style={letter}>y</Text>
      <View style={[cut, { backgroundColor: color, transform: [{ rotate: "-4deg" }] }]}>
        <Text style={[letter, { color: inverse }]}>a</Text>
      </View>
      <Text style={letter}>rd</Text>
      <View style={[cut, { backgroundColor: colors.brand, transform: [{ rotate: "3deg" }] }]}>
        <Text style={[letter, { color: colors.white }]}>s</Text>
      </View>
      <Text style={letter}>ale</Text>
    </View>
  );
}
