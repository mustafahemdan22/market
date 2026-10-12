import { ConvexError } from "convex/values";

/**
 * Order status state machine.
 *
 * `DATA_MODEL.md` §3.11.4 describes the states but leaves the adjacency to the
 * implementation. It is spelled out here as data, not as branching logic, so
 * there is exactly one place where "can this order move from X to Y" is
 * answered. A status transition that is not a key in this map is not a legal
 * operation, regardless of what a caller asks for.
 *
 * Two structural properties matter and are asserted by tests:
 *
 *  1. `delivered` and `cancelled` are terminal — no key lists them as a source.
 *     Status can never regress, and a late webhook cannot resurrect a closed
 *     order.
 *  2. `pending_payment → confirmed` is the only way in. There is no
 *     `confirmed → pending_payment` and no skip from `confirmed` straight to
 *     `out_for_delivery`, so the reservation lifecycle always runs in order.
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_SET: ReadonlySet<string> = new Set(ORDER_STATUSES);

export const ORDER_STATUS_ADJACENCY: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

/** Narrow an untrusted value (e.g. a string arriving from a client). */
export function parseOrderStatus(value: unknown): OrderStatus {
  if (typeof value !== "string" || !ORDER_STATUS_SET.has(value)) {
    throw new ConvexError({
      code: "INVALID_STATUS",
      message: `status must be one of: ${ORDER_STATUSES.join(", ")}.`,
    });
  }
  return value as OrderStatus;
}

/** True when the transition is declared in the adjacency map above. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_ADJACENCY[from].includes(to);
}

/** A terminal status can never move again. */
export function isTerminal(status: OrderStatus): boolean {
  return ORDER_STATUS_ADJACENCY[status].length === 0;
}

/**
 * Assert a transition, or fail with a code the UI can branch on.
 *
 * A same-status call is treated as a no-op by the caller (it returns the
 * existing state) rather than an error, so a retried request is not punished
 * for arriving twice.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new ConvexError({
      code: "INVALID_TRANSITION",
      message: `Cannot move an order from "${from}" to "${to}".`,
    });
  }
}

/**
 * Statuses a customer may still cancel from. Mirrors `cancelOrder`; kept next
 * to the adjacency map so the two can never drift apart.
 */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ["pending_payment", "confirmed"];