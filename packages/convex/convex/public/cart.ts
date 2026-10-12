import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ensureCustomer, getCustomerId, requireCustomerId } from "../lib/customer";
import { nowArg } from "../lib/catalog";
import { invalid, MAX_STOCK_UNITS, requireStock } from "../lib/validate";

const EMPTY_CART = { items: [], subtotalMinor: 0, itemCount: 0 } as const;

/**
 * Customer cart.
 *
 * No price is stored on a cart line. The cart joins to productVariants for
 * display and re-reads everything inside the checkout transaction, so a stale
 * or tampered client value can never influence an order total.
 *
 * Carts hold NO stock reservation (DATA_MODEL.md §3.6.4). Stock is committed
 * only at placeOrder.
 */

/** Get (or create) the caller's cart and return its id. */
async function getOrCreateCartId(
  ctx: MutationCtx,
  customerId: Id<"customers">,
  now: number,
): Promise<Id<"carts">> {
  const existing = await ctx.db
    .query("carts")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .unique();
  if (existing !== null) return existing._id;

  // Read-then-insert inside one mutation: the index range read is recorded, so
  // two concurrent "first add" calls conflict and retry rather than both
  // creating a cart.
  return ctx.db.insert("carts", { customerId, updatedAt: now });
}

export const getCart = query({
  args: {},
  handler: async (ctx) => {
    // `getCustomerId`, not `requireCustomerId`: a brand-new signed-in customer
    // has no row yet, and "your cart is empty" is the truthful answer. Throwing
    // a provisioning error would show a new shopper an error screen for a cart
    // that genuinely does not exist. Writes create the row.
    const customerId = await getCustomerId(ctx);
    if (customerId === null) return EMPTY_CART;

    const cart = await ctx.db
      .query("carts")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .unique();
    if (cart === null) return EMPTY_CART;

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();

    const decorated = await Promise.all(
      items.map(async (item) => {
        const variant = await ctx.db.get(item.variantId);
        const product = variant === null ? null : await ctx.db.get(variant.productId);
        const level =
          variant === null
            ? null
            : await ctx.db
                .query("inventoryLevels")
                .withIndex("by_variant", (q) => q.eq("variantId", variant._id))
                .unique();

        const available = level === null ? 0 : Math.max(level.onHand - level.reserved, 0);

        return {
          _id: item._id,
          variantId: item.variantId,
          productId: variant?.productId ?? null,
          slug: product?.slug ?? "",
          nameEn: product?.nameEn ?? "",
          nameAr: product?.nameAr ?? "",
          unitLabel: product?.unitLabel ?? "",
          variantNameEn: variant?.nameEn ?? "",
          variantNameAr: variant?.nameAr ?? "",
          priceMinor: variant?.priceMinor ?? 0,
          quantity: item.quantity,
          available,
          // Surfaced, never silently dropped: the customer must understand
          // why checkout will fail.
          issue:
            product === null || product.status !== "active"
              ? "unavailable"
              : variant === null || !variant.isActive
                ? "unavailable"
                : available <= 0
                  ? "out_of_stock"
                  : available < item.quantity
                    ? "insufficient_stock"
                    : null,
        };
      }),
    );

    // Only sellable lines contribute to the preview subtotal. Checkout
    // recomputes everything from the variant regardless.
    const subtotalMinor = decorated
      .filter((line) => line.issue === null)
      .reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);

    return {
      items: decorated,
      subtotalMinor,
      itemCount: decorated.reduce((n, line) => n + line.quantity, 0),
    };
  },
});

export const addToCart = mutation({
  args: {
    variantId: v.id("productVariants"),
    quantity: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const quantity = requireStock(args.quantity, "Quantity");
    if (quantity < 1) invalid("Quantity must be at least 1.");
    if (quantity > MAX_STOCK_UNITS) invalid("Quantity exceeds the maximum allowed.");

    const customerId = await ensureCustomer(ctx, { now });
    const cartId = await getOrCreateCartId(ctx, customerId, now);

    const variant = await ctx.db.get(args.variantId);
    if (variant === null || !variant.isActive) {
      throw new ConvexError({
        code: "VARIANT_UNAVAILABLE",
        message: "This option is not available.",
      });
    }

    // Read the exact index range we will write to, so a double-tap cannot
    // create two lines for the same variant.
    const existing = await ctx.db
      .query("cartItems")
      .withIndex("by_cart_variant", (q) => q.eq("cartId", cartId).eq("variantId", args.variantId))
      .unique();

    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        quantity: Math.min(existing.quantity + quantity, MAX_STOCK_UNITS),
        updatedAt: now,
      });
      await ctx.db.patch(cartId, { updatedAt: now });
      return { cartId, itemId: existing._id };
    }

    const itemId = await ctx.db.insert("cartItems", {
      cartId,
      variantId: args.variantId,
      quantity,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(cartId, { updatedAt: now });
    return { cartId, itemId };
  },
});

export const updateCartItem = mutation({
  args: {
    itemId: v.id("cartItems"),
    quantity: v.number(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const quantity = requireStock(args.quantity, "Quantity");
    if (quantity > MAX_STOCK_UNITS) invalid("Quantity exceeds the maximum allowed.");

    const customerId = await requireCustomerId(ctx);
    const item = await ctx.db.get(args.itemId);
    if (item === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Cart item not found." });
    }

    // Ownership: the cart must belong to the caller. Never trust the item id alone.
    const cart = await ctx.db.get(item.cartId);
    if (cart === null || cart.customerId !== customerId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You do not have access to this cart." });
    }

    if (quantity === 0) {
      await ctx.db.delete(args.itemId);
      await ctx.db.patch(cart._id, { updatedAt: now });
      return { removed: true };
    }

    await ctx.db.patch(args.itemId, { quantity, updatedAt: now });
    await ctx.db.patch(cart._id, { updatedAt: now });
    return { removed: false };
  },
});

export const removeCartItem = mutation({
  args: {
    itemId: v.id("cartItems"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const customerId = await requireCustomerId(ctx);

    const item = await ctx.db.get(args.itemId);
    if (item === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Cart item not found." });
    }
    const cart = await ctx.db.get(item.cartId);
    if (cart === null || cart.customerId !== customerId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You do not have access to this cart." });
    }

    await ctx.db.delete(args.itemId);
    await ctx.db.patch(cart._id, { updatedAt: now });
    return { removed: true };
  },
});

export const clearCart = mutation({
  args: { now: v.number() },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const customerId = await requireCustomerId(ctx);

    const cart = await ctx.db
      .query("carts")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .unique();
    if (cart === null) return { removed: 0 };

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.patch(cart._id, { updatedAt: now });
    return { removed: items.length };
  },
});
