import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireCustomerId, ensureCustomer } from "../lib/customer";
import { nowArg } from "../lib/catalog";
import { invalid, requireText } from "../lib/validate";

/**
 * Customer orders and checkout.
 *
 * THE SERVER IS THE ONLY AUTHORITY for money and stock. No client-supplied
 * price, total, discount or stock figure is read anywhere below; every number
 * is recomputed from productVariants inside this single serializable
 * transaction.
 *
 * VAT is INCLUDED in the displayed shelf price (business rule), so there is no
 * separate tax line and `totalMinor` is simply subtotal + delivery.
 */

const CURRENCY = "EGP";
const FREE_DELIVERY_THRESHOLD_MINOR = 50_000; // EGP 500.00
const DELIVERY_FEE_MINOR = 5_000; // EGP 50.00

interface Shipping {
  name: string;
  phone: string;
  line1: string;
  line2?: string | undefined;
  city: string;
  region?: string | undefined;
  notes?: string | undefined;
}

function deliveryFeeFor(subtotalMinor: number): number {
  return subtotalMinor >= FREE_DELIVERY_THRESHOLD_MINOR ? 0 : DELIVERY_FEE_MINOR;
}

function dayStamp(now: number): string {
  return new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
}

/**
 * Allocate a human-readable order number from a sharded daily sequence.
 * A single global counter would be a hot document and the classic OCC failure
 * mode; sharding by day bounds contention to one row per day.
 */
async function nextOrderNumber(ctx: MutationCtx, now: number): Promise<string> {
  const day = dayStamp(now);

  // Read then write the same index range in the same mutation.
  const existing = await ctx.db
    .query("orderSequences")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();

  const next = existing === null ? 1 : existing.lastValue + 1;

  if (existing === null) {
    await ctx.db.insert("orderSequences", { day, lastValue: next });
  } else {
    await ctx.db.patch(existing._id, { lastValue: next });
  }

  return `GRC-${day}-${String(next).padStart(4, "0")}`;
}

export const placeOrder = mutation({
  args: {
    idempotencyKey: v.string(),
    paymentMethod: v.union(v.literal("cod"), v.literal("card")),
    shippingName: v.string(),
    shippingPhone: v.string(),
    shippingLine1: v.string(),
    shippingLine2: v.optional(v.string()),
    shippingCity: v.string(),
    shippingRegion: v.optional(v.string()),
    shippingNotes: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const key = requireText(args.idempotencyKey, "Idempotency key", 100);
    const customerId = await ensureCustomer(ctx, { now });

    // --- Idempotency -------------------------------------------------------
    // Scoped per customer. The index range is READ and the order INSERTED in
    // this same transaction, so two concurrent submissions conflict, retry,
    // and the loser returns the committed order instead of creating a second.
    const replay = await ctx.db
      .query("orders")
      .withIndex("by_customer_idempotencyKey", (q) =>
        q.eq("customerId", customerId).eq("idempotencyKey", key),
      )
      .unique();

    if (replay !== null) {
      return { orderId: replay._id, orderNumber: replay.orderNumber, replayed: true };
    }

    // --- Load the cart -----------------------------------------------------
    const cart = await ctx.db
      .query("carts")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .unique();
    if (cart === null) {
      throw new ConvexError({ code: "EMPTY_CART", message: "Your cart is empty." });
    }

    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    if (items.length === 0) {
      throw new ConvexError({ code: "EMPTY_CART", message: "Your cart is empty." });
    }

    // --- Validate every line and recompute every price ----------------------
    interface Line {
      itemId: Id<"cartItems">;
      variantId: Id<"productVariants">;
      productId: Id<"products">;
      levelId: Id<"inventoryLevels">;
      sku: string;
      nameEn: string;
      nameAr: string;
      imagePublicId: string | undefined;
      unitPriceMinor: number;
      quantity: number;
      onHand: number;
      reserved: number;
    }

    const lines: Line[] = [];

    for (const item of items) {
      const variant = await ctx.db.get(item.variantId);
      if (variant === null || !variant.isActive) {
        throw new ConvexError({
          code: "ITEM_UNAVAILABLE",
          message: "An item in your cart is no longer available. Please remove it.",
        });
      }

      const product = await ctx.db.get(variant.productId);
      if (product === null || product.status !== "active") {
        throw new ConvexError({
          code: "ITEM_UNAVAILABLE",
          message: "An item in your cart is no longer available. Please remove it.",
        });
      }

      const level = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", item.variantId))
        .unique();
      if (level === null) {
        throw new ConvexError({
          code: "NO_INVENTORY",
          message: "An item in your cart has no stock record.",
        });
      }

      const available = level.onHand - level.reserved;
      if (available < item.quantity) {
        throw new ConvexError({
          code: "INSUFFICIENT_STOCK",
          message: `Only ${Math.max(available, 0)} left of ${product.nameEn}.`,
        });
      }

      const images = await ctx.db
        .query("productImages")
        .withIndex("by_product_primary", (q) => q.eq("productId", product._id))
        .collect();
      const image = images.find((i) => i.isPrimary) ?? images[0];

      lines.push({
        itemId: item._id,
        variantId: item.variantId,
        productId: product._id,
        levelId: level._id,
        sku: variant.sku,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        imagePublicId: image?.cloudinaryPublicId,
        // Authoritative price. A client-supplied price is never read.
        unitPriceMinor: variant.priceMinor,
        quantity: item.quantity,
        onHand: level.onHand,
        reserved: level.reserved,
      });
    }

    const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0);
    if (subtotalMinor <= 0) invalid("Order total must be greater than zero.");

    const deliveryFeeMinor = deliveryFeeFor(subtotalMinor);
    const totalMinor = subtotalMinor + deliveryFeeMinor;
    if (totalMinor < 0) invalid("Computed order total is invalid.");

    // --- Persist ------------------------------------------------------------
    const orderNumber = await nextOrderNumber(ctx, now);
    const shipping: Shipping = {
      name: requireText(args.shippingName, "Recipient name"),
      phone: requireText(args.shippingPhone, "Phone"),
      line1: requireText(args.shippingLine1, "Address line"),
      city: requireText(args.shippingCity, "City"),
    };

    const orderId = await ctx.db.insert("orders", {
      customerId,
      orderNumber,
      status: "pending_payment",
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentMethod === "cod" ? "unpaid" : "unpaid",
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      shippingLine1: shipping.line1,
      shippingCity: shipping.city,
      subtotalMinor,
      deliveryFeeMinor,
      totalMinor,
      currency: CURRENCY,
      idempotencyKey: key,
      createdAt: now,
      updatedAt: now,
      ...(shipping.line2 === undefined ? {} : { shippingLine2: shipping.line2 }),
      ...(shipping.region === undefined ? {} : { shippingRegion: shipping.region }),
      ...(shipping.notes === undefined ? {} : { shippingNotes: shipping.notes }),
    });

    for (const line of lines) {
      await ctx.db.insert("orderItems", {
        orderId,
        variantId: line.variantId,
        productId: line.productId,
        sku: line.sku,
        nameEn: line.nameEn,
        nameAr: line.nameAr,
        unitPriceMinor: line.unitPriceMinor,
        quantity: line.quantity,
        lineTotalMinor: line.unitPriceMinor * line.quantity,
        ...(line.imagePublicId === undefined ? {} : { imagePublicId: line.imagePublicId }),
      });
    }

    // Reserve stock and ledger it in the SAME transaction, so the level and the
    // ledger can never drift. Re-derived from the values read above, which were
    // themselves read inside this transaction.
    for (const line of lines) {
      const level = await ctx.db.get(line.levelId);
      if (level === null) {
        throw new ConvexError({ code: "NO_INVENTORY", message: "Stock record vanished." });
      }
      await ctx.db.patch(line.levelId, { reserved: level.reserved + line.quantity });

      await ctx.db.insert("inventoryMovements", {
        orderId,
        variantId: line.variantId,
        productId: line.productId,
        onHandDelta: 0,
        reservedDelta: line.quantity,
        reason: "reserve",
        note: `Order ${orderNumber}`,
        createdAt: now,
      });
    }

    for (const line of lines) {
      await ctx.db.delete(line.itemId);
    }
    await ctx.db.patch(cart._id, { updatedAt: now });

    return { orderId, orderNumber, replayed: false, totalMinor };
  },
});

export const listMyOrders = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const customerId = await requireCustomerId(ctx);
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_customer_createdAt", (q) => q.eq("customerId", customerId))
      .take(limit);

    return orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotalMinor: order.subtotalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      itemCount: 0,
      createdAt: order.createdAt,
    }));
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const customerId = await requireCustomerId(ctx);
    const order = await ctx.db.get(args.orderId);

    // Ownership check: a valid id belonging to someone else is still forbidden.
    if (order === null || order.customerId !== customerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found." });
    }

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      shippingName: order.shippingName,
      shippingPhone: order.shippingPhone,
      shippingLine1: order.shippingLine1,
      shippingLine2: order.shippingLine2 ?? null,
      shippingCity: order.shippingCity,
      shippingRegion: order.shippingRegion ?? null,
      shippingNotes: order.shippingNotes ?? null,
      subtotalMinor: order.subtotalMinor,
      deliveryFeeMinor: order.deliveryFeeMinor,
      totalMinor: order.totalMinor,
      currency: order.currency,
      createdAt: order.createdAt,
      items: items.map((item) => ({
        _id: item._id,
        sku: item.sku,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        imagePublicId: item.imagePublicId ?? null,
        unitPriceMinor: item.unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: item.lineTotalMinor,
      })),
    };
  },
});

/**
 * Cancel an order and release its stock reservation exactly once.
 *
 * The release guard reads `by_order_variant_reason`; if a release movement
 * already exists for this (order, variant) the second attempt aborts, retries,
 * sees the movement, and no-ops. Stock can never be released twice.
 */
export const cancelOrder = mutation({
  args: {
    orderId: v.id("orders"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const now = nowArg(args.now);
    const customerId = await requireCustomerId(ctx);
    const order = await ctx.db.get(args.orderId);

    if (order === null || order.customerId !== customerId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found." });
    }

    // Customers may cancel only while the order is still un-dispatched.
    if (order.status === "cancelled") {
      return { orderId: order._id, status: "cancelled" as const, alreadyCancelled: true };
    }
    if (order.status !== "pending_payment" && order.status !== "confirmed") {
      throw new ConvexError({
        code: "INVALID_TRANSITION",
        message: "This order can no longer be cancelled. Please contact support.",
      });
    }

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();

    for (const item of items) {
      // Bind to a const first: narrowing on `item.variantId` does not survive
      // into the closures below.
      const variantId = item.variantId;
      const productId = item.productId;
      if (variantId === undefined) continue;

      const alreadyReleased = await ctx.db
        .query("inventoryMovements")
        .withIndex("by_order_variant_reason", (q) =>
          q.eq("orderId", args.orderId).eq("variantId", variantId).eq("reason", "release"),
        )
        .first();

      if (alreadyReleased !== null) continue;

      const level = await ctx.db
        .query("inventoryLevels")
        .withIndex("by_variant", (q) => q.eq("variantId", variantId))
        .unique();
      if (level === null) continue;

      const release = Math.min(item.quantity, level.reserved);
      if (release > 0) {
        await ctx.db.patch(level._id, { reserved: level.reserved - release });
      }

      await ctx.db.insert("inventoryMovements", {
        orderId: args.orderId,
        variantId,
        onHandDelta: 0,
        reservedDelta: -release,
        reason: "release",
        note: `Order ${order.orderNumber} cancelled`,
        createdAt: now,
        ...(productId === undefined ? {} : { productId }),
      });
    }

    await ctx.db.patch(args.orderId, { status: "cancelled", cancelledAt: now, updatedAt: now });
    return { orderId: order._id, status: "cancelled" as const, alreadyCancelled: false };
  },
});
