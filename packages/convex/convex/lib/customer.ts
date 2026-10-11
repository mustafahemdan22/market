import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireUser } from "./auth";

/**
 * Customer identity resolution.
 *
 * A customer row is a local mirror of the Clerk identity, created lazily on the
 * first authenticated write. Reads never create rows (a query must not mutate),
 * so they return null and the caller decides how to handle "not provisioned".
 *
 * This is deliberately NOT the authorization source for admin access — that is
 * the PANDAMA_ADMIN_SUBJECTS allowlist in ./auth.ts.
 */

export type CustomerCtx = Pick<QueryCtx, "db" | "auth"> | Pick<MutationCtx, "db" | "auth">;

export async function getCustomerId(ctx: CustomerCtx): Promise<Id<"customers"> | null> {
  const subject = await requireUser(ctx);
  const row = await ctx.db
    .query("customers")
    .withIndex("by_clerkSubject", (q) => q.eq("clerkSubject", subject))
    .unique();
  return row?._id ?? null;
}

/**
 * Get the customer row, creating it if absent.
 * The index range is read and written inside this one mutation, so two
 * concurrent first-time writes cannot both insert.
 */
export async function ensureCustomer(
  ctx: MutationCtx,
  args: { now: number; email?: string | undefined },
): Promise<Id<"customers">> {
  const subject = await requireUser(ctx);
  const existing = await ctx.db
    .query("customers")
    .withIndex("by_clerkSubject", (q) => q.eq("clerkSubject", subject))
    .unique();

  if (existing !== null) {
    await ctx.db.patch(existing._id, { lastSeenAt: args.now });
    return existing._id;
  }

  const id = await ctx.db.insert("customers", {
    clerkSubject: subject,
    createdAt: args.now,
    lastSeenAt: args.now,
    ...(args.email === undefined ? {} : { email: args.email }),
  });
  return id;
}

/** Resolve the customer or fail with a clear, non-leaky message. */
export async function requireCustomerId(ctx: CustomerCtx): Promise<Id<"customers">> {
  const id = await getCustomerId(ctx);
  if (id === null) {
    throw new ConvexError({
      code: "ACCOUNT_NOT_PROVISIONED",
      message: "Your account is still being set up. Please try again in a moment.",
    });
  }
  return id;
}
