import { useMutation } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../convex/_generated/api";
import { setCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

const normalizePhone = (input: string) => {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
};

export default function SignIn() {
  const getOrCreateByPhone = useMutation(api.users.getOrCreateByPhone);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizePhone(phone);
  const canContinue = name.trim() !== "" && normalized !== null && !saving;

  const submit = async () => {
    if (!normalized) return;
    setSaving(true);
    setError(null);
    try {
      const userId = await getOrCreateByPhone({ phone: normalized, name: name.trim() });
      await setCurrentUser({ userId });
      router.replace("/seller/price");
    } catch {
      setError("Couldn't save that. Try again.");
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.headline}>{"Who's selling?"}</Text>
      <Text style={styles.subhead}>Buyers see your first name. Your number is how we text you when something sells.</Text>
      <View style={styles.fields}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="First name"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          style={styles.input}
          autoFocus
        />
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Phone number"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          style={styles.input}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      <Pressable
        onPress={submit}
        disabled={!canContinue}
        style={[styles.cta, !canContinue && styles.ctaDisabled]}
        accessibilityRole="button"
      >
        {saving ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>Continue</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 56,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 16,
  },
  back: { alignSelf: "flex-start" },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  headline: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  subhead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.muted },
  fields: { gap: 10 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  error: { fontFamily: fonts.medium, fontSize: 14, color: "#B3261E" },
  spacer: { flex: 1 },
  cta: {
    height: spacing.cta,
    borderRadius: 30,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream },
});
