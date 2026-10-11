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
    /** Optional: a release must still be ledgered if the product was removed. */
    productId: v.optional(v.id("products")),
    onHandDelta: v.number(),
    reservedDelta: v.number(),
    reason: v.union(
      v.literal("reserve"),
      v.literal("release"),
      v.literal("commit"),
      v.literal("restock"),
      v.literal("adjustment"),
      v.literal("damaged"),
      v.literal("return"),
    ),
    orderId: v.optional(v.id("orders")),
    actorSubject: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_variant_createdAt", ["variantId", "createdAt"])
    .index("by_product_createdAt", ["productId", "createdAt"])
    /**
     * Backs the exactly-once guard: "has a release already been written for
     * this (order, variant)?" answered in a single indexed read, so a
     * cancellation racing another release cannot free the same hold twice.
     */
    .index("by_order_variant_reason", ["orderId", "variantId", "reason"]),

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

  /**
   * A per-user mirror of the Clerk identity. Created on first authenticated
   * write so ownership can be expressed as a document reference rather than a
   * raw subject string. Admin authorization deliberately does NOT depend on
   * this table (see PANDAMA_ADMIN_SUBJECTS in lib/auth.ts).
   */
  customers: defineTable({
    clerkSubject: v.string(),
    email: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  }).index("by_clerkSubject", ["clerkSubject"]),

  /** Exactly one active cart per customer, created lazily on first add. */
  carts: defineTable({
    customerId: v.id("customers"),
    updatedAt: v.number(),
  }).index("by_customer", ["customerId"]),

  /**
   * Cart lines reference a VARIANT, not a product: price and stock both live on
   * the variant, so this is the only level at which a line is meaningful.
   * No price is stored here — the cart joins to productVariants for display and
   * re-reads everything at checkout.
   */
  cartItems: defineTable({
    cartId: v.id("carts"),
    variantId: v.id("productVariants"),
    quantity: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_cart", ["cartId"])
    .index("by_cart_variant", ["cartId", "variantId"]),

  /**
   * Order status is a small explicit state machine; transitions are validated
   * in the mutation against an adjacency map, never accepted from the client.
   */
  orders: defineTable({
    customerId: v.id("customers"),
    orderNumber: v.string(),
    status: v.union(
      v.literal("pending_payment"),
      v.literal("confirmed"),
      v.literal("preparing"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("cancelled"),
    ),
    paymentMethod: v.union(v.literal("cod"), v.literal("card")),
    paymentStatus: v.union(
      v.literal("unpaid"),
      v.literal("authorized"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
    ),

    /** Snapshot: a later address edit must not rewrite a placed order. */
    shippingName: v.string(),
    shippingPhone: v.string(),
    shippingLine1: v.string(),
    shippingLine2: v.optional(v.string()),
    shippingCity: v.string(),
    shippingRegion: v.optional(v.string()),
    shippingNotes: v.optional(v.string()),

    /** All server-computed, integer minor units. Never client-supplied. */
    subtotalMinor: v.number(),
    deliveryFeeMinor: v.number(),
    totalMinor: v.number(),
    currency: v.string(),

    /** Per-customer idempotency scope. Required, not optional. */
    idempotencyKey: v.string(),

    cancelledAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_customer_createdAt", ["customerId", "createdAt"])
    .index("by_status", ["status"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_customer_idempotencyKey", ["customerId", "idempotencyKey"]),

  orderItems: defineTable({
    orderId: v.id("orders"),
    variantId: v.optional(v.id("productVariants")),
    productId: v.optional(v.id("products")),
    /** Snapshots: a past invoice must not change when a product is renamed or repriced. */
    sku: v.string(),
    nameEn: v.string(),
    nameAr: v.string(),
    imagePublicId: v.optional(v.string()),
    unitPriceMinor: v.number(),
    quantity: v.number(),
    lineTotalMinor: v.number(),
  }).index("by_order", ["orderId"]),

  /**
   * Sharded daily order-number sequence. A single global counter would be a hot
   * document and the classic OCC failure mode (see DATA_MODEL.md §3.11.2).
   */
  orderSequences: defineTable({
    day: v.string(),
    lastValue: v.number(),
  }).index("by_day", ["day"]),
});
