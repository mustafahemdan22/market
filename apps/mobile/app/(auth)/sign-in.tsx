import { useState } from "react";
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSignIn } from "@clerk/expo/legacy";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuthContext } from "../../src/auth/AuthProvider";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { Text } from "../../src/components/ui/Text";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Banner } from "../../src/components/ui/Banner";
import { Pressable } from "../../src/components/ui/Pressable";
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

function ClerkSignInForm() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim()) {
      setError(t("auth.errorEmailRequired"));
      return;
    }
    if (!password) {
      setError(t("auth.errorPasswordRequired"));
      return;
    }
    if (!isLoaded || !signIn) return;

    setLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.status === "complete") {
        if (result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
        }
        router.replace("/(tabs)/account");
      } else {
        setError(t("auth.errorGeneric"));
      }
    } catch (err: unknown) {
      const extracted = extractClerkError(err);
      setError(extracted ?? t("auth.errorInvalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      {error ? (
        <View style={styles.bannerWrapper}>
          <Banner message={error} tone="danger" />
        </View>
      ) : null}

      <Input
        label={t("auth.emailLabel")}
        placeholder={t("auth.emailPlaceholder")}
        value={email}
        onChangeText={(val) => {
          setEmail(val);
          if (error) setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        containerStyle={styles.inputSpacing}
        leftIcon={
          <MaterialCommunityIcons name="email-outline" size={20} color={colors.text.muted} />
        }
      />

      <Input
        label={t("auth.passwordLabel")}
        placeholder={t("auth.passwordPlaceholder")}
        value={password}
        onChangeText={(val) => {
          setPassword(val);
          if (error) setError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        containerStyle={styles.inputSpacing}
        leftIcon={
          <MaterialCommunityIcons name="lock-outline" size={20} color={colors.text.muted} />
        }
      />

      <Button
        label={loading ? t("auth.signingIn") : t("auth.signInButton")}
        onPress={() => {
          void handleSignIn();
        }}
        loading={loading}
        disabled={loading || !isLoaded}
        variant="primary"
        size="lg"
        style={styles.submitButton}
      />

      <View style={[styles.switchAuthRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text variant="body" tone="secondary">
          {t("auth.dontHaveAccount")}{" "}
        </Text>
        <Pressable
          onPress={() => router.push("/(auth)/sign-up")}
          accessibilityRole="button"
          accessibilityLabel={t("auth.createAccountLink")}
          enforceMinTarget={false}
        >
          <Text variant="bodyStrong" tone="primary" style={{ color: colors.brand[600] }}>
            {t("auth.createAccountLink")}
          </Text>
        </Pressable>
      </View>
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

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isClerkConfigured } = useAuthContext();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar
        title={t("auth.signInTitle")}
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
                name="storefront-outline"
                size={40}
                color={colors.brand[600]}
              />
            </View>
            <Text variant="h1" align="center" style={styles.heroTitle}>
              {t("auth.signInTitle")}
            </Text>
            <Text variant="body" tone="secondary" align="center" style={styles.heroSubtitle}>
              {t("auth.signInSubtitle")}
            </Text>
          </View>

          {isClerkConfigured ? <ClerkSignInForm /> : <UnconfiguredNotice />}
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
    marginBottom: spacing[5],
  },
  switchAuthRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
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
