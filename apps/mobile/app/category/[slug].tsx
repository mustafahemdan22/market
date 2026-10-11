import { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { catalogRepository } from "../../src/data/catalogService";
import type { Category, Product } from "../../src/data/catalogRepository";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { ProductGrid } from "../../src/components/commerce/ProductGrid";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { CartBar } from "../../src/components/commerce/CartBar";
import { spacing } from "../../src/theme/tokens";

export default function CategoryScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategoryData() {
      if (!slug) return;
      setLoading(true);
      try {
        const [categories, catProducts] = await Promise.all([
          catalogRepository.listCategories(),
          catalogRepository.listProducts({ categorySlug: slug }),
        ]);
        const found = categories.find((c) => c.slug === slug);
        setCategory(found ?? null);
        setProducts(catProducts);
      } finally {
        setLoading(false);
      }
    }
    void loadCategoryData();
  }, [slug]);

  const categoryName = category ? (isRTL ? category.nameAr : category.name) : slug;

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
      <HeaderBar
        title={categoryName}
        onBack={() => router.back()}
        onCartPress={() => router.push("/cart")}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!loading && products.length === 0 ? (
          <EmptyState
            title={t("search.noResults")}
            description={t("search.noResultsDesc")}
            iconName="basket-outline"
            actionLabel={t("action.back")}
            onAction={() => router.back()}
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
  gridContainer: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
  },
  bottomSpacer: {
    height: 48,
  },
});
