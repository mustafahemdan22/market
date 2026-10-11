import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * PUBLIC customer-facing catalogue.
 *
 * These queries are deliberately NOT admin-guarded: the storefront is
 * browsable without an account. They expose only ACTIVE products and only
 * customer-safe fields — no cost basis, no internal ids beyond the Convex
 * document id, no audit data, no creator identity.
 *
 * Prices are read from the product's display cache, which the backend
 * recomputes from the cheapest active variant on every price change.
 */

const MAX_PAGE = 60;

interface CatalogBase {
  _id: Id<"products">;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  brand: string | undefined;
  unitLabel: string;
  priceMinor: number;
  compareAtPriceMinor: number | undefined;
  categoryId: Id<"categories">;
  categorySlug: string;
}

interface CatalogProduct extends CatalogBase {
  imagePublicId: string | null;
  available: boolean;
}

/**
 * Availability is derived, never stored: a product is purchasable when at
 * least one of its active variants has onHand > reserved.
 */
async function decorate(
  ctx: { db: QueryCtx["db"] },
  products: CatalogBase[],
): Promise<CatalogProduct[]> {
  return Promise.all(
    products.map(async (product) => {
      const variants = await ctx.db
        .query("productVariants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();

      const activeVariants = variants.filter((variant) => variant.isActive);

      const levels = await Promise.all(
        activeVariants.map((variant) =>
          ctx.db
            .query("inventoryLevels")
            .withIndex("by_variant", (q) => q.eq("variantId", variant._id))
            .unique(),
        ),
      );

      const available = levels.some((level) => level !== null && level.onHand - level.reserved > 0);

      const images = await ctx.db
        .query("productImages")
        .withIndex("by_product_primary", (q) => q.eq("productId", product._id))
        .collect();
      const primary = images.find((img) => img.isPrimary) ?? images[0];

      return {
        ...product,
        available,
        imagePublicId: primary?.cloudinaryPublicId ?? null,
      };
    }),
  );
}

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_active_sortOrder", (q) => q.eq("isActive", true))
      .collect();

    categories.sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));

    return Promise.all(
      categories.map(async (category) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_category_status", (q) =>
            q.eq("categoryId", category._id).eq("status", "active"),
          )
          .collect();
        return {
          _id: category._id,
          slug: category.slug,
          nameEn: category.nameEn,
          nameAr: category.nameAr,
          productCount: products.length,
        };
      }),
    );
  },
});

export const listProducts = query({
  args: {
    categorySlug: v.optional(v.string()),
    search: v.optional(v.string()),
    inStockOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 24, 1), MAX_PAGE);

    let products;
    if (args.categorySlug !== undefined) {
      const category = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug!))
        .unique();
      if (category === null) return [];
      products = await ctx.db
        .query("products")
        .withIndex("by_category_status", (q) =>
          q.eq("categoryId", category._id).eq("status", "active"),
        )
        .take(limit * 2);
    } else {
      // `by_category_status` is keyed on categoryId first, so a status-only
      // read must use the status-prefixed index.
      products = await ctx.db
        .query("products")
        .withIndex("by_status_updatedAt", (q) => q.eq("status", "active"))
        .take(limit * 2);
    }

    const search = args.search?.trim().toLowerCase();
    let filtered = products;
    if (search !== undefined && search.length > 0) {
      filtered = products.filter(
        (p) =>
          p.nameEn.toLowerCase().includes(search) ||
          p.nameAr.toLowerCase().includes(search) ||
          (p.brand ?? "").toLowerCase().includes(search),
      );
    }

    const categoryIds = [...new Set(filtered.map((p) => p.categoryId))];
    const categories = await Promise.all(categoryIds.map((id) => ctx.db.get(id)));
    const slugById = new Map(
      categories.filter((c): c is NonNullable<typeof c> => c !== null).map((c) => [c._id, c.slug]),
    );

    const base = filtered.slice(0, limit).map((p) => ({
      _id: p._id,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      descriptionEn: p.descriptionEn,
      descriptionAr: p.descriptionAr,
      brand: p.brand,
      unitLabel: p.unitLabel,
      priceMinor: p.priceMinor,
      compareAtPriceMinor: p.compareAtPriceMinor,
      categoryId: p.categoryId,
      categorySlug: slugById.get(p.categoryId) ?? "",
    }));

    const decorated = await decorate(ctx, base);
    return args.inStockOnly === true
      ? decorated.filter((p) => p.available).slice(0, limit)
      : decorated;
  },
});

export const getProductBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    // Draft and archived products are invisible to the storefront.
    if (product === null || product.status !== "active") return null;

    const category = await ctx.db.get(product.categoryId);
    const [decorated] = await decorate(ctx, [
      {
        _id: product._id,
        slug: product.slug,
        nameEn: product.nameEn,
        nameAr: product.nameAr,
        descriptionEn: product.descriptionEn,
        descriptionAr: product.descriptionAr,
        brand: product.brand,
        unitLabel: product.unitLabel,
        priceMinor: product.priceMinor,
        compareAtPriceMinor: product.compareAtPriceMinor,
        categoryId: product.categoryId,
        categorySlug: category?.slug ?? "",
      },
    ]);
    // decorate() maps one input to exactly one output, so this cannot be empty.
    if (decorated === undefined) return null;

    const variants = await ctx.db
      .query("productVariants")
      .withIndex("by_product", (q) => q.eq("productId", product._id))
      .collect();

    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product_sortOrder", (q) => q.eq("productId", product._id))
      .collect();

    return {
      ...decorated,
      variants: await Promise.all(
        variants
          .filter((variant) => variant.isActive)
          .map(async (variant) => {
            const level = await ctx.db
              .query("inventoryLevels")
              .withIndex("by_variant", (q) => q.eq("variantId", variant._id))
              .unique();
            const available = level === null ? 0 : level.onHand - level.reserved;
            return {
              _id: variant._id,
              nameEn: variant.nameEn,
              nameAr: variant.nameAr,
              sku: variant.sku,
              priceMinor: variant.priceMinor,
              compareAtPriceMinor: variant.compareAtPriceMinor,
              isDefault: variant.isDefault,
              available: Math.max(available, 0),
            };
          }),
      ),
      images: images.map((img) => img.cloudinaryPublicId),
    };
  },
});
