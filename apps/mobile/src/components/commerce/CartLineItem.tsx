import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { cartIssueKey, useCart, type CartLine } from "../../cart/CartProvider";
import { Text } from "../ui/Text";
import { Price } from "../ui/Price";
import { IconButton } from "../ui/IconButton";
import { QuantityStepper } from "../ui/QuantityStepper";
import { ProductImage } from "./ProductImage";
import { imageUrlFor } from "../../data/imageUrls";
import { radii, spacing } from "../../theme/tokens";

export interface CartLineItemProps {
  /** A line as returned by `public/cart.getCart`. Never constructed locally. */
  readonly line: CartLine;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * One cart line.
 *
 * Every value shown here came from the server for THIS variant: the name, the
 * unit price, the quantity, and the availability. The component performs no
 * arithmetic beyond displaying the server's line total, because a client that
 * multiplies its own numbers can disagree with the invoice.
 */
export function CartLineItem({ line, style }: CartLineItemProps) {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatMoney } = useFormat();
  const { setQuantity, remove, canMutate } = useCart();

  const name = isRTL ? line.nameAr : line.nameEn;
  const variantName = isRTL ? line.variantNameAr : line.variantNameEn;
  const issueKey = cartIssueKey(line.issue);

  const lineTotalMinor = line.priceMinor * line.quantity;
  const canIncrement = canMutate && line.available > line.quantity;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          flexDirection: isRTL ? "row-reverse" : "row",
        },
        style,
      ]}
    >
      <View style={styles.thumbnailWrapper}>
        <ProductImage
          uri={imageUrlFor(line.imagePublicId ?? null)}
          alt={name}
          aspectRatio={1}
          borderRadius={radii.md}
        />
      </View>

      <View style={styles.detailsColumn}>
        <View style={[styles.titleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.titleContainer}>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {variantName === "" ? line.unitLabel : variantName}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {name}
            </Text>
            {issueKey === null ? null : (
              <Text variant="caption" tone="danger" style={styles.issueLine}>
                {t(issueKey)}
              </Text>
            )}
          </View>

          <IconButton
            icon={
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={18}
                color={colors.text.muted}
              />
            }
            onPress={() => {
              void remove(line._id);
            }}
            accessibilityLabel={t("cart.removeItem")}
            size={36}
            disabled={!canMutate}
          />
        </View>

        <View style={[styles.actionsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View>
            <Price priceMinor={line.priceMinor} size="sm" />
            <Text variant="caption" tone="secondary">
              {t("cart.subtotal")}: {formatMoney(lineTotalMinor)}
            </Text>
          </View>

          <QuantityStepper
            value={line.quantity}
            onChange={(next) => {
              void setQuantity(line._id, next);
            }}
            min={1}
            // The server's `available` is the ceiling. Letting the stepper go
            // past it only produces a checkout failure later.
            max={Math.max(line.available, 1)}
            size="sm"
            disabled={!canMutate || !canIncrement}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[3],
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing[3],
    alignItems: "center",
  },
  thumbnailWrapper: {
    width: 80,
    height: 80,
  },
  detailsColumn: {
    flex: 1,
    marginHorizontal: spacing[3],
    justifyContent: "space-between",
  },
  titleRow: {
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleContainer: {
    flex: 1,
    paddingEnd: spacing[2],
  },
  issueLine: {
    marginTop: 2,
  },
  actionsRow: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing[2],
  },
});