import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { useCartStore } from "../../store/cartStore";
import { Text } from "../ui/Text";
import { IconButton } from "../ui/IconButton";
import { Pressable } from "../ui/Pressable";
import { spacing, radii } from "../../theme/tokens";

export interface HeaderBarProps {
  readonly title?: string;
  readonly subtitle?: string;
  readonly onBack?: () => void;
  readonly onCartPress?: () => void;
  readonly showLanguageToggle?: boolean;
  readonly showCart?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function HeaderBar({
  title,
  subtitle,
  onBack,
  onCartPress,
  showLanguageToggle = true,
  showCart = true,
  style,
}: HeaderBarProps) {
  const { colors } = useTheme();
  const { isRTL, t, toggleLanguage, mirrorStyle } = useI18n();
  const { formatNumber } = useFormat();
  const { getTotals } = useCartStore();

  const { totalCount } = getTotals();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface.canvas,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
    >
      {/* Leading Slot (Back or Brand Title) */}
      <View style={[styles.leading, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {onBack ? (
          <IconButton
            icon={
              <View style={mirrorStyle()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text.primary} />
              </View>
            }
            onPress={onBack}
            accessibilityLabel={t("action.back")}
            style={isRTL ? styles.backButtonRTL : styles.backButtonLTR}
          />
        ) : null}

        <View style={styles.titleColumn}>
          <Text variant="h2" numberOfLines={1}>
            {title ?? t("header.greeting")}
          </Text>
          {subtitle ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Trailing Slot (Language switcher + Cart badge) */}
      <View style={[styles.trailing, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        {showLanguageToggle ? (
          <Pressable
            onPress={toggleLanguage}
            accessibilityRole="button"
            accessibilityLabel={t("header.switchLanguage")}
            style={[
              styles.langPill,
              {
                backgroundColor: colors.surface.card,
                borderColor: colors.border.subtle,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="translate"
              size={16}
              color={colors.brand[600]}
              style={styles.langIcon}
            />
            <Text variant="label" tone="brand">
              {t("header.switchLanguage")}
            </Text>
          </Pressable>
        ) : null}

        {showCart && onCartPress ? (
          <View style={styles.cartContainer}>
            <IconButton
              icon={
                <MaterialCommunityIcons
                  name="basket-outline"
                  size={24}
                  color={colors.text.primary}
                />
              }
              onPress={onCartPress}
              accessibilityLabel={t("header.cartBadge")}
            />
            {totalCount > 0 ? (
              <View style={[styles.badgeCircle, { backgroundColor: colors.brand[600] }]}>
                <Text variant="caption" tone="inverse" style={styles.badgeText}>
                  {formatNumber(totalCount)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
  },
  leading: {
    flex: 1,
    alignItems: "center",
  },
  titleColumn: {
    justifyContent: "center",
  },
  backButtonLTR: {
    marginEnd: spacing[2],
  },
  backButtonRTL: {
    marginStart: spacing[2],
  },
  trailing: {
    alignItems: "center",
  },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[2.5 as keyof typeof spacing] ?? 10,
    paddingVertical: spacing[1],
    borderRadius: radii.full,
    borderWidth: 1,
    marginEnd: spacing[2],
    minHeight: 34,
  },
  langIcon: {
    marginEnd: spacing[1],
  },
  cartContainer: {
    position: "relative",
  },
  badgeCircle: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
});
