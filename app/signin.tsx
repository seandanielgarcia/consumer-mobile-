import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { cancelSignIn, setCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, primaryButton, primaryButtonText, spacing, sys, type } from "../src/theme";

const KEIKI_NUMBER = "+17796251378";
const KEIKI_NUMBER_DISPLAY = "+1 779-625-1378";
const PHONE_ACCESSORY = "phone-done";
const PENDING_KEY = "garage-sale/pending-verification";

type Pending = { userId: Id<"users">; code: string; phone: string; name: string; startedAt: number };

const PENDING_TTL_MS = 10 * 60 * 1000;

const normalizePhone = (input: string) => {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
};

export default function SignIn() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const startVerification = useMutation(api.users.startVerification);
  const devSkip = useMutation(api.users.devSkipVerification);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPendingState] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);
  const phoneInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const window = useWindowDimensions();
  const [sheetHeight, setSheetHeight] = useState(window.height);
  const verified = useQuery(api.users.isVerified, pending ? { userId: pending.userId } : "skip");
  const normalized = normalizePhone(phone);
  const missing = name.trim() === "" ? "Add your first name" : normalized === null ? "Add your phone number" : "";
  const canContinue = !missing && !saving;

  const setPending = (next: Pending | null) => {
    setPendingState(next);
    if (next) AsyncStorage.setItem(PENDING_KEY, JSON.stringify(next)).catch(() => {});
    else AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
  };

  useEffect(() => {
    AsyncStorage.getItem(PENDING_KEY)
      .then((stored) => {
        const restored = stored ? (JSON.parse(stored) as Pending) : null;
        if (restored && Date.now() - (restored.startedAt ?? 0) < PENDING_TTL_MS) setPendingState(restored);
        else AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => {
    if (!done.current) cancelSignIn();
  }, []);

  const finish = (userId: Id<"users">, firstName: string, phoneLabel: string) => {
    done.current = true;
    AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
    if (router.canGoBack()) router.back();
    setCurrentUser({ userId, name: firstName, phone: phoneLabel });
  };

  useEffect(() => {
    if (pending && verified) finish(pending.userId, pending.name, pending.phone);
  }, [pending, verified]);

  const submit = async () => {
    if (!normalized) return;
    setSaving(true);
    setError(null);
    try {
      const firstName = name.trim();
      const result = await startVerification({ phone: normalized, name: firstName });
      if (result.verified) finish(result.userId, result.name, phone.trim());
      else setPending({ userId: result.userId, code: result.code ?? "", phone: phone.trim(), name: result.name, startedAt: Date.now() });
    } catch {
      setError("Couldn't save that. Try again.");
    }
    setSaving(false);
  };

  const textKeiki = () => {
    if (!pending) return;
    const body = encodeURIComponent(`K-FERUEU verify ${pending.code}`);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={window.height - sheetHeight}
      onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
      style={styles.flex}
    >
      <View style={styles.screen}>
        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID={PHONE_ACCESSORY}>
            <View style={styles.accessory}>
              <Pressable onPress={Keyboard.dismiss} hitSlop={10}>
                <Text style={styles.accessoryDone}>Done</Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}
        <View style={styles.header}>
          <Pressable
            onPress={() => (pending ? setPending(null) : router.canGoBack() ? router.back() : router.replace("/"))}
            hitSlop={12}
            style={styles.headerSide}
            accessibilityRole="button"
          >
            <Text style={styles.headerAction}>{pending ? "‹ Back" : "Close"}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Sign in</Text>
          <View style={styles.headerSide} />
        </View>
        {pending ? (
          <>
            <View style={styles.instructionBlock}>
              <Text style={styles.label}>Text this to Keiki</Text>
              <View style={styles.codeChip}>
                <Text style={styles.codeChipText}>K-FERUEU verify {pending.code}</Text>
              </View>
              <Text style={styles.toNumber}>to {KEIKI_NUMBER_DISPLAY}</Text>
              <Text style={styles.fromNumber}>from {pending.phone}</Text>
            </View>
            <View style={styles.waiting}>
              <ActivityIndicator color={colors.brand} size="small" />
              <Text style={styles.waitingText}>Waiting for your text…</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headline}>{reason ?? "Sign in to continue"}</Text>
            <View style={styles.fields}>
              <Text style={sys.label}>First name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Hailey"
                placeholderTextColor={colors.muted}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => phoneInput.current?.focus()}
                style={styles.input}
                autoFocus
              />
            </View>
            <View style={styles.fields}>
              <Text style={sys.label}>Phone number</Text>
              <TextInput
                ref={phoneInput}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (text.replace(/\D/g, "").length === 10) Keyboard.dismiss();
                }}
                inputAccessoryViewID={PHONE_ACCESSORY}
                placeholder="(555) 555-0123"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                style={styles.input}
              />
              <Text style={styles.subhead}>Buyers see your first name only.</Text>
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
              <Text style={styles.ctaText}>Open Messages</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={submit}
            disabled={!canContinue}
            style={[styles.cta, !canContinue && styles.ctaDisabled]}
            accessibilityRole="button"
          >
            {saving ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>{missing || "Continue"}</Text>}
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 8,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 16,
  },
  header: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSide: { minWidth: 60, minHeight: spacing.minButton, justifyContent: "center" },
  headerAction: { ...fonts.semibold, fontSize: 17, color: colors.brand },
  headerTitle: { ...fonts.semibold, fontSize: 17, color: colors.ink },
  headline: { ...type.title, color: colors.ink },
  subhead: { ...fonts.body, fontSize: 14, lineHeight: 18, color: colors.muted },
  fields: { gap: 8 },
  input: {
    height: 52,
    borderRadius: spacing.field,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    ...fonts.body,
    fontSize: 17,
    color: colors.ink,
  },
  instructionBlock: { gap: 10, alignItems: "flex-start" },
  label: { ...fonts.semibold, fontSize: 15, color: colors.muted },
  codeChip: {
    backgroundColor: colors.lime,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  codeChipText: { ...fonts.display, fontSize: 30, color: colors.ink },
  toNumber: { ...fonts.display, fontSize: 26, color: colors.ink },
  fromNumber: { ...fonts.body, fontSize: 14, color: colors.muted },
  waiting: { flexDirection: "row", alignItems: "center", gap: 8 },
  waitingText: { ...fonts.body, fontSize: 14, color: colors.muted },
  error: { ...fonts.medium, fontSize: 14, color: colors.error },
  spacer: { flex: 1 },
  accessory: {
    backgroundColor: colors.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  accessoryDone: { ...fonts.semibold, fontSize: 16, color: colors.brand },
  skip: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  skipText: { ...fonts.semibold, fontSize: 15, color: colors.muted, textDecorationLine: "underline" },
  cta: primaryButton,
  ctaDisabled: { opacity: 0.4 },
  ctaText: primaryButtonText,
});
