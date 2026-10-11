import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { Text } from "../ui/Text";
import { Divider } from "../ui/Divider";
import { Banner } from "../ui/Banner";
import { spacing, radii } from "../../theme/tokens";

export interface PriceSummaryProps {
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly deliveryFeeMinor: number;
  readonly taxMinor: number;
  readonly totalMinor: number;
  readonly freeDeliveryRemainingMinor?: number;
  readonly hasFreeDelivery?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function PriceSummary({
  subtotalMinor,
  discountMinor,
  deliveryFeeMinor,
  taxMinor,
  totalMinor,
  freeDeliveryRemainingMinor = 0,
  hasFreeDelivery = false,
  style,
}: PriceSummaryProps) {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatMoney } = useFormat();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
        },
        style,
      ]}
    >
      {/* Free Delivery Banner */}
      {hasFreeDelivery && subtotalMinor > 0 ? (
        <View style={styles.bannerContainer}>
          <Banner message={t("cart.freeDeliveryUnlocked")} tone="success" />
        </View>
      ) : freeDeliveryRemainingMinor > 0 ? (
        <View style={styles.bannerContainer}>
          <Banner
            message={t("cart.freeDeliveryThreshold", {
              amount: formatMoney(freeDeliveryRemainingMinor),
            })}
            tone="info"
          />
        </View>
      ) : null}

      {/* Subtotal Row */}
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text variant="body" tone="secondary">
          {t("cart.subtotal")}
        </Text>
        <Text variant="bodyStrong">{formatMoney(subtotalMinor)}</Text>
      </View>

      {/* Discount / Savings Row */}
      {discountMinor > 0 ? (
        <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <Text variant="body" tone="brand">
            {t("cart.discount")}
          </Text>
          <Text variant="bodyStrong" tone="brand">
            -{formatMoney(discountMinor)}
          </Text>
        </View>
      ) : null}

      {/* Delivery Fee Row */}
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text variant="body" tone="secondary">
          {t("cart.deliveryFee")}
        </Text>
        <Text variant="bodyStrong" tone={deliveryFeeMinor === 0 ? "brand" : "primary"}>
          {deliveryFeeMinor === 0 ? "0.00" : formatMoney(deliveryFeeMinor)}
        </Text>
      </View>

      {/* Tax Estimate Row */}
      <View style={[styles.row, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text variant="caption" tone="muted">
          {t("cart.taxEstimate")}
        </Text>
        <Text variant="caption" tone="muted">
          {formatMoney(taxMinor)}
        </Text>
      </View>

      <Divider space={3} />

      {/* Total Row */}
      <View style={[styles.totalRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <Text variant="h2">{t("cart.total")}</Text>
        <Text variant="priceLarge" tone="brand">
          {formatMoney(totalMinor)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: 1,
    width: "100%",
  },
  bannerContainer: {
    marginBottom: spacing[3],
  },
  row: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[2],
  },
  totalRow: {
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing[1],
  },
});
