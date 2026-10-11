import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeProvider";
import { useI18n, useFormat } from "../../i18n/I18nProvider";
import { useCartStore } from "../../store/cartStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import type { Product } from "../../data/catalogRepository";
import { Text } from "../ui/Text";
import { Price } from "../ui/Price";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { QuantityStepper } from "../ui/QuantityStepper";
import { Pressable } from "../ui/Pressable";
import { ProductImage } from "./ProductImage";
import { radii, spacing, elevations } from "../../theme/tokens";

export interface ProductCardProps {
  readonly product: Product;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function ProductCard({ product, onPress, style }: ProductCardProps) {
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatNumber } = useFormat();

  const { addItem, updateQuantity, getItemQuantity } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const cartQuantity = getItemQuantity(product.id);
  const favorited = isFavorite(product.id);

  const productName = isRTL ? product.nameAr : product.name;
  const productUnit = isRTL ? product.unitAr : product.unit;

  const handleAddToCart = () => {
    addItem(product, 1);
  };

  const handleQuantityChange = (newQty: number) => {
    updateQuantity(product.id, newQty);
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${productName}, ${productUnit}`}
      enforceMinTarget={false}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.card,
          borderColor: colors.border.subtle,
          ...elevations.card,
        },
        style,
      ]}
    >
      {/* Top Image & Floating Badges */}
      <View style={styles.imageContainer}>
        <ProductImage
          uri={product.images[0]}
          alt={productName}
          aspectRatio={1}
          borderRadius={radii.md}
        />

        {/* Favorite Heart Button */}
        <View style={[styles.favoriteButton, isRTL ? styles.leftTop : styles.rightTop]}>
          <IconButton
            icon={
              <MaterialCommunityIcons
                name={favorited ? "heart" : "heart-outline"}
                size={20}
                color={favorited ? colors.danger[600] : colors.neutral[800]}
              />
            }
            onPress={() => toggleFavorite(product.id)}
            accessibilityLabel="Toggle favorite"
            variant="filled"
            size={36}
          />
        </View>

        {/* Organic Tag */}
        {product.isOrganic ? (
          <View style={[styles.organicBadge, isRTL ? styles.rightTop : styles.leftTop]}>
            <Badge label={t("filter.organic")} tone="brand" size="sm" />
          </View>
        ) : null}
      </View>

      {/* Product Content Details */}
      <View style={styles.content}>
        {/* Unit & Metadata line */}
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {productUnit}
        </Text>

        {/* Title */}
        <Text
          variant="h3"
          numberOfLines={2}
          style={styles.title}
        >
          {productName}
        </Text>

        {/* Stock warning line if low or out of stock */}
        {!product.inStock ? (
          <Text variant="caption" tone="danger" style={styles.stockNotice}>
            {t("product.outOfStock")}
          </Text>
        ) : product.stockQuantity <= 5 ? (
          <Text variant="caption" tone="accent" style={styles.stockNotice}>
            {t("product.lowStock", { count: formatNumber(product.stockQuantity) })}
          </Text>
        ) : (
          <View style={styles.stockSpacer} />
        )}

        {/* Price Cluster */}
        <View style={styles.priceCluster}>
          <Price
            priceMinor={product.priceMinor}
            compareAtPriceMinor={product.compareAtPriceMinor}
            discountPercent={product.discountPercent}
            size="md"
          />
        </View>

        {/* Primary Action Slot */}
        <View style={styles.actionContainer}>
          {!product.inStock ? (
            <Button
              label={t("product.outOfStock")}
              onPress={() => {}}
              disabled
              size="sm"
              fullWidth
            />
          ) : cartQuantity > 0 ? (
            <QuantityStepper
              value={cartQuantity}
              onChange={handleQuantityChange}
              min={0}
              max={product.stockQuantity}
              size="sm"
            />
          ) : (
            <Button
              label={t("product.addToCart")}
              onPress={handleAddToCart}
              variant="secondary"
              size="sm"
              fullWidth
              leftIcon={
                <MaterialCommunityIcons
                  name="plus"
                  size={16}
                  color={colors.brand[600]}
                />
              }
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
    marginBottom: spacing[3],
  },
  imageContainer: {
    position: "relative",
    width: "100%",
  },
  favoriteButton: {
    position: "absolute",
    top: spacing[2],
    zIndex: 2,
  },
  organicBadge: {
    position: "absolute",
    top: spacing[2],
    zIndex: 2,
  },
  leftTop: {
    left: spacing[2],
  },
  rightTop: {
    right: spacing[2],
  },
  content: {
    padding: spacing[3],
    flex: 1,
    justifyContent: "space-between",
  },
  title: {
    marginTop: spacing[0.5 as keyof typeof spacing] ?? 2,
    minHeight: 44, // Ensures 2 lines align cards nicely
  },
  stockNotice: {
    marginVertical: spacing[1],
  },
  stockSpacer: {
    height: 18,
    marginVertical: spacing[1],
  },
  priceCluster: {
    marginVertical: spacing[1],
  },
  actionContainer: {
    marginTop: spacing[2],
  },
});
