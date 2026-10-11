import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { allocateSlug, nowArg, recomputeProductPriceCache, recordAudit } from "../lib/catalog";
import {
  buildSearchText,
  invalid,
  normaliseSku,
  optionalPriceMinor,
  optionalText,
  requirePriceMinor,
  requireStock,
  requireText,
  slugify,
  MAX_DESCRIPTION_LENGTH,
} from "../lib/validate";

const PRODUCT_STATUSES = ["draft", "active", "archived"] as const;
type ProductStatus = (typeof PRODUCT_STATUSES)[number];

function requireStatus(value: unknown): ProductStatus {
  if (typeof value !== "string" || !PRODUCT_STATUSES.includes(value as ProductStatus)) {
    invalid("status must be one of: draft, active, archived.");
  }
  return value as ProductStatus;
}

/**
 * Create a product together with its first variant and its stock level.
 *
 * All three rows are written in one transaction, so a product can never exist
 * without a sellable variant. The price and stock come from validated arguments
 * and are recomputed/recorded server-side; nothing is taken on trust.
 */
export const createProduct = mutation({
  args: {
    categoryId: v.id("categories"),
    nameEn: v.string(),
    nameAr: v.string(),
    descriptionEn: v.string(),
    descriptionAr: v.string(),
    brand: v.optional(v.string()),
    unitLabel: v.string(),
    status: v.optional(v.string()),
    // First variant
    sku: v.string(),
    variantNameEn: v.string(),
    variantNameAr: v.string(),
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),
    stock: v.number(),
    tags: v.optional(v.array(v.string())),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const nameEn = requireText(args.nameEn, "English name");
    const nameAr = requireText(args.nameAr, "Arabic name");
    const descriptionEn = requireText(
      args.descriptionEn,
      "English description",
      MAX_DESCRIPTION_LENGTH,
    );
    const descriptionAr = requireText(
      args.descriptionAr,
      "Arabic description",
      MAX_DESCRIPTION_LENGTH,
    );
    const unitLabel = requireText(args.unitLabel, "Unit label", 64);
    const brand = optionalText(args.brand, "Brand", 128);
    const status = args.status === undefined ? "active" : requireStatus(args.status);

    const sku = normaliseSku(args.sku);
    const priceMinor = requirePriceMinor(args.priceMinor);
    const compareAtPriceMinor = optionalPriceMinor(args.compareAtPriceMinor);
    const stock = requireStock(args.stock);

    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      invalid("The selected category does not exist.");
    }
    if (!category.isActive) {
      invalid("The selected category is disabled.");
    }

    const duplicateSku = await ctx.db
      .query("productVariants")
      .withIndex("by_sku", (q) => q.eq("sku", sku))
      .unique();
    if (duplicateSku !== null) {
      throw new ConvexError({
        code: "DUPLICATE_SKU",
        message: "A variant with this SKU already exists.",
      });
    }

    const slug = await allocateSlug(ctx, "products", slugify(nameEn));
    const searchText = buildSearchText({
      nameEn,
      nameAr,
      brand,
      categoryNameEn: category.nameEn,
      categoryNameAr: category.nameAr,
    });

    const productId = await ctx.db.insert("products", {
      categoryId: args.categoryId,
      nameEn,
      nameAr,
      descriptionEn,
      descriptionAr,
      slug,
      priceMinor,
      unitLabel,
      status,
      searchText,
      createdBySubject: actor,
      updatedBySubject: actor,
      createdAt: now,
      updatedAt: now,
      ...(brand === undefined ? {} : { brand }),
      ...(compareAtPriceMinor === undefined ? {} : { compareAtPriceMinor }),
      ...(args.tags === undefined ? {} : { tags: args.tags }),
    });

    const variantId = await ctx.db.insert("productVariants", {
      productId,
      sku,
      nameEn: requireText(args.variantNameEn, "Variant name", 64),
      nameAr: requireText(args.variantNameAr, "Variant name (Arabic)", 64),
      priceMinor,
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      updatedBySubject: actor,
      ...(compareAtPriceMinor === undefined ? {} : { compareAtPriceMinor }),
    });

    await ctx.db.insert("inventoryLevels", {
      variantId,
      onHand: stock,
      reserved: 0,
      updatedAt: now,
    });

    await ctx.db.insert("inventoryMovements", {
      variantId,
      productId,
      onHandDelta: stock,
      reservedDelta: 0,
      reason: "restock",
      actorSubject: actor,
      note: "Initial stock on product creation",
      createdAt: now,
    });

    await recomputeProductPriceCache(ctx, productId);

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.create",
      entity: "products",
      entityId: productId,
      after: { nameEn, sku, priceMinor, stock, status },
      now,
    });

    return { productId, variantId };
  },
});

/** Edit product content fields. Does not touch price, stock, or status. */
export const updateProduct = mutation({
  args: {
    productId: v.id("products"),
    nameEn: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    descriptionEn: v.optional(v.string()),
    descriptionAr: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    brand: v.optional(v.string()),
    unitLabel: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const product = await ctx.db.get(args.productId);
    if (product === null)
      throw new ConvexError({ code: "NOT_FOUND", message: "Product not found." });

    if (args.categoryId !== undefined) {
      const category = await ctx.db.get(args.categoryId);
      if (category === null) invalid("The selected category does not exist.");
    }

    const nameEn =
      args.nameEn === undefined ? product.nameEn : requireText(args.nameEn, "English name");
    const nameAr =
      args.nameAr === undefined ? product.nameAr : requireText(args.nameAr, "Arabic name");
    const descriptionEn =
      args.descriptionEn === undefined
        ? product.descriptionEn
        : requireText(args.descriptionEn, "English description", MAX_DESCRIPTION_LENGTH);
    const descriptionAr =
      args.descriptionAr === undefined
        ? product.descriptionAr
        : requireText(args.descriptionAr, "Arabic description", MAX_DESCRIPTION_LENGTH);
    const brand = args.brand === undefined ? product.brand : optionalText(args.brand, "Brand", 128);
    const unitLabel =
      args.unitLabel === undefined
        ? product.unitLabel
        : requireText(args.unitLabel, "Unit label", 64);
    const categoryId = args.categoryId ?? product.categoryId;

    const category = await ctx.db.get(categoryId);
    const searchText = buildSearchText({
      nameEn,
      nameAr,
      brand,
      categoryNameEn: category?.nameEn,
      categoryNameAr: category?.nameAr,
    });

    await ctx.db.patch(args.productId, {
      nameEn,
      nameAr,
      descriptionEn,
      descriptionAr,
      brand,
      unitLabel,
      categoryId,
      searchText,
      updatedBySubject: actor,
      updatedAt: now,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.update",
      entity: "products",
      entityId: args.productId,
      before: {
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        categoryId: product.categoryId,
      },
      after: { nameEn, nameAr, categoryId },
      now,
    });

    return { productId: args.productId };
  },
});

/**
 * Reprice a variant and recompute the product's display cache.
 *
 * The variant price is the authoritative value; the product cache is derived.
 * Writing products.priceMinor directly would leave checkout charging a
 * different number than the dashboard displays.
 */
export const updateProductPrice = mutation({
  args: {
    variantId: v.id("productVariants"),
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const variant = await ctx.db.get(args.variantId);
    if (variant === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Variant not found." });
    }

    const priceMinor = requirePriceMinor(args.priceMinor);
    const compareAtPriceMinor = optionalPriceMinor(args.compareAtPriceMinor);

    if (compareAtPriceMinor !== undefined && compareAtPriceMinor <= priceMinor) {
      invalid("Compare-at price must be greater than the selling price.");
    }

    await ctx.db.patch(args.variantId, {
      priceMinor,
      updatedAt: now,
      updatedBySubject: actor,
      ...(compareAtPriceMinor === undefined ? {} : { compareAtPriceMinor }),
    });

    const productPrice = await recomputeProductPriceCache(ctx, variant.productId);

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.price.update",
      entity: "productVariants",
      entityId: args.variantId,
      before: { priceMinor: variant.priceMinor },
      after: { priceMinor, productPriceMinor: productPrice },
      now,
    });

    return { productId: variant.productId, priceMinor, productPriceMinor: productPrice };
  },
});

/**
 * Adjust stock for a variant.
 *
 * `onHand` is set to an absolute value and the difference is written as an
 * append-only movement row in the SAME transaction, so the level and the
 * ledger can never drift. `available` (onHand - reserved) is never stored and
 * never accepted as input.
 */
export const updateProductStock = mutation({
  args: {
    variantId: v.id("productVariants"),
    onHand: v.number(),
    reason: v.optional(v.string()),
    note: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const variant = await ctx.db.get(args.variantId);
    if (variant === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Variant not found." });
    }

    const requested = requireStock(args.onHand, "Stock on hand");

    const level = await ctx.db
      .query("inventoryLevels")
      .withIndex("by_variant", (q) => q.eq("variantId", args.variantId))
      .unique();

    if (level === null) {
      throw new ConvexError({
        code: "NO_INVENTORY_LEVEL",
        message: "This variant has no inventory level row.",
      });
    }

    // Reserved units are already committed to open orders and cannot be
    // silently destroyed by a stock edit.
    if (requested < level.reserved) {
      invalid(
        `Stock on hand cannot be lower than the ${level.reserved} unit(s) already reserved for open orders.`,
      );
    }

    const delta = requested - level.onHand;

    await ctx.db.patch(level._id, { onHand: requested, updatedAt: now });

    if (delta !== 0) {
      const note = optionalText(args.note, "Note", MAX_DESCRIPTION_LENGTH);
      await ctx.db.insert("inventoryMovements", {
        variantId: args.variantId,
        productId: variant.productId,
        onHandDelta: delta,
        reservedDelta: 0,
        reason:
          args.reason === "damaged" || args.reason === "return" || args.reason === "restock"
            ? args.reason
            : "adjustment",
        actorSubject: actor,
        createdAt: now,
        ...(note === undefined ? {} : { note }),
      });
    }

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.stock.update",
      entity: "productVariants",
      entityId: args.variantId,
      before: { onHand: level.onHand, reserved: level.reserved },
      after: { onHand: requested, reserved: level.reserved },
      now,
    });

    return {
      variantId: args.variantId,
      onHand: requested,
      reserved: level.reserved,
      available: requested - level.reserved,
    };
  },
});

/** Enable / disable / archive a product. */
export const updateProductStatus = mutation({
  args: {
    productId: v.id("products"),
    status: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const product = await ctx.db.get(args.productId);
    if (product === null)
      throw new ConvexError({ code: "NOT_FOUND", message: "Product not found." });

    const status = requireStatus(args.status);
    if (status === product.status) {
      return { productId: args.productId, status };
    }

    await ctx.db.patch(args.productId, {
      status,
      updatedBySubject: actor,
      updatedAt: now,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "product.status.update",
      entity: "products",
      entityId: args.productId,
      before: { status: product.status },
      after: { status },
      now,
    });

    return { productId: args.productId, status };
  },
});

/** Admin product list with search and filters. Admin-only. */
export const listProducts = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const status = args.status === undefined ? undefined : requireStatus(args.status);
    const categoryId = args.categoryId;

    // Rows pulled from the index before any in-memory narrowing. Keeps the read
    // bounded when a filter is applied that is not the index's prefix field.
    const SCAN_CAP = 200;
    const IMAGES_PER_PRODUCT = 10;

    let rows;
    if (categoryId !== undefined) {
      rows = await ctx.db
        .query("products")
        .withIndex("by_category_status", (q) => q.eq("categoryId", categoryId))
        .take(SCAN_CAP);
      if (status !== undefined) {
        rows = rows.filter((p) => p.status === status);
      }
    } else if (status !== undefined) {
      rows = await ctx.db
        .query("products")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", status))
        .take(SCAN_CAP);
    } else {
      rows = await ctx.db
        .query("products")
        .withIndex("by_updatedAt", (q) => q)
        .take(SCAN_CAP);
    }

    const search = args.search?.trim().toLowerCase();
    const filtered =
      search === undefined || search.length === 0
        ? rows
        : rows.filter(
            (p) =>
              p.nameEn.toLowerCase().includes(search) ||
              p.nameAr.toLowerCase().includes(search) ||
              p.slug.includes(search),
          );

    const products = filtered.slice(0, limit);

    const images = await Promise.all(
      products.map(async (p) => {
        const candidates = await ctx.db
          .query("productImages")
          .withIndex("by_product_primary", (q) => q.eq("productId", p._id))
          .take(IMAGES_PER_PRODUCT);
        return candidates.find((img) => img.isPrimary) ?? null;
      }),
    );

    return products.map((product, index) => ({
      _id: product._id,
      slug: product.slug,
      nameEn: product.nameEn,
      nameAr: product.nameAr,
      priceMinor: product.priceMinor,
      unitLabel: product.unitLabel,
      status: product.status,
      updatedAt: product.updatedAt,
      categoryId: product.categoryId,
      imagePublicId: images[index]?.cloudinaryPublicId ?? null,
    }));
  },
});
