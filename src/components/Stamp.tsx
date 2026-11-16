import { Text, View } from "react-native";
import { colors, fonts } from "../theme";

export function Stamp({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" }}>
      <View style={{ borderWidth: 3, borderColor: colors.pink, borderRadius: 4, backgroundColor: colors.stampWash, paddingHorizontal: 10, paddingVertical: 2, transform: [{ rotate: "-12deg" }] }}>
        <Text style={{ ...fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: 1, color: colors.pink }}>{label}</Text>
      </View>
    </View>
  );
}
