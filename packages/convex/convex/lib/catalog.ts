import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Catalog data helpers shared by the admin mutations.
 *
 * UNQUIQUENESS NOTE
 * -----------------
 * Convex indexes do NOT enforce uniqueness; they only guarantee the index NAME
 * is unique. The guarantee below comes from reading the exact index range and
 * writing into it inside the SAME mutation, so a conflicting concurrent
 * transaction aborts with OCC, retries, and observes the committed row.
 * Splitting the read and the write across functions would reintroduce the race.
 */

/**
 * Allocate a slug for `table`, appending -2, -3 … until a free one is found.
 * The scan reads the `by_slug` index range that the insert will write to.
 */
export async function allocateSlug(
  ctx: MutationCtx,
  table: "products" | "categories",
  base: string,
  excludeId?: string,
): Promise<string> {
  let candidate = base;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const existing = await ctx.db
      .query(table)
      .withIndex("by_slug", (q) => q.eq("slug", candidate))
      .unique();

    if (existing === null || existing._id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${attempt + 2}`;
  }

  throw new ConvexError({
    code: "SLUG_EXHAUSTED",
    message: "Could not allocate a unique slug for this name.",
  });
}

/**
 * Recompute the product's display price from its cheapest ACTIVE variant.
 *
 * `products.priceMinor` is a cache. It must never drift from the variants that
 * checkout actually charges, so every price-affecting mutation calls this.
 */
export async function recomputeProductPriceCache(
  ctx: MutationCtx,
  productId: Id<"products">,
): Promise<number> {
  const variants = await ctx.db
    .query("productVariants")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();

  const active = variants.filter((variant) => variant.isActive);
  if (active.length === 0) {
    throw new ConvexError({
      code: "NO_ACTIVE_VARIANT",
      message: "A product must have at least one active variant to hold a price.",
    });
  }

  const cheapest = active.reduce((min, v) => (v.priceMinor < min ? v.priceMinor : min), Infinity);

  await ctx.db.patch(productId, { priceMinor: cheapest });
  return cheapest === Infinity ? 0 : cheapest;
}

/** Write an audit row. Always in the same transaction as the change itself. */
export async function recordAudit(
  ctx: MutationCtx,
  entry: {
    actorSubject: string;
    action: string;
    entity: string;
    entityId: string;
    before?: Record<string, unknown> | undefined;
    after?: Record<string, unknown> | undefined;
    now: number;
  },
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    actorSubject: entry.actorSubject,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    ...(entry.before === undefined ? {} : { before: JSON.stringify(entry.before) }),
    ...(entry.after === undefined ? {} : { after: JSON.stringify(entry.after) }),
    createdAt: entry.now,
  });
}

/**
 * `Date.now()` is not permitted inside a Convex mutation (transactions must be
 * deterministic), so callers pass `now` down from the invocation site.
 */
export function nowArg(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "now must be a number." });
  }
  return Math.floor(value);
}
