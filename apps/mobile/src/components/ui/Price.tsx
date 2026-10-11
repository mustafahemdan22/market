import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { Text } from "./Text";
import { Badge } from "./Badge";
import { spacing } from "../../theme/tokens";

export interface PriceProps {
  readonly priceMinor: number;
  readonly compareAtPriceMinor?: number | undefined;
  readonly discountPercent?: number | undefined;
  readonly size?: "sm" | "md" | "lg" | undefined;
  readonly style?: StyleProp<ViewStyle> | undefined;
}

export function Price({
  priceMinor,
  compareAtPriceMinor,
  discountPercent,
  size = "md",
  style,
}: PriceProps) {
  const { formatMoney } = useFormat();
  const { isRTL, t } = useI18n();

  const formattedPrice = formatMoney(priceMinor);
  const formattedCompareAt = compareAtPriceMinor ? formatMoney(compareAtPriceMinor) : null;

  const priceVariant = size === "lg" ? "priceLarge" : size === "sm" ? "h3" : "price";

  return (
    <View
      style={[styles.container, { flexDirection: isRTL ? "row-reverse" : "row" }, style]}
      accessibilityRole="text"
      accessibilityLabel={formattedPrice}
    >
      <Text variant={priceVariant} tone="brand">
        {formattedPrice}
      </Text>

      {formattedCompareAt && compareAtPriceMinor! > priceMinor ? (
        <Text
          variant="caption"
          tone="muted"
          style={[styles.strikethrough, isRTL ? styles.marginEnd : styles.marginStart]}
        >
          {formattedCompareAt}
        </Text>
      ) : null}

      {discountPercent && discountPercent > 0 ? (
        <View style={isRTL ? styles.marginEnd : styles.marginStart}>
          <Badge
            label={t("product.discountBadge", { percent: discountPercent })}
            tone="accent"
            size="sm"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  marginStart: {
    marginStart: spacing[2],
  },
  marginEnd: {
    marginEnd: spacing[2],
  },
});
