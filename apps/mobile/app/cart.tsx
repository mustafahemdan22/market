import { useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../src/theme/ThemeProvider";
import { useI18n } from "../src/i18n/I18nProvider";
import { useCartStore } from "../src/store/cartStore";
import { HeaderBar } from "../src/components/commerce/HeaderBar";
import { CartLineItem } from "../src/components/commerce/CartLineItem";
import { PriceSummary } from "../src/components/commerce/PriceSummary";
import { EmptyState } from "../src/components/ui/EmptyState";
import { Input } from "../src/components/ui/Input";
import { Button } from "../src/components/ui/Button";
import { Banner } from "../src/components/ui/Banner";
import { spacing } from "../src/theme/tokens";

export default function CartScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isRTL, t } = useI18n();

  const {
    items,
    couponCode,
    applyCoupon,
    removeCoupon,
    getTotals,
  } = useCartStore();

  const [inputCoupon, setInputCoupon] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const totals = getTotals();

  const handleApplyCoupon = () => {
    if (!inputCoupon.trim()) return;
    const success = applyCoupon(inputCoupon);
    if (success) {
      setCouponError(null);
      setInputCoupon("");
    } else {
      setCouponError(t("cart.couponInvalid"));
    }
  };

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.safeArea, { backgroundColor: colors.surface.canvas }]}
    >
      <HeaderBar
        title={t("cart.title")}
        onBack={() => router.back()}
        showCart={false}
      />

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            title={t("cart.emptyTitle")}
            description={t("cart.emptyDesc")}
            iconName="basket-outline"
            actionLabel={t("cart.startShopping")}
            onAction={() => router.replace("/")}
          />
        </View>
      ) : (
        <View style={styles.contentFlex}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Cart Line Items */}
            <View style={styles.itemsSection}>
              {items.map((item) => (
                <CartLineItem
                  key={`${item.product.id}-${item.selectedVariantId ?? "default"}`}
                  item={item}
                />
              ))}
            </View>

            {/* Coupon Code Section */}
            <View
              style={[
                styles.couponCard,
                {
                  backgroundColor: colors.surface.card,
                  borderColor: colors.border.subtle,
                },
              ]}
            >
              {couponCode ? (
                <View
                  style={[
                    styles.couponAppliedRow,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                >
                  <View style={styles.appliedBannerWrapper}>
                    <Banner message={t("cart.couponApplied")} tone="success" />
                  </View>
                  <Button
                    label={t("action.close")}
                    onPress={removeCoupon}
                    size="sm"
                    variant="ghost"
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.couponInputRow,
                    { flexDirection: isRTL ? "row-reverse" : "row" },
                  ]}
                >
                  <View style={styles.inputFlex}>
                    <Input
                      placeholder={t("cart.couponPlaceholder")}
                      value={inputCoupon}
                      onChangeText={setInputCoupon}
                      error={couponError ?? undefined}
                      containerStyle={styles.noMarginInput}
                    />
                  </View>
                  <Button
                    label={t("cart.applyCoupon")}
                    onPress={handleApplyCoupon}
                    size="md"
                    variant="secondary"
                    style={isRTL ? styles.buttonMarginRTL : styles.buttonMarginLTR}
                  />
                </View>
              )}
            </View>

            {/* Price Summary Breakdown */}
            <PriceSummary
              subtotalMinor={totals.subtotalMinor}
              discountMinor={totals.discountMinor}
              deliveryFeeMinor={totals.deliveryFeeMinor}
              taxMinor={totals.taxMinor}
              totalMinor={totals.totalMinor}
              freeDeliveryRemainingMinor={totals.freeDeliveryRemainingMinor}
              hasFreeDelivery={totals.hasFreeDelivery}
            />

            {/* Prototype notice for Checkout boundary */}
            <View style={styles.noticeMargin}>
              <Banner message={t("cart.checkoutPrototypeNotice")} tone="dev" />
            </View>
          </ScrollView>

          {/* Sticky Checkout CTA Footer */}
          <View
            style={[
              styles.footer,
              {
                backgroundColor: colors.surface.card,
                borderTopColor: colors.border.subtle,
              },
            ]}
          >
            <Button
              label={t("cart.checkoutButton")}
              onPress={() => {}}
              disabled
              size="lg"
              fullWidth
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentFlex: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    padding: spacing[4],
    paddingBottom: spacing[6],
  },
  itemsSection: {
    marginBottom: spacing[2],
  },
  couponCard: {
    padding: spacing[3],
    borderRadius: spacing[3],
    borderWidth: 1,
    marginBottom: spacing[4],
  },
  couponInputRow: {
    alignItems: "center",
  },
  inputFlex: {
    flex: 1,
  },
  noMarginInput: {
    marginBottom: 0,
  },
  buttonMarginLTR: {
    marginStart: spacing[2],
  },
  buttonMarginRTL: {
    marginEnd: spacing[2],
  },
  couponAppliedRow: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  appliedBannerWrapper: {
    flex: 1,
    marginEnd: spacing[2],
  },
  noticeMargin: {
    marginTop: spacing[4],
  },
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
  },
});
