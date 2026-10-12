import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { nowArg, recordAudit } from "../lib/catalog";
import { commitStockForLines, loadOrderLines, releaseReservationForLines } from "../lib/inventory";
import {
  assertTransition,
  ORDER_STATUS_ADJACENCY,
  parseOrderStatus,
  type OrderStatus,
} from "../lib/orderStatus";

/**
 * Admin order fulfilment.
 *
 * Status changes are the single place an order moves, and they are validated
 * against `ORDER_STATUS_ADJACENCY` (lib/orderStatus.ts) rather than against a
 * pile of `if` statements. Every accepted transition is audited in the same
 * transaction as the status patch, so the audit trail cannot disagree with the
 * order it describes.
 *
 * Inventory side effects:
 *   - `→ out_for_delivery` writes exactly one `commit` movement per line.
 *   - `→ cancelled`       releases the reservation exactly once per line.
 *
 * Customer-initiated cancellation is a separate public function (`cancelOrder`)
 * with the same exactly-once guarantee; both go through lib/inventory.ts, so
 * the two paths cannot drift apart.
 */
export const transitionOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    to: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const now = nowArg(args.now);
    const to = parseOrderStatus(args.to);

    const order = await ctx.db.get(args.orderId);
    if (order === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found." });
    }

    const from = order.status;

    // A retried request must not be an error. Report the state it already has.
    if (from === to) {
      return { orderId: order._id, from, to, changed: false };
    }

    // Rejects every illegal edge, including any regression and every skip.
    assertTransition(from, to);

    const lines = await loadOrderLines(ctx, args.orderId);
    const movement = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      now,
      actorSubject: actor,
    };

    const committedLines =
      to === "out_for_delivery" ? await commitStockForLines(ctx, lines, movement) : 0;

    const releasedLines =
      to === "cancelled" ? await releaseReservationForLines(ctx, lines, movement) : 0;

    await ctx.db.patch(args.orderId, {
      status: to,
      updatedAt: now,
      ...(to === "cancelled" ? { cancelledAt: now } : {}),
      // Cash on delivery carries no prepayment. Marking it authorized at
      // dispatch records that the courier is collecting; the order screen then
      // shows the real state instead of an order that looks permanently unpaid.
      ...(to === "out_for_delivery" && order.paymentMethod === "cod"
        ? { paymentStatus: "authorized" as const }
        : {}),
    });

    await recordAudit(ctx, {
      actorSubject: actor,
      action: `order.status.${from}->${to}`,
      entity: "orders",
      entityId: args.orderId,
      before: { status: from, paymentStatus: order.paymentStatus },
      after: { status: to, committedLines, releasedLines },
      now,
    });

    return { orderId: order._id, from, to, changed: true, committedLines, releasedLines };
  },
});

/**
 * The transitions an order currently permits.
 *
 * Exposed so the admin UI renders only the actions the server will accept.
 * This is a usability affordance, not authorization: `transitionOrderStatus`
 * re-validates every request independently.
 */
export const listAllowedTransitions = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (order === null) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Order not found." });
    }
    const status = order.status as OrderStatus;
    return { status, allowed: ORDER_STATUS_ADJACENCY[status] };
  },
});