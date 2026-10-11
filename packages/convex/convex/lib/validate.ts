import { ConvexError } from "convex/values";

/**
 * Server-side input validation.
 *
 * Every admin mutation runs its arguments through these helpers before any
 * write. Prices arrive as integer minor units (EGP => piastres); a non-integer
 * or negative price is rejected rather than coerced.
 */

/** Upper sanity bound on a single product price: EGP 1,000,000.00. */
export const MAX_PRICE_MINOR = 100_000_000;
/** Upper sanity bound on stock for one variant. */
export const MAX_STOCK_UNITS = 1_000_000;
export const MAX_TEXT_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 4000;

/** Reject invalid input with a stable, non-leaky code. */
export function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID_INPUT", message });
}

/** Trim and bound a required short string. */
export function requireText(value: unknown, field: string, max = MAX_TEXT_LENGTH): string {
  if (typeof value !== "string") invalid(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) invalid(`${field} must not be empty.`);
  if (trimmed.length > max) invalid(`${field} must be at most ${max} characters.`);
  return trimmed;
}

/** Trim and bound an optional short string; blank input becomes undefined. */
export function optionalText(
  value: unknown,
  field: string,
  max = MAX_TEXT_LENGTH,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") invalid(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > max) invalid(`${field} must be at most ${max} characters.`);
  return trimmed;
}

/**
 * Validate a monetary amount in integer minor units.
 * Rejects floats, zero, negatives and absurd values. No rounding is applied —
 * a fractional amount is a client bug and must be fixed, not silently fixed up.
 */
export function requirePriceMinor(value: unknown, field = "price"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(`${field} must be a finite number of minor units.`);
  }
  if (!Number.isInteger(value)) {
    invalid(`${field} must be a whole number of minor units (e.g. 1250 for EGP 12.50).`);
  }
  if (value <= 0) invalid(`${field} must be greater than zero.`);
  if (value > MAX_PRICE_MINOR) invalid(`${field} exceeds the maximum allowed value.`);
  return value;
}

export function optionalPriceMinor(value: unknown, field = "compareAtPrice"): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requirePriceMinor(value, field);
}

/** Validate a stock quantity: integer, zero or more. */
export function requireStock(value: unknown, field = "stock"): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalid(`${field} must be a finite number.`);
  }
  if (!Number.isInteger(value)) invalid(`${field} must be a whole number.`);
  if (value < 0) invalid(`${field} must not be negative.`);
  if (value > MAX_STOCK_UNITS) invalid(`${field} exceeds the maximum allowed value.`);
  return value;
}

/** Normalise a SKU to uppercase, trimmed, no internal whitespace. */
export function normaliseSku(value: unknown): string {
  const raw = requireText(value, "SKU", 64);
  const normalised = raw.replace(/\s+/g, "-").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalised)) {
    invalid("SKU may only contain letters, numbers, and . _ - / characters.");
  }
  return normalised;
}

/** URL-safe slug derived from a name. */
export function slugify(value: unknown): string {
  const raw = requireText(value, "name", MAX_TEXT_LENGTH)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (raw.length === 0) invalid("Name must contain at least one letter or digit to build a slug.");
  return raw;
}

/**
 * Build the server-owned search blob. Never accepted from a client, so the
 * search index cannot be poisoned with arbitrary terms.
 */
export function buildSearchText(parts: {
  nameEn: string;
  nameAr: string;
  brand?: string | undefined;
  categoryNameEn?: string | undefined;
  categoryNameAr?: string | undefined;
}): string {
  return [parts.nameEn, parts.nameAr, parts.brand, parts.categoryNameEn, parts.categoryNameAr]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase()
    .slice(0, 4000);
}
