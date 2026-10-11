import { ConvexError } from "convex/values";

/**
 * Server-side authorization primitives.
 *
 * The ONLY input to these functions is the identity that Convex has already
 * cryptographically verified against Clerk's JWKS. Nothing here reads a userId,
 * role, or email supplied by a client, and no function accepts a client-provided
 * admin token.
 */

/**
 * The slice of the Convex context these guards need. Typed structurally so the
 * same guards work in queries, mutations, and actions alike.
 */
export interface AuthCtx {
  readonly auth: {
    getUserIdentity(): Promise<{ subject: string } | null>;
  };
}

const UNAUTHENTICATED = "UNAUTHENTICATED";
const FORBIDDEN = "FORBIDDEN";

function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

/** The verified Clerk subject for the caller, or null when anonymous. */
export async function getSubject(ctx: AuthCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

/**
 * Parse the PANDAMA_ADMIN_SUBJECTS allowlist.
 *
 * This is a server-only Convex environment variable. It is never returned to a
 * client, never written into an EXPO_PUBLIC_* / NEXT_PUBLIC_* variable, and
 * never stored in the repository. An unset or blank value means "no admins",
 * which fails closed.
 */
export function getAdminAllowlist(): ReadonlySet<string> {
  const raw = process.env.PANDAMA_ADMIN_SUBJECTS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

/** True only when the caller's verified Clerk subject is on the allowlist. */
export function isAdminSubject(subject: string): boolean {
  const allowlist = getAdminAllowlist();
  if (allowlist.size === 0) return false;
  return allowlist.has(subject);
}

/** Require any authenticated user. Returns the verified Clerk subject. */
export async function requireUser(ctx: AuthCtx): Promise<string> {
  const subject = await getSubject(ctx);
  if (subject === null) {
    fail(UNAUTHENTICATED, "You must be signed in.");
  }
  return subject;
}

/**
 * Require an administrator.
 *
 * Fails closed when the allowlist is unset or empty. The subject comes from the
 * verified token, never from an argument, so hiding a button in the UI confers
 * no access.
 */
export async function requireAdmin(ctx: AuthCtx): Promise<string> {
  const subject = await requireUser(ctx);
  if (!isAdminSubject(subject)) {
    fail(FORBIDDEN, "You do not have permission to perform this action.");
  }
  return subject;
}

/**
 * Assert row ownership for customer-scoped functions. Admin functions use
 * requireAdmin instead and are not subject to per-row ownership.
 */
export async function requireOwned(
  ctx: AuthCtx,
  ownerSubject: string,
  entity: string,
): Promise<void> {
  const subject = await requireUser(ctx);
  if (subject !== ownerSubject) {
    fail(FORBIDDEN, `You do not have access to this ${entity}.`);
  }
}
