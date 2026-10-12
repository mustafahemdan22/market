import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/**
 * Order-driven inventory movements.
 *
 * Both routines here are **exactly-once per (order, variant, reason)**. The
 * guard is the `by_order_variant_reason` index: the range for this exact triple
 * is READ and a row is INSERTed into it inside the same mutation, so a
 * concurrent second attempt conflicts on OCC, retries, observes the committed
 * movement, and no-ops. Stock can therefore never be released or committed
 * twice for one order line, however the two attempts interleave.
 *
 * This is the belt to `placeOrder`'s braces: `assertTransition` already makes
 * a repeated dispatch illegal, but the ledger guard holds even if a second
 * writer arrives through a different code path.
 */

export interface OrderLine {
  readonly variantId: Id<"productVariants"> | undefined;
  readonly productId: Id<"products"> | undefined;
  readonly quantity: number;
}

export interface MovementContext {
  readonly orderId: Id<"orders">;
  readonly orderNumber: string;
  readonly now: number;
  readonly actorSubject?: string | undefined;
}

/** Read an order's lines. The caller supplies them again to the routines below. */
export async function loadOrderLines(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<OrderLine[]> {
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  return items.map((item) => ({
    variantId: item.variantId,
    productId: item.productId,
    quantity: item.quantity,
  }));
}

async function alreadyMoved(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  variantId: Id<"productVariants">,
  reason: "commit" | "release",
): Promise<boolean> {
  const existing = await ctx.db
    .query("inventoryMovements")
    .withIndex("by_order_variant_reason", (q) =>
      q.eq("orderId", orderId).eq("variantId", variantId).eq("reason", reason),
    )
    .first();
  return existing !== null;
}

/**
 * Lift the reservation held for an order: `reserved -= qty`, `onHand` untouched.
 *
 * Used when a confirmed or unpaid order is cancelled. The released amount is
 * clamped to the units actually still reserved, so a level that was already
 * committed (dispatched) is never driven negative.
 */
export async function releaseReservationForLines(
  ctx: MutationCtx,
  lines: readonly OrderLine[],
  args: MovementContext & { readonly note?: string | undefined },
): Promise<number> {
  let releasedLines = 0;

  for (const line of lines) {
    // Bind to consts: narrowing on the optional id does not survive into the
    // closures below.
    const variantId = line.variantId;
    if (variantId === undefined) continue;
    if (await alreadyMoved(ctx, args.orderId, variantId, "release")) continue;

    const level = await ctx.db
      .query("inventoryLevels")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .unique();
    if (level === null) continue;

    const release = Math.min(line.quantity, level.reserved);

    await ctx.db.patch(level._id, {
      reserved: level.reserved - release,
      updatedAt: args.now,
    });

    const productId = line.productId;
    await ctx.db.insert("inventoryMovements", {
      orderId: args.orderId,
      variantId,
      reservedDelta: -release,
      onHandDelta: 0,
      reason: "release",
      note: args.note ?? `Order ${args.orderNumber} reservation released`,
      createdAt: args.now,
      ...(productId === undefined ? {} : { productId }),
      ...(args.actorSubject === undefined ? {} : { actorSubject: args.actorSubject }),
    });

    releasedLines += 1;
  }

  return releasedLines;
}

/**
 * Convert a reservation into a dispatch: `onHand -= qty` AND `reserved -= qty`.
 *
 * `available` (`onHand - reserved`) is deliberately unchanged by a dispatch:
 * the units are physically leaving the shelf and are equally unavailable to
 * new buyers. The movement is what makes the change auditable, which is the
 * point DATA_MODEL.md §3.6 is built around.
 */
export async function commitStockForLines(
  ctx: MutationCtx,
  lines: readonly OrderLine[],
  args: MovementContext & { readonly note?: string | undefined },
): Promise<number> {
  let committedLines = 0;

  for (const line of lines) {
    const variantId = line.variantId;
    if (variantId === undefined) continue;
    if (await alreadyMoved(ctx, args.orderId, variantId, "commit")) continue;

    const level = await ctx.db
      .query("inventoryLevels")
      .withIndex("by_variant", (q) => q.eq("variantId", variantId))
      .unique();
    if (level === null) {
      throw new ConvexError({
        code: "NO_INVENTORY",
        message: "An item on this order has no stock record.",
      });
    }

    // `reserved` is clamped to what is genuinely held. Never let a dispatch
    // write a negative level — a negative level is an invariant violation that
    // should surface, not be silently produced by a fulfilment path.
    const committed = Math.min(line.quantity, level.reserved);

    await ctx.db.patch(level._id, {
      onHand: level.onHand - committed,
      reserved: level.reserved - committed,
      updatedAt: args.now,
    });

    const productId = line.productId;
    await ctx.db.insert("inventoryMovements", {
      orderId: args.orderId,
      variantId,
      onHandDelta: -committed,
      reservedDelta: -committed,
      reason: "commit",
      note: args.note ?? `Order ${args.orderNumber} dispatched`,
      createdAt: args.now,
      ...(productId === undefined ? {} : { productId }),
      ...(args.actorSubject === undefined ? {} : { actorSubject: args.actorSubject }),
    });

    committedLines += 1;
  }

  return committedLines;
}