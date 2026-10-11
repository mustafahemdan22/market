import { useState } from "react";
import { View, ScrollView, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser, useClerk } from "@clerk/expo";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useAuthContext } from "../../src/auth/AuthProvider";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { Text } from "../../src/components/ui/Text";
import { Banner } from "../../src/components/ui/Banner";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { Pressable } from "../../src/components/ui/Pressable";
import { Divider } from "../../src/components/ui/Divider";
import { spacing, radii, elevations } from "../../src/theme/tokens";

function ClerkAuthenticatedCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // Ignore sign-out error
    } finally {
      setSigningOut(false);
    }
  };

  if (!isLoaded) {
    return (
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
            ...elevations.card,
          },
        ]}
      >
        <Text variant="body" tone="secondary">
          {t("state.loading")}
        </Text>
      </View>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: colors.surface.card,
            borderColor: colors.border.subtle,
            ...elevations.card,
          },
        ]}
      >
        <View style={[styles.avatarCircle, { backgroundColor: colors.brand[600] }]}>
          <MaterialCommunityIcons name="account-outline" size={36} color={colors.neutral[0]} />
        </View>
        <Text variant="h2" style={styles.profileName}>
          {t("account.guestUser")}
        </Text>
        <Text variant="caption" tone="secondary" style={styles.profileSub}>
          {t("header.location")}
        </Text>
        <View style={styles.prototypeNotice}>
          <Banner message={t("account.signInNotice")} tone="info" />
        </View>
        <Button
          label={t("auth.signInButton")}
          onPress={() => router.push("/(auth)/sign-in")}
          variant="primary"
          size="md"
          style={styles.authCtaButton}
        />
      </View>
    );
  }

  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || t("auth.signedInAs");
  const email = user.primaryEmailAddress?.emailAddress;
  const avatarUrl = user.imageUrl;

  return (
    <View
      style={[
        styles.profileCard,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          ...elevations.card,
        },
      ]}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      ) : (
        <View style={[styles.avatarCircle, { backgroundColor: colors.brand[600] }]}>
          <MaterialCommunityIcons name="account-check" size={36} color={colors.neutral[0]} />
        </View>
      )}

      <Text variant="h2" style={styles.profileName}>
        {displayName}
      </Text>

      {email ? (
        <Text variant="caption" tone="secondary" style={styles.profileSub}>
          {email}
        </Text>
      ) : null}

      <View style={styles.badgeRow}>
        <Badge label={t("auth.roleCustomer")} tone="success" size="sm" />
      </View>

      <Button
        label={signingOut ? t("auth.signingOut") : t("auth.signOutButton")}
        onPress={handleSignOut}
        loading={signingOut}
        disabled={signingOut}
        variant="secondary"
        size="sm"
        style={styles.signOutButton}
      />
    </View>
  );
}

function UnconfiguredProfileCard() {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <View
      style={[
        styles.profileCard,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          ...elevations.card,
        },
      ]}
    >
      <View style={[styles.avatarCircle, { backgroundColor: colors.warning[50] }]}>
        <MaterialCommunityIcons name="account-key-outline" size={36} color={colors.warning[700]} />
      </View>
      <Text variant="h2" style={styles.profileName}>
        {t("account.guestUser")}
      </Text>
      <Text variant="caption" tone="secondary" style={styles.profileSub}>
        {t("header.location")}
      </Text>
      <View style={styles.prototypeNotice}>
        <Banner
          message={`${t("auth.clerkNotConfigured")}: ${t("auth.clerkConfigInstructions")}`}
          tone="warning"
        />
      </View>
    </View>
  );
}

export default function AccountScreen() {
  const { colors, isDark, setColorMode } = useTheme();
  const { isRTL, t, toggleLanguage, mirrorStyle } = useI18n();
  const { isClerkConfigured } = useAuthContext();

  const renderSettingRow = (
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    title: string,
    subtitle?: string,
    onPress?: () => void,
  ) => (
    <Pressable
      onPress={onPress ?? (() => {})}
      accessibilityRole="button"
      accessibilityLabel={title}
      enforceMinTarget={false}
      style={[
        styles.settingRow,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
      ]}
    >
      <View style={[styles.settingLeading, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.brand[50] }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.brand[600]} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text variant="bodyStrong">{title}</Text>
          {subtitle ? (
            <Text variant="caption" tone="secondary">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={mirrorStyle()}>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={colors.text.muted}
        />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar title={t("account.title")} showLanguageToggle={false} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Dynamic Clerk Profile / Unconfigured Notice Card */}
        {isClerkConfigured ? <ClerkAuthenticatedCard /> : <UnconfiguredProfileCard />}

        {/* Section: Language & Direction */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionHeader}>
            {t("account.languageSection")}
          </Text>
          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel={t("account.languageSection")}
            enforceMinTarget={false}
            style={[
              styles.settingRow,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.subtle,
                flexDirection: isRTL ? "row-reverse" : "row",
              },
            ]}
          >
            <View style={[styles.settingLeading, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.brand[50] }]}>
                <MaterialCommunityIcons name="translate" size={20} color={colors.brand[600]} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text variant="bodyStrong">
                  {isRTL ? "العربية (RTL — مصر)" : "English (LTR)"}
                </Text>
                <Text variant="caption" tone="secondary">
                  {isRTL ? "اضغط للتبديل إلى English" : "Tap to switch to العربية"}
                </Text>
              </View>
            </View>
            <Button
              label={isRTL ? "Switch" : "تبديل"}
              onPress={toggleLanguage}
              size="sm"
              variant="secondary"
            />
          </Pressable>
        </View>

        {/* Section: Theme */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionHeader}>
            {t("account.themeSection")}
          </Text>
          <Pressable
            onPress={() => setColorMode(isDark ? "light" : "dark")}
            accessibilityRole="button"
            accessibilityLabel={t("account.themeSection")}
            enforceMinTarget={false}
            style={[
              styles.settingRow,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.subtle,
                flexDirection: isRTL ? "row-reverse" : "row",
              },
            ]}
          >
            <View style={[styles.settingLeading, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.brand[50] }]}>
                <MaterialCommunityIcons
                  name={isDark ? "weather-night" : "white-balance-sunny"}
                  size={20}
                  color={colors.brand[600]}
                />
              </View>
              <View style={styles.settingTextContainer}>
                <Text variant="bodyStrong">
                  {isDark ? t("account.darkMode") : t("account.lightMode")}
                </Text>
              </View>
            </View>
            <Button
              label={isDark ? "Light" : "Dark"}
              onPress={() => setColorMode(isDark ? "light" : "dark")}
              size="sm"
              variant="secondary"
            />
          </Pressable>
        </View>

        {/* Section: Features (Preview/Disabled until Phase D) */}
        <View style={styles.section}>
          <Text variant="h3" style={styles.sectionHeader}>
            {t("account.deliveryAddresses")}
          </Text>
          {renderSettingRow("map-marker-outline", "Maadi, Degla St 213, Apt 4", "Default address")}
          {renderSettingRow("history", t("account.ordersHistory"), "0 completed orders")}
          {renderSettingRow("help-circle-outline", t("account.support"))}
        </View>

        <Divider space={4} />

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text variant="caption" tone="muted" align="center">
            {t("account.version")}
          </Text>
          <Text variant="caption" tone="muted" align="center" style={styles.footerSub}>
            Expo SDK 57 · React Native 0.86 · Clerk Authentication
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[12],
  },
  profileCard: {
    padding: spacing[5],
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: spacing[5],
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing[3],
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: spacing[3],
  },
  profileName: {
    marginBottom: 2,
  },
  profileSub: {
    marginBottom: spacing[3],
  },
  badgeRow: {
    marginBottom: spacing[3],
  },
  prototypeNotice: {
    width: "100%",
    marginTop: spacing[2],
  },
  authCtaButton: {
    marginTop: spacing[4],
    minWidth: 160,
  },
  signOutButton: {
    marginTop: spacing[2],
    minWidth: 120,
  },
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    marginBottom: spacing[2],
  },
  settingRow: {
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing[2],
  },
  settingLeading: {
    alignItems: "center",
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginEnd: spacing[3],
  },
  settingTextContainer: {
    flex: 1,
  },
  footer: {
    marginTop: spacing[4],
    alignItems: "center",
  },
  footerSub: {
    marginTop: 4,
  },
});
