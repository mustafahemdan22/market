import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { useCart } from "../../cart/CartProvider";
import { Text } from "../ui/Text";
import { Button } from "../ui/Button";
import { radii, spacing, elevations, touchTargets } from "../../theme/tokens";

export interface CartBarProps {
  readonly onViewCart: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function CartBar({ onViewCart, style }: CartBarProps) {
  const { colors } = useTheme();
  const { isRTL, t, mirrorStyle } = useI18n();
  const { formatMoney, formatNumber } = useFormat();

  // Both numbers are the server's. The bar is hidden entirely when the cart is
  // empty, signed out, or unavailable — a bar offering "view cart" over nothing
  // is noise.
  const { itemCount, subtotalMinor, status } = useCart();

  if (itemCount === 0 || status !== "ready") {
    return null;
  }

  return (
    <View style={[styles.outerWrapper, style]}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.brand[600],
            ...elevations.sheet,
            flexDirection: isRTL ? "row-reverse" : "row",
          },
        ]}
      >
        <View style={styles.infoColumn}>
          <View style={[styles.countRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
            <MaterialCommunityIcons name="basket" size={18} color={colors.neutral[0]} />
            <Text
              variant="label"
              tone="inverse"
              style={isRTL ? styles.marginEndCount : styles.marginStartCount}
            >
              {formatNumber(itemCount)} {t("cartBar.items")}
            </Text>
          </View>

          <Text variant="price" tone="inverse" style={styles.priceText}>
            {formatMoney(subtotalMinor)}
          </Text>
        </View>

        <Button
          label={t("cartBar.viewCart")}
          onPress={onViewCart}
          variant="secondary"
          size="sm"
          style={styles.actionButton}
          rightIcon={
            <View style={mirrorStyle()}>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.brand[600]} />
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    bottom: spacing[4],
    left: spacing[4],
    right: spacing[4],
    zIndex: 100,
  },
  container: {
    borderRadius: radii.xl,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoColumn: {
    justifyContent: "center",
  },
  countRow: {
    alignItems: "center",
    marginBottom: 2,
  },
  marginStartCount: {
    marginStart: spacing[1.5 as keyof typeof spacing] ?? 6,
  },
  marginEndCount: {
    marginEnd: spacing[1.5 as keyof typeof spacing] ?? 6,
  },
  priceText: {
    fontWeight: "700",
  },
  actionButton: {
    paddingHorizontal: spacing[4],
    minHeight: touchTargets.min,
    borderRadius: radii.lg,
  },
});
