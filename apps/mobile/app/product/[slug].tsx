import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n, useFormat } from "../../src/i18n/I18nProvider";
import { useCartStore } from "../../src/store/cartStore";
import { useFavoritesStore } from "../../src/store/favoritesStore";
import { catalogRepository } from "../../src/data/catalogService";
import type { Product, ProductVariant } from "../../src/data/catalogRepository";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { ProductImage } from "../../src/components/commerce/ProductImage";
import { Price } from "../../src/components/ui/Price";
import { Badge } from "../../src/components/ui/Badge";
import { Text } from "../../src/components/ui/Text";
import { Button } from "../../src/components/ui/Button";
import { Chip } from "../../src/components/ui/Chip";
import { QuantityStepper } from "../../src/components/ui/QuantityStepper";
import { IconButton } from "../../src/components/ui/IconButton";
import { Divider } from "../../src/components/ui/Divider";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { Skeleton } from "../../src/components/ui/Skeleton";
import { Pressable } from "../../src/components/ui/Pressable";
import { spacing, radii } from "../../src/theme/tokens";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatNumber } = useFormat();

  const { addItem, getItemQuantity } = useCartStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    async function loadProduct() {
      if (!slug) return;
      setLoading(true);
      try {
        const found = await catalogRepository.getProduct(slug);
        setProduct(found);
        if (found?.variants && found.variants.length > 0) {
          const firstVariant = found.variants[0];
          if (firstVariant) {
            setSelectedVariant(firstVariant);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void loadProduct();
  }, [slug]);

  if (loading) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
      >
        <HeaderBar onBack={() => router.back()} showCart={false} />
        <View style={styles.loadingContainer}>
          <Skeleton height={280} borderRadius={radii.lg} />
          <Skeleton height={24} width="80%" style={styles.skeletonSpacing} />
          <Skeleton height={18} width="40%" style={styles.skeletonSpacing} />
          <Skeleton height={30} width="60%" style={styles.skeletonSpacing} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView
        edges={["top"]}
        style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
      >
        <HeaderBar onBack={() => router.back()} showCart={false} />
        <ErrorState
          message="Product not found"
          onRetry={() => router.back()}
          retryLabel={t("action.back")}
        />
      </SafeAreaView>
    );
  }

  const name = isRTL ? product.nameAr : product.name;
  const description = isRTL ? product.descriptionAr : product.description;
  const origin = isRTL ? product.originAr : product.origin;
  const unit = isRTL ? product.unitAr : product.unit;
  const favorited = isFavorite(product.id);
  const alreadyInCart = getItemQuantity(product.id);

  const activePriceMinor = selectedVariant ? selectedVariant.priceMinor : product.priceMinor;

  const handleAddToCart = () => {
    addItem(product, quantity, selectedVariant?.id);
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar
        title={name}
        onBack={() => router.back()}
        onCartPress={() => router.push("/cart")}
      />

      <View style={styles.mainContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Image Container */}
          <View style={styles.heroImageWrapper}>
            <ProductImage
              uri={product.images[selectedImageIndex] ?? product.images[0]}
              alt={name}
              aspectRatio={1.15}
              borderRadius={radii.lg}
            />

            {/* Favorite Action Button on Top */}
            <View style={[styles.floatingHeart, isRTL ? styles.leftTop : styles.rightTop]}>
              <IconButton
                icon={
                  <MaterialCommunityIcons
                    name={favorited ? "heart" : "heart-outline"}
                    size={22}
                    color={favorited ? colors.danger[600] : colors.neutral[800]}
                  />
                }
                onPress={() => toggleFavorite(product.id)}
                accessibilityLabel="Toggle favorite"
                variant="filled"
              />
            </View>

            {/* Image Pagination Dots */}
            {product.images.length > 1 ? (
              <View style={styles.dotsRow}>
                {product.images.map((_, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedImageIndex(idx)}
                    enforceMinTarget={false}
                    accessibilityRole="button"
                    accessibilityLabel={`Image ${idx + 1}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          idx === selectedImageIndex ? colors.brand[600] : colors.neutral[300],
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {/* Product Header Information */}
          <View style={styles.sectionPadding}>
            <View style={[styles.originRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
              <Text variant="caption" tone="brand">
                {origin}
              </Text>
              {product.isOrganic ? (
                <Badge label={t("filter.organic")} tone="brand" size="sm" />
              ) : null}
            </View>

            <Text variant="h1" style={styles.title}>
              {name}
            </Text>

            <Text variant="caption" tone="muted">
              {unit}
            </Text>

            {/* Price Cluster */}
            <View style={styles.priceRow}>
              <Price
                priceMinor={activePriceMinor}
                compareAtPriceMinor={product.compareAtPriceMinor}
                discountPercent={product.discountPercent}
                size="lg"
              />
            </View>

            {/* Stock Availability Line */}
            <View style={styles.stockLine}>
              {!product.inStock ? (
                <Text variant="caption" tone="danger">
                  {t("product.outOfStock")}
                </Text>
              ) : product.stockQuantity <= 5 ? (
                <Text variant="caption" tone="accent">
                  {t("product.lowStock", {
                    count: formatNumber(product.stockQuantity),
                  })}
                </Text>
              ) : (
                <Text variant="caption" tone="brand">
                  {t("product.inStock")}
                </Text>
              )}
            </View>

            {/* Variants Selector if product has variants */}
            {product.variants && product.variants.length > 0 ? (
              <View style={styles.variantsSection}>
                <Text variant="label" style={styles.variantLabel}>
                  {t("product.selectVariant")}
                </Text>
                <View
                  style={[styles.variantsRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}
                >
                  {product.variants.map((v) => (
                    <Chip
                      key={v.id}
                      label={isRTL ? v.nameAr : v.name}
                      selected={selectedVariant?.id === v.id}
                      onPress={() => setSelectedVariant(v)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <Divider space={4} />

            {/* Product Description */}
            <View style={styles.detailsSection}>
              <Text variant="h3" style={styles.sectionHeader}>
                {t("product.description")}
              </Text>
              <Text variant="body" tone="secondary" style={styles.bodyDescription}>
                {description}
              </Text>
            </View>

            <Divider space={4} />

            {/* Origin & Quality Guarantee */}
            <View style={styles.detailsSection}>
              <Text variant="h3" style={styles.sectionHeader}>
                {t("product.origin")}
              </Text>
              <Text variant="body" tone="secondary">
                {origin} — 100% Guaranteed Freshness
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Action Footer */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.surface.card,
              borderTopColor: colors.border.subtle,
              flexDirection: isRTL ? "row-reverse" : "row",
            },
          ]}
        >
          {product.inStock ? (
            <View style={styles.quantityCol}>
              <QuantityStepper
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={product.stockQuantity}
                size="md"
              />
            </View>
          ) : null}

          <View style={styles.buttonCol}>
            <Button
              label={
                !product.inStock
                  ? t("product.outOfStock")
                  : alreadyInCart > 0
                    ? t("product.addedToCart")
                    : t("product.addToCart")
              }
              onPress={handleAddToCart}
              disabled={!product.inStock}
              size="lg"
              fullWidth
              leftIcon={
                product.inStock ? (
                  <MaterialCommunityIcons name="basket-plus" size={20} color={colors.neutral[0]} />
                ) : undefined
              }
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[6],
  },
  loadingContainer: {
    padding: spacing[4],
  },
  skeletonSpacing: {
    marginTop: spacing[3],
  },
  heroImageWrapper: {
    position: "relative",
    paddingHorizontal: spacing[4],
    marginBottom: spacing[4],
  },
  floatingHeart: {
    position: "absolute",
    top: spacing[3],
    zIndex: 5,
  },
  leftTop: {
    left: spacing[6],
  },
  rightTop: {
    right: spacing[6],
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  sectionPadding: {
    paddingHorizontal: spacing[4],
  },
  originRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing[1],
  },
  title: {
    marginVertical: spacing[1],
  },
  priceRow: {
    marginTop: spacing[3],
    marginBottom: spacing[1],
  },
  stockLine: {
    marginBottom: spacing[3],
  },
  variantsSection: {
    marginBottom: spacing[2],
  },
  variantLabel: {
    marginBottom: spacing[2],
  },
  variantsRow: {
    flexWrap: "wrap",
  },
  detailsSection: {
    marginVertical: spacing[1],
  },
  sectionHeader: {
    marginBottom: spacing[2],
  },
  bodyDescription: {
    lineHeight: 24,
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
    alignItems: "center",
  },
  quantityCol: {
    marginEnd: spacing[3],
  },
  buttonCol: {
    flex: 1,
  },
});
