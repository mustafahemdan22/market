import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { allocateSlug, nowArg, recordAudit } from "../lib/catalog";
import { invalid, requireText, slugify } from "../lib/validate";

/** Categories are listed newest-last by sort order, then name. */
export const listCategories = query({
  args: {
    includeDisabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // `by_active_sortOrder` is the only index that guarantees a bounded read
    // here; when disabled categories are requested we widen by collecting, which
    // is acceptable because category count is small and admin-bounded.
    const categories = args.includeDisabled
      ? await ctx.db.query("categories").collect()
      : await ctx.db
          .query("categories")
          .withIndex("by_active_sortOrder", (q) => q.eq("isActive", true))
          .collect();

    categories.sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));

    const counts = await Promise.all(
      categories.map((c) =>
        ctx.db
          .query("products")
          .withIndex("by_category_status", (q) => q.eq("categoryId", c._id))
          .collect(),
      ),
    );

    return categories.map((category, index) => ({
      _id: category._id,
      slug: category.slug,
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      productCount: counts[index]?.length ?? 0,
    }));
  },
});

export const createCategory = mutation({
  args: {
    nameEn: v.string(),
    nameAr: v.string(),
    sortOrder: v.optional(v.number()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const nameEn = requireText(args.nameEn, "English name");
    const nameAr = requireText(args.nameAr, "Arabic name");
    const sortOrder = args.sortOrder ?? 0;

    if (!Number.isInteger(sortOrder)) invalid("Sort order must be a whole number.");

    const slug = await allocateSlug(ctx, "categories", slugify(nameEn));

    const categoryId = await ctx.db.insert("categories", {
      nameEn,
      nameAr,
      slug,
      depth: 0,
      sortOrder,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      updatedBySubject: actor,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "category.create",
      entity: "categories",
      entityId: categoryId,
      after: { nameEn, nameAr, slug },
      now,
    });

    return { categoryId };
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("categories"),
    nameEn: v.optional(v.string()),
    nameAr: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    const nameEn =
      args.nameEn === undefined ? category.nameEn : requireText(args.nameEn, "English name");
    const nameAr =
      args.nameAr === undefined ? category.nameAr : requireText(args.nameAr, "Arabic name");
    const sortOrder = args.sortOrder ?? category.sortOrder;

    if (!Number.isInteger(sortOrder)) invalid("Sort order must be a whole number.");

    await ctx.db.patch(args.categoryId, {
      nameEn,
      nameAr,
      sortOrder,
      updatedAt: now,
      updatedBySubject: actor,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "category.update",
      entity: "categories",
      entityId: args.categoryId,
      before: { nameEn: category.nameEn, nameAr: category.nameAr },
      after: { nameEn, nameAr, sortOrder },
      now,
    });

    return { categoryId: args.categoryId };
  },
});

/**
 * Disable a category.
 *
 * Categories are never hard-deleted: products reference them and historical
 * order items snapshot their category, so deleting would orphan live records.
 * Disabling hides the category from new products while leaving existing
 * products readable.
 */
export const setCategoryActive = mutation({
  args: {
    categoryId: v.id("categories"),
    isActive: v.boolean(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);

    const category = await ctx.db.get(args.categoryId);
    if (category === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_category_status", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    // Removing the category while live products still reference it would
    // orphan them. Force the operator to move or archive those products first.
    if (!args.isActive && products.some((p) => p.status === "active")) {
      throw new ConvexError({
        code: "CATEGORY_HAS_ACTIVE_PRODUCTS",
        message: `Cannot disable this category: ${products.filter((p) => p.status === "active").length} active product(s) still use it. Archive or move them first.`,
      });
    }

    await ctx.db.patch(args.categoryId, {
      isActive: args.isActive,
      updatedAt: now,
      updatedBySubject: actor,
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: "category.active.update",
      entity: "categories",
      entityId: args.categoryId,
      before: { isActive: category.isActive },
      after: { isActive: args.isActive },
      now,
    });

    return { categoryId: args.categoryId, isActive: args.isActive };
  },
});
