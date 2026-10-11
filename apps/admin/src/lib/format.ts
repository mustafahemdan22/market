import { formatMoney, type SupportedCurrencyCode, type SupportedLocale } from "@grocery/shared";

/**
 * EGP display formatting.
 *
 * Prices are stored as integer MINOR UNITS (piastres: 1250 = EGP 12.50). The
 * store's rule is that the customer-facing shelf price is final and already
 * includes VAT, so nothing here adds a tax line — this only renders the number
 * the server produced.
 */
export const STORE_CURRENCY: SupportedCurrencyCode = "EGP";

export const STORE_LOCALE: SupportedLocale = "ar-EG";

export function formatEgp(minorUnits: number, locale: SupportedLocale = STORE_LOCALE): string {
  return formatMoney(minorUnits, { locale, currency: STORE_CURRENCY, symbol: true });
}

/** Minor units -> the major-unit string shown in a price input box. */
export function minorToInput(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Major-unit string -> integer minor units, or null when the input is not a
 * valid positive amount. Rejecting (rather than coercing) keeps a malformed
 * price from silently becoming a different price than the operator typed.
 */
export function inputToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const major = Number(trimmed);
  if (!Number.isFinite(major) || major <= 0) return null;
  return Math.round(major * 100);
}
