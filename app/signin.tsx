import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { setCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

const KEIKI_NUMBER = "+17796251378";

const normalizePhone = (input: string) => {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
};

export default function SignIn() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const startVerification = useMutation(api.users.startVerification);
  const devSkip = useMutation(api.users.devSkipVerification);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState<{ userId: Id<"users">; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = useQuery(api.users.isVerified, pending ? { userId: pending.userId } : "skip");
  const normalized = normalizePhone(phone);
  const canContinue = name.trim() !== "" && normalized !== null && !saving;

  useEffect(() => {
    if (!pending || !verified) return;
    setCurrentUser({ userId: pending.userId }).then(() =>
      next === "back" && router.canGoBack() ? router.back() : router.replace("/seller/price"),
    );
  }, [pending, verified, next]);

  const submit = async () => {
    if (!normalized) return;
    setSaving(true);
    setError(null);
    try {
      setPending(await startVerification({ phone: normalized, name: name.trim() }));
    } catch {
      setError("Couldn't save that. Try again.");
    }
    setSaving(false);
  };

  const textKeiki = () => {
    if (!pending) return;
    const body = encodeURIComponent(`hey keiki, verify me (K-FERUEU) code ${pending.code}`);
    Linking.openURL(`sms:${KEIKI_NUMBER}&body=${body}`);
  };

  const skip = async () => {
    if (!pending) return;
    try {
      await devSkip({ userId: pending.userId });
    } catch {
      setError("Skip is turned off on this backend.");
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <Pressable onPress={() => (pending ? setPending(null) : router.back())} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      {pending ? (
        <>
          <Text style={styles.headline}>Text us this code</Text>
          <View style={styles.codeCard}>
            <Text style={styles.code}>{pending.code}</Text>
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.brand} size="small" />
              <Text style={styles.waitingText}>Waiting for your text</Text>
            </View>
          </View>
        </>
      ) : (
        <>
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
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.spacer} />
      {pending ? (
        <>
          {__DEV__ && (
            <Pressable onPress={skip} hitSlop={8} style={styles.skip}>
              <Text style={styles.skipText}>Skip (dev)</Text>
            </Pressable>
          )}
          <Pressable onPress={textKeiki} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>Verify by text</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          onPress={submit}
          disabled={!canContinue}
          style={[styles.cta, !canContinue && styles.ctaDisabled]}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>Continue</Text>}
        </Pressable>
      )}
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
  codeCard: { backgroundColor: colors.white, borderRadius: 18, paddingVertical: 24, alignItems: "center", gap: 14 },
  code: { fontFamily: fonts.display, fontSize: 56, letterSpacing: 10, color: colors.ink },
  waiting: { flexDirection: "row", alignItems: "center", gap: 8 },
  waitingText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  error: { fontFamily: fonts.medium, fontSize: 14, color: "#B3261E" },
  spacer: { flex: 1 },
  skip: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  skipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted, textDecorationLine: "underline" },
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
