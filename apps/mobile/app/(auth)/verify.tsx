import { useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSignUp } from "@clerk/expo/legacy";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuthContext } from "../../src/auth/AuthProvider";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { Text } from "../../src/components/ui/Text";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Banner } from "../../src/components/ui/Banner";
import { spacing, radii, elevations } from "../../src/theme/tokens";

function extractClerkError(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  if (
    "errors" in err &&
    Array.isArray((err as { errors: Array<{ message?: string; longMessage?: string }> }).errors)
  ) {
    const first = (err as { errors: Array<{ message?: string; longMessage?: string }> }).errors[0];
    return first?.longMessage ?? first?.message ?? null;
  }
  if ("message" in err && typeof err.message === "string") {
    return err.message;
  }
  return null;
}

interface ClerkVerifyFormProps {
  readonly email?: string | undefined;
}

function ClerkVerifyForm({ email }: ClerkVerifyFormProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { signUp, setActive, isLoaded } = useSignUp();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code.trim()) {
      setError(t("auth.errorCodeRequired"));
      return;
    }
    if (!isLoaded || !signUp) return;

    setLoading(true);
    setError(null);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });

      if (completeSignUp.status === "complete") {
        if (completeSignUp.createdSessionId && setActive) {
          await setActive({ session: completeSignUp.createdSessionId });
        }
        router.replace("/(tabs)/account");
      } else {
        setError(t("auth.errorGeneric"));
      }
    } catch (err: unknown) {
      const extracted = extractClerkError(err);
      setError(extracted ?? t("auth.errorInvalidCode"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp) return;
    setResending(true);
    setError(null);

    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setInfo(t("auth.verifySubtitle"));
    } catch (err: unknown) {
      const extracted = extractClerkError(err);
      setError(extracted ?? t("auth.errorGeneric"));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      {error ? (
        <View style={styles.bannerWrapper}>
          <Banner message={error} tone="danger" />
        </View>
      ) : null}

      {info ? (
        <View style={styles.bannerWrapper}>
          <Banner message={info} tone="info" />
        </View>
      ) : null}

      {email ? (
        <View style={styles.emailBadge}>
          <MaterialCommunityIcons name="email-check-outline" size={18} color={colors.brand[600]} />
          <Text variant="caption" tone="secondary" style={styles.emailText}>
            {email}
          </Text>
        </View>
      ) : null}

      <Input
        label={t("auth.verificationCodeLabel")}
        placeholder={t("auth.verificationCodePlaceholder")}
        value={code}
        onChangeText={(val) => {
          setCode(val);
          if (error) setError(null);
        }}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
        containerStyle={styles.inputSpacing}
        leftIcon={
          <MaterialCommunityIcons name="shield-key-outline" size={20} color={colors.text.muted} />
        }
      />

      <Button
        label={loading ? t("auth.verifying") : t("auth.verifyButton")}
        onPress={() => {
          void handleVerify();
        }}
        loading={loading}
        disabled={loading || !isLoaded}
        variant="primary"
        size="lg"
        style={styles.submitButton}
      />

      <Button
        label={t("auth.resendCodeButton")}
        onPress={() => {
          void handleResend();
        }}
        loading={resending}
        disabled={resending || !isLoaded}
        variant="ghost"
        size="md"
      />
    </View>
  );
}

function UnconfiguredNotice() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View style={styles.unconfiguredContainer}>
      <View
        style={[
          styles.unconfiguredCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
            ...elevations.card,
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.warning[50] }]}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={32}
            color={colors.warning[600]}
          />
        </View>

        <Text variant="h3" align="center" style={styles.noticeTitle}>
          {t("auth.clerkNotConfigured")}
        </Text>

        <Text variant="body" tone="secondary" align="center" style={styles.noticeBody}>
          {t("auth.clerkConfigInstructions")}
        </Text>

        <Button
          label={t("action.back")}
          onPress={() => router.back()}
          variant="secondary"
          size="md"
          style={styles.noticeButton}
        />
      </View>
    </View>
  );
}

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isClerkConfigured } = useAuthContext();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar
        title={t("auth.verifyTitle")}
        onBack={() => router.back()}
        showCart={false}
        showLanguageToggle
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Hero */}
          <View style={styles.heroSection}>
            <View style={[styles.brandIconCircle, { backgroundColor: colors.brand[50] }]}>
              <MaterialCommunityIcons
                name="email-seal-outline"
                size={40}
                color={colors.brand[600]}
              />
            </View>
            <Text variant="h1" align="center" style={styles.heroTitle}>
              {t("auth.verifyTitle")}
            </Text>
            <Text variant="body" tone="secondary" align="center" style={styles.heroSubtitle}>
              {t("auth.verifySubtitle")}
            </Text>
          </View>

          {isClerkConfigured ? <ClerkVerifyForm email={params.email} /> : <UnconfiguredNotice />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[5],
    paddingBottom: spacing[12],
  },
  heroSection: {
    alignItems: "center",
    marginBottom: spacing[6],
    marginTop: spacing[2],
  },
  brandIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
  },
  heroTitle: {
    marginBottom: spacing[1],
  },
  heroSubtitle: {
    maxWidth: 320,
  },
  emailBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  emailText: {
    fontWeight: "600",
  },
  formContainer: {
    width: "100%",
  },
  bannerWrapper: {
    marginBottom: spacing[4],
  },
  inputSpacing: {
    marginBottom: spacing[4],
  },
  submitButton: {
    marginTop: spacing[2],
    marginBottom: spacing[3],
  },
  unconfiguredContainer: {
    width: "100%",
    marginTop: spacing[4],
  },
  unconfiguredCard: {
    padding: spacing[5],
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  noticeTitle: {
    marginBottom: spacing[2],
  },
  noticeBody: {
    marginBottom: spacing[4],
    lineHeight: 20,
  },
  noticeButton: {
    minWidth: 140,
  },
});
