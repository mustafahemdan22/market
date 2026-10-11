import { create } from "zustand";
import type { Product } from "../data/catalogRepository";
import {
  addMinor,
  multiplyMinor,
  percentOfMinor,
  computeOrderTotals,
  type MinorUnits,
} from "@grocery/shared";

/**
 * Local UI session store for Phase B.
 * ⚠️ In Phase C, cart state is authoritative and stored in the Convex backend
 * (packages/convex/public/cart.ts). Client math is used only for reactive UI previews.
 */

export interface CartItem {
  readonly product: Product;
  readonly quantity: number;
  readonly selectedVariantId?: string | undefined;
}

interface CartState {
  readonly items: readonly CartItem[];
  readonly couponCode: string | null;
  readonly couponDiscountPercent: number;

  readonly addItem: (product: Product, quantity?: number, variantId?: string) => void;
  readonly removeItem: (productId: string, variantId?: string) => void;
  readonly updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  readonly clearCart: () => void;
  readonly applyCoupon: (code: string) => boolean;
  readonly removeCoupon: () => void;

  readonly getItemQuantity: (productId: string) => number;
  readonly getTotals: () => {
    readonly subtotalMinor: MinorUnits;
    readonly discountMinor: MinorUnits;
    readonly deliveryFeeMinor: MinorUnits;
    readonly taxMinor: MinorUnits;
    readonly totalMinor: MinorUnits;
    readonly totalCount: number;
    readonly freeDeliveryRemainingMinor: MinorUnits;
    readonly hasFreeDelivery: boolean;
  };
}

// 150 EGP free delivery threshold
const FREE_DELIVERY_THRESHOLD_MINOR: MinorUnits = 15000;
// 25 EGP standard express delivery fee
const STANDARD_DELIVERY_FEE_MINOR: MinorUnits = 2500;

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  couponCode: null,
  couponDiscountPercent: 0,

  addItem: (product: Product, quantity = 1, variantId) => {
    if (!product.inStock) return;

    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) =>
          item.product.id === product.id &&
          item.selectedVariantId === variantId,
      );

      if (existingIndex >= 0) {
        const existing = state.items[existingIndex];
        if (!existing) return state;

        const newQuantity = Math.min(
          product.stockQuantity,
          existing.quantity + quantity,
        );
        const updated = [...state.items];
        updated[existingIndex] = { ...existing, quantity: newQuantity };
        return { items: updated };
      }

      const newItem: CartItem = {
        product,
        quantity: Math.min(product.stockQuantity, quantity),
        ...(variantId !== undefined ? { selectedVariantId: variantId } : {}),
      };

      return {
        items: [...state.items, newItem],
      };
    });
  },

  removeItem: (productId: string, variantId?: string) => {
    set((state) => ({
      items: state.items.filter(
        (item) =>
          !(item.product.id === productId && item.selectedVariantId === variantId),
      ),
    }));
  },

  updateQuantity: (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      get().removeItem(productId, variantId);
      return;
    }

    set((state) => ({
      items: state.items.map((item) => {
        if (
          item.product.id === productId &&
          item.selectedVariantId === variantId
        ) {
          const clamped = Math.min(item.product.stockQuantity, quantity);
          return { ...item, quantity: clamped };
        }
        return item;
      }),
    }));
  },

  clearCart: () => {
    set({ items: [], couponCode: null, couponDiscountPercent: 0 });
  },

  applyCoupon: (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (normalized === "FRESH10") {
      set({ couponCode: "FRESH10", couponDiscountPercent: 10 });
      return true;
    }
    return false;
  },

  removeCoupon: () => {
    set({ couponCode: null, couponDiscountPercent: 0 });
  },

  getItemQuantity: (productId: string) => {
    const item = get().items.find((i) => i.product.id === productId);
    return item ? item.quantity : 0;
  },

  getTotals: () => {
    const state = get();
    let subtotalMinor: MinorUnits = 0;
    let totalCount = 0;

    for (const item of state.items) {
      const lineMinor = multiplyMinor(item.product.priceMinor, item.quantity);
      subtotalMinor = addMinor(subtotalMinor, lineMinor);
      totalCount += item.quantity;
    }

    // Savings from coupon
    const discountMinor =
      state.couponDiscountPercent > 0
        ? percentOfMinor(subtotalMinor, state.couponDiscountPercent)
        : 0;

    // Free delivery check
    const hasFreeDelivery =
      subtotalMinor >= FREE_DELIVERY_THRESHOLD_MINOR || subtotalMinor === 0;
    const freeDeliveryRemainingMinor = Math.max(
      0,
      FREE_DELIVERY_THRESHOLD_MINOR - subtotalMinor,
    );
    const deliveryFeeMinor: MinorUnits =
      subtotalMinor === 0 ? 0 : hasFreeDelivery ? 0 : STANDARD_DELIVERY_FEE_MINOR;

    // 14% Egyptian VAT estimate on discounted subtotal
    const discountedBase = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = percentOfMinor(discountedBase, 14);

    const calculated = computeOrderTotals({
      subtotalMinor,
      discountMinor,
      deliveryFeeMinor,
      taxMinor,
    });

    const totalMinor: MinorUnits = calculated ? calculated.totalMinor : 0;

    return {
      subtotalMinor,
      discountMinor,
      deliveryFeeMinor,
      taxMinor,
      totalMinor,
      totalCount,
      freeDeliveryRemainingMinor,
      hasFreeDelivery,
    };
  },
}));
