import { getCurrency, type CurrencyCode, type SupportedCurrencyCode } from "../currency/index";

/**
 * Money is stored and manipulated exclusively as an integer in MINOR UNITS.
 * e.g. 12.50 EGP -> 1250
 *
 * Floating-point arithmetic on currency is never acceptable.
 */
export type MinorUnits = number;

/** Money with its currency attached, so a bare number is never ambiguous. */
export interface Money {
  readonly minor: MinorUnits;
  readonly currency: CurrencyCode;
}

export function money(minor: MinorUnits, currency: CurrencyCode): Money {
  return { minor, currency };
}

/**
 * Assert an integer amount. Guards against `12.5` or `NaN` reaching the database,
 * where it would silently corrupt totals.
 */
export function assertIntegerMinor(value: number, field = "amount"): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${field} must be an integer in minor units, received: ${String(value)}`);
  }
}

/**
 * Convert minor units to the major-unit number `Intl.NumberFormat` expects.
 *
 * The exponent is looked up per currency rather than assumed to be 2 — a
 * currency with exponent 0 or 3 would otherwise be formatted 100x wrong.
 * Unsupported currencies are rejected instead of guessed.
 */
export function toMajorUnits(minor: MinorUnits, currency: SupportedCurrencyCode): number {
  assertIntegerMinor(minor, "minor");
  const { exponent } = getCurrency(currency);
  if (exponent !== 2) {
    // Guard rather than silently mis-format. Adding a 0/3-exponent currency
    // requires a decimal-safe path (e.g. string-based scaling) first.
    throw new Error(
      `Currency ${currency} has exponent ${exponent}; toMajorUnits only supports exponent 2`,
    );
  }
  return minor / 100;
}

/**
 * Add two amounts. Returns a bare integer — caller supplies the currency.
 * Throws on non-integer input so a float can never enter the total path.
 */
export function addMinor(a: MinorUnits, b: MinorUnits): MinorUnits {
  assertIntegerMinor(a, "a");
  assertIntegerMinor(b, "b");
  return a + b;
}

export function subtractMinor(a: MinorUnits, b: MinorUnits): MinorUnits {
  assertIntegerMinor(a, "a");
  assertIntegerMinor(b, "b");
  return a - b;
}

/**
 * Multiply by a whole quantity. Kept integer-only on purpose — unit-price ×
 * quantity must never produce a fractional minor unit.
 */
export function multiplyMinor(value: MinorUnits, quantity: number): MinorUnits {
  assertIntegerMinor(value, "value");
  if (!Number.isInteger(quantity)) {
    throw new Error(`quantity must be an integer, received: ${String(quantity)}`);
  }
  return value * quantity;
}

/**
 * Apply a percentage discount with half-up rounding on the MINOR UNIT.
 *
 * Rounding at the minor-unit level (not the major-unit level) is what keeps
 * cart arithmetic consistent: `10% off 3.33` must produce a whole piastre/cents
 * figure, never 3.33 - 0.333.
 *
 * @param percent - 0..100. Values outside the range are clamped.
 */
export function percentOfMinor(value: MinorUnits, percent: number): MinorUnits {
  assertIntegerMinor(value, "value");
  if (!Number.isFinite(percent)) {
    throw new Error(`percent must be finite, received: ${String(percent)}`);
  }
  const clamped = Math.min(100, Math.max(0, percent));
  // Math.round is half-up for positive values, which is the desired behaviour.
  return Math.round((value * clamped) / 100);
}

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute an order total defensively.
 *
 * Returns `null` when the inputs would produce a negative total, rather than
 * clamping to zero. A negative order total means a discount exceeded the
 * subtotal — that is a bug or an attack, and it must abort the transaction,
 * not silently become 0. See DATA_MODEL.md §3.11.3 step 8.
 */
export interface OrderTotals {
  readonly subtotalMinor: MinorUnits;
  readonly discountMinor: MinorUnits;
  readonly deliveryFeeMinor: MinorUnits;
  readonly taxMinor: MinorUnits;
  readonly totalMinor: MinorUnits;
}

export function computeOrderTotals(input: {
  readonly subtotalMinor: MinorUnits;
  readonly discountMinor: MinorUnits;
  readonly deliveryFeeMinor: MinorUnits;
  readonly taxMinor: MinorUnits;
}): OrderTotals | null {
  const { subtotalMinor, discountMinor, deliveryFeeMinor, taxMinor } = input;

  assertIntegerMinor(subtotalMinor, "subtotalMinor");
  assertIntegerMinor(discountMinor, "discountMinor");
  assertIntegerMinor(deliveryFeeMinor, "deliveryFeeMinor");
  assertIntegerMinor(taxMinor, "taxMinor");

  if (discountMinor < 0) {
    return null;
  }

  const totalMinor = subtotalMinor - discountMinor + deliveryFeeMinor + taxMinor;

  // A discount larger than the subtotal is rejected, not clamped.
  if (totalMinor < 0) {
    return null;
  }

  return { subtotalMinor, discountMinor, deliveryFeeMinor, taxMinor, totalMinor };
}
