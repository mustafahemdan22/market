import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { useCartStore, type CartItem } from "../../store/cartStore";
import { Text } from "../ui/Text";
import { Price } from "../ui/Price";
import { IconButton } from "../ui/IconButton";
import { QuantityStepper } from "../ui/QuantityStepper";
import { ProductImage } from "./ProductImage";
import { radii, spacing } from "../../theme/tokens";

export interface CartLineItemProps {
  readonly item: CartItem;
  readonly onItemPress?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function CartLineItem({ item, onItemPress: _onItemPress, style }: CartLineItemProps) {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatMoney } = useFormat();
  const { updateQuantity, removeItem } = useCartStore();

  const { product, quantity, selectedVariantId } = item;
  const name = isRTL ? product.nameAr : product.name;
  const unit = isRTL ? product.unitAr : product.unit;

  const lineTotalMinor = product.priceMinor * quantity;

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
      {/* Thumbnail */}
      <View style={styles.thumbnailWrapper}>
        <ProductImage uri={product.images[0]} alt={name} aspectRatio={1} borderRadius={radii.md} />
      </View>

      {/* Info & Quantity details */}
      <View style={styles.detailsColumn}>
        <View style={[styles.titleRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View style={styles.titleContainer}>
            <Text variant="caption" tone="muted">
              {unit}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {name}
            </Text>
          </View>

          <IconButton
            icon={
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={18}
                color={colors.text.muted}
              />
            }
            onPress={() => removeItem(product.id, selectedVariantId)}
            accessibilityLabel={t("cart.clearAll")}
            size={36}
          />
        </View>

        {/* Price and Stepper Row */}
        <View style={[styles.actionsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
          <View>
            <Price priceMinor={product.priceMinor} size="sm" />
            <Text variant="caption" tone="secondary">
              {t("cart.subtotal")}: {formatMoney(lineTotalMinor)}
            </Text>
          </View>

          <QuantityStepper
            value={quantity}
            onChange={(newQty) => updateQuantity(product.id, newQty, selectedVariantId)}
            min={0}
            max={product.stockQuantity}
            size="sm"
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
  actionsRow: {
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing[2],
  },
});
