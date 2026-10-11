import { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../src/theme/ThemeProvider";
import { useI18n } from "../../src/i18n/I18nProvider";
import { catalogRepository } from "../../src/data/fixtures/fixtureRepository";
import type { Category, Product } from "../../src/data/catalogRepository";
import { HeaderBar } from "../../src/components/commerce/HeaderBar";
import { SearchField } from "../../src/components/ui/SearchField";
import { Banner } from "../../src/components/ui/Banner";
import { CategoryTile } from "../../src/components/commerce/CategoryTile";
import { SectionHeader } from "../../src/components/commerce/SectionHeader";
import { ProductCard } from "../../src/components/commerce/ProductCard";
import { ProductGrid } from "../../src/components/commerce/ProductGrid";
import { CartBar } from "../../src/components/commerce/CartBar";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { Skeleton } from "../../src/components/ui/Skeleton";
import { spacing, radii } from "../../src/theme/tokens";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();

  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [deals, setDeals] = useState<readonly Product[]>([]);
  const [freshPicks, setFreshPicks] = useState<readonly Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [cats, dealProducts, allProducts] = await Promise.all([
        catalogRepository.listCategories(),
        catalogRepository.getFeaturedDeals(),
        catalogRepository.listProducts(),
      ]);
      setCategories(cats);
      setDeals(dealProducts);
      setFreshPicks(allProducts);
    } catch {
      setError("Failed to load catalog data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const handleProductPress = (product: Product) => {
    router.push({
      pathname: "/product/[slug]",
      params: { slug: product.slug },
    });
  };

  const handleCategoryPress = (category: Category) => {
    router.push({
      pathname: "/category/[slug]",
      params: { slug: category.slug },
    });
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim().length > 0) {
      router.push({
        pathname: "/search",
        params: { q: searchQuery.trim() },
      });
    } else {
      router.push("/search");
    }
  };

  if (error && !refreshing) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}>
        <HeaderBar
          title={t("header.greeting")}
          subtitle={t("header.location")}
          onCartPress={() => router.push("/cart")}
        />
        <ErrorState message={error} onRetry={() => { void loadData(); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      {/* Top Header */}
      <HeaderBar
        title={t("header.greeting")}
        subtitle={t("header.location")}
        onCartPress={() => router.push("/cart")}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand[600]}
          />
        }
      >
        {/* Development Prototype Banner */}
        <View style={styles.sectionPadding}>
          <Banner message={t("home.devBanner")} tone="dev" />
        </View>

        {/* Search Field */}
        <View style={styles.sectionPadding}>
          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
          />
        </View>

        {/* Categories Horizontal Carousel */}
        <View style={styles.sectionPadding}>
          <SectionHeader
            title={t("home.categoriesTitle")}
            onSeeAll={() => router.push("/search")}
          />
          {loading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skeletonTile}>
                  <Skeleton width={64} height={64} circle />
                  <Skeleton width={50} height={12} style={styles.skeletonText} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.horizontalRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              {categories.map((category) => (
                <CategoryTile
                  key={category.slug}
                  category={category}
                  onPress={() => handleCategoryPress(category)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Deals Horizontal Rail */}
        <View style={styles.sectionPadding}>
          <SectionHeader
            title={t("home.dealsTitle")}
            onSeeAll={() => router.push("/search")}
          />
          {loading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}
            >
              {[1, 2].map((i) => (
                <View key={i} style={styles.dealSkeleton}>
                  <Skeleton height={140} borderRadius={radii.md} />
                  <Skeleton height={16} width="80%" style={styles.skeletonText} />
                  <Skeleton height={20} width="40%" style={styles.skeletonText} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.horizontalRow,
                { flexDirection: isRTL ? "row-reverse" : "row" },
              ]}
            >
              {deals.map((deal) => (
                <View key={deal.id} style={styles.dealCardWrapper}>
                  <ProductCard
                    product={deal}
                    onPress={() => handleProductPress(deal)}
                  />
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Fresh Picks Responsive Grid */}
        <View style={styles.sectionPadding}>
          <SectionHeader title={t("home.freshPicksTitle")} />
          <ProductGrid
            products={freshPicks}
            loading={loading}
            onProductPress={handleProductPress}
          />
        </View>

        {/* Extra bottom spacer so sticky cart bar does not overlap list */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky Floating Cart Bar */}
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
  sectionPadding: {
    paddingHorizontal: spacing[4],
  },
  horizontalRow: {
    paddingVertical: spacing[1],
  },
  skeletonTile: {
    alignItems: "center",
    marginEnd: spacing[3],
  },
  skeletonText: {
    marginTop: spacing[2],
  },
  dealSkeleton: {
    width: 170,
    marginEnd: spacing[3],
  },
  dealCardWrapper: {
    width: 175,
    marginEnd: spacing[3],
  },
  bottomSpacer: {
    height: 48,
  },
});
