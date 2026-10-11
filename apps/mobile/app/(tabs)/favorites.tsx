import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { useFavoritesStore } from "../../src/store/favoritesStore";
import { useCartStore } from "../../src/store/cartStore";
import { catalogRepository } from "../../src/data/catalogService";
import type { Product } from "../../src/data/catalogRepository";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { ProductGrid } from "../../src/components/commerce/ProductGrid";
import { CartBar } from "../../src/components/commerce/CartBar";
import { spacing } from "../../src/theme/tokens";

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useI18n();

  const { favoriteIds } = useFavoritesStore();
  const { addItem } = useCartStore();

  const [products, setProducts] = useState<readonly Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFavorites() {
      setLoading(true);
      try {
        const all = await catalogRepository.listProducts();
        const favs = all.filter((p) => favoriteIds.includes(p.id));
        setProducts(favs);
      } finally {
        setLoading(false);
      }
    }
    void loadFavorites();
  }, [favoriteIds]);

  const handleAddAllToCart = () => {
    for (const p of products) {
      if (p.inStock) {
        addItem(p, 1);
      }
    }
  };

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: "/product/[slug]",
      params: { slug: product.slug },
    });
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar title={t("favorites.title")} onCartPress={() => router.push("/cart")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {products.length > 0 ? (
          <View style={styles.actionHeader}>
            <Button
              label={t("favorites.addAllToCart")}
              onPress={handleAddAllToCart}
              variant="secondary"
              size="sm"
            />
          </View>
        ) : null}

        {!loading && products.length === 0 ? (
          <EmptyState
            title={t("favorites.emptyTitle")}
            description={t("favorites.emptyDesc")}
            iconName="heart-outline"
            actionLabel={t("cart.startShopping")}
            onAction={() => router.push("/")}
          />
        ) : (
          <View style={styles.gridContainer}>
            <ProductGrid
              products={products}
              loading={loading}
              onProductPress={handleProductPress}
            />
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <CartBar onViewCart={() => router.push("/cart")} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[16],
  },
  actionHeader: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
    alignItems: "flex-end",
  },
  gridContainer: {
    paddingHorizontal: spacing[4],
  },
  bottomSpacer: {
    height: 48,
  },
});
