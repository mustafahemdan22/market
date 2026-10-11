import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Schema — Grocery Marketplace (admin scope)
 *
 * Decisions applied, per explicit user approval:
 *  1. Products carry localized name/description (nameEn/nameAr, descriptionEn/
 *     descriptionAr). This aligns the schema with the already-shipped mobile
 *     `catalogRepository` Product interface, which declares name/nameAr.
 *  2. Stock lives ONLY in `inventoryLevels`, mutated together with an
 *     `inventoryMovements` ledger row. `products` has no stock column.
 *  3. `products.priceMinor` is a DISPLAY CACHE recomputed from the cheapest
 *     active variant. It is never the authoritative price; that is
 *     `productVariants.priceMinor`.
 *  4. Creating a product always creates one default variant (SKU + price +
 *     stock) in the same mutation, because a product with no variant cannot be
 *     priced or stocked.
 *
 * Audit columns `createdBySubject` / `updatedBySubject` store the raw Clerk
 * user id from the verified token rather than a `v.id("users")` reference.
 * Rationale: admin authorization is the PANDAMA_ADMIN_SUBJECTS allowlist keyed
 * on Clerk user ids, so the backend must be able to attribute a write without
 * depending on a provisioned `users` row. (Deviation from DATA_MODEL.md §3.4,
 * which assumes a Clerk webhook populates `users` first.)
 */

export default defineSchema({
  /** Mirror of the Clerk identity. Not required for admin authorization. */
  users: defineTable({
    clerkUserId: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("customer"), v.literal("admin")),
    status: v.union(v.literal("active"), v.literal("suspended")),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_email", ["email"]),

  categories: defineTable({
    nameEn: v.string(),
    nameAr: v.string(),
    slug: v.string(),
    parentId: v.optional(v.id("categories")),
    depth: v.number(),
    sortOrder: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBySubject: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_active_sortOrder", ["isActive", "sortOrder"])
    .index("by_parent_sortOrder", ["parentId", "sortOrder"]),

  products: defineTable({
    categoryId: v.id("categories"),
    nameEn: v.string(),
    nameAr: v.string(),
    descriptionEn: v.string(),
    descriptionAr: v.string(),
    brand: v.optional(v.string()),
    slug: v.string(),

    /**
     * Display cache only. Recomputed from the cheapest active variant inside
     * the same mutation that changes a variant price. Checkout never reads it.
     */
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),

    unitLabel: v.string(),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("archived")),
    searchText: v.string(),
    tags: v.optional(v.array(v.string())),

    createdBySubject: v.optional(v.string()),
    updatedBySubject: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category_status", ["categoryId", "status"])
    .index("by_status_updatedAt", ["status", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"])
    // Required companion index: a searchIndex's first field must match a
    // regular index's first field.
    .index("by_searchText", ["searchText"])
    .searchIndex("search_products", {
      searchField: "searchText",
      filterFields: ["categoryId", "status"],
    }),

  productVariants: defineTable({
    productId: v.id("products"),
    sku: v.string(),
    nameEn: v.string(),
    nameAr: v.string(),
    /** Authoritative price. Always integer minor units (EGP => piastres). */
    priceMinor: v.number(),
    compareAtPriceMinor: v.optional(v.number()),
    weightGrams: v.optional(v.number()),
    isDefault: v.boolean(),
    isActive: v.boolean(),
    sortOrder: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBySubject: v.optional(v.string()),
  })
    .index("by_product", ["productId", "sortOrder"])
    .index("by_sku", ["sku"]),

  /**
   * The ONLY place stock is stored. `available = onHand - reserved` is derived
   * at read time and is never persisted, never accepted from a client.
   */
  inventoryLevels: defineTable({
    variantId: v.id("productVariants"),
    onHand: v.number(),
    reserved: v.number(),
    updatedAt: v.number(),
  }).index("by_variant", ["variantId"]),

  /** Append-only audit ledger. Written in the same transaction as the level. */
  inventoryMovements: defineTable({
    variantId: v.id("productVariants"),
    productId: v.id("products"),
    onHandDelta: v.number(),
    reservedDelta: v.number(),
    reason: v.union(
      v.literal("restock"),
      v.literal("adjustment"),
      v.literal("damaged"),
      v.literal("return"),
    ),
    actorSubject: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_variant_createdAt", ["variantId", "createdAt"])
    .index("by_product_createdAt", ["productId", "createdAt"]),

  /**
   * Only the Cloudinary public id is persisted, never a full delivery URL —
   * clients derive transformation URLs so the CDN shape is not baked into
   * stored data. `format`, `bytes` and `uploadedBySubject` are validated
   * metadata captured at upload time.
   */
  productImages: defineTable({
    productId: v.id("products"),
    cloudinaryPublicId: v.string(),
    format: v.string(),
    width: v.number(),
    height: v.number(),
    bytes: v.number(),
    alt: v.string(),
    sortOrder: v.number(),
    isPrimary: v.boolean(),
    uploadedBySubject: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_product_sortOrder", ["productId", "sortOrder"])
    .index("by_product_primary", ["productId", "isPrimary"]),

  /** Every privileged mutation writes a row here in the same transaction. */
  auditLogs: defineTable({
    actorSubject: v.string(),
    action: v.string(),
    entity: v.string(),
    entityId: v.string(),
    before: v.optional(v.string()),
    after: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_entity_createdAt", ["entity", "createdAt"])
    .index("by_actor_createdAt", ["actorSubject", "createdAt"]),
});
