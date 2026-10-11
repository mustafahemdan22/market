import { useState, useEffect, useCallback } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n, useFormat } from "../../src/i18n/I18nProvider";
import { catalogRepository } from "../../src/data/catalogService";
import type { Product } from "../../src/data/catalogRepository";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { SearchField } from "../../src/components/ui/SearchField";
import { Chip } from "../../src/components/ui/Chip";
import { Text } from "../../src/components/ui/Text";
import { ProductGrid } from "../../src/components/commerce/ProductGrid";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { CartBar } from "../../src/components/commerce/CartBar";
import { spacing } from "../../src/theme/tokens";

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();
  const { formatNumber } = useFormat();

  const [query, setQuery] = useState(params.q ?? "");
  const [filterType, setFilterType] = useState<"all" | "deals" | "organic" | "inStock">("all");
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const results = await catalogRepository.listProducts({
        query,
        dealsOnly: filterType === "deals",
        organicOnly: filterType === "organic",
        inStockOnly: filterType === "inStock",
      });
      setProducts(results);
    } finally {
      setLoading(false);
    }
  }, [query, filterType]);

  useEffect(() => {
    void fetchResults();
  }, [fetchResults]);

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
      <HeaderBar title={t("search.title")} onCartPress={() => router.push("/cart")} />

      <View style={styles.searchSection}>
        <SearchField value={query} onChangeText={setQuery} onClear={() => setQuery("")} />
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.chipsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.chipsScroll,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          <Chip
            label={t("filter.all")}
            selected={filterType === "all"}
            onPress={() => setFilterType("all")}
          />
          <Chip
            label={t("filter.deals")}
            selected={filterType === "deals"}
            onPress={() => setFilterType("deals")}
          />
          <Chip
            label={t("filter.organic")}
            selected={filterType === "organic"}
            onPress={() => setFilterType("organic")}
          />
          <Chip
            label={t("filter.inStock")}
            selected={filterType === "inStock"}
            onPress={() => setFilterType("inStock")}
          />
        </ScrollView>
      </View>

      {/* Results Count Line */}
      <View style={styles.resultsHeader}>
        <Text variant="caption" tone="secondary">
          {formatNumber(products.length)} {t("search.resultsCount")}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!loading && products.length === 0 ? (
          <EmptyState
            title={t("search.noResults")}
            description={t("search.noResultsDesc")}
            iconName="magnify-close"
            actionLabel={t("search.clear")}
            onAction={() => {
              setQuery("");
              setFilterType("all");
            }}
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
  searchSection: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  chipsRow: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  chipsScroll: {
    paddingVertical: spacing[1],
  },
  resultsHeader: {
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3],
  },
  scrollContent: {
    paddingBottom: spacing[16],
  },
  gridContainer: {
    paddingHorizontal: spacing[4],
  },
  bottomSpacer: {
    height: 48,
  },
});
