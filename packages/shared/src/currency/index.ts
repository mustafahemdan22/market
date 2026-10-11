/**
 * Currency configuration.
 *
 * WHY THIS IS CONFIG, NOT A CONSTANT
 * ----------------------------------
 * The target market is NOT yet confirmed (open decision D1 in DATA_MODEL.md §8.2).
 * An earlier draft of the data model hardcoded `v.literal("USD")` on `orders` and
 * `payments`. Because Convex validates every document against the schema on each
 * push, changing that literal later would require a two-phase migration on a
 * populated table.
 *
 * Storing `currency` as a validated string instead means switching market is a
 * configuration change, not a schema change. See DATA_MODEL.md §1.4.
 *
 * The DEFAULT below is a *fallback for development only*. It is intentionally not
 * treated as a business decision and must be overridden by config in any real
 * deployment (see `resolveCurrency`).
 */

/** ISO 4217 alphabetic code. */
export type CurrencyCode = string;

/**
 * Minor-unit exponent per currency. Number of decimal places in the major unit.
 *
 * Only currencies with exponent 2 are enabled. Currencies with exponent 0
 * (JPY) or 3 (KWD) would need different handling in `toMajorUnits` and are
 * deliberately excluded rather than silently mis-formatted.
 */
export interface CurrencyDefinition {
  /** ISO 4217 alphabetic code, e.g. "EGP". */
  readonly code: CurrencyCode;
  /** Decimal places in the major unit. */
  readonly exponent: number;
  /** Arabic display name, used in the language/currency picker. */
  readonly nameAr: string;
  /** English display name. */
  readonly nameEn: string;
  /** Whether Arabic-Indic digits are conventional for this currency in-market. */
  readonly prefersArabicIndicDigits: boolean;
}

function defineCurrency(
  code: CurrencyCode,
  nameEn: string,
  nameAr: string,
  prefersArabicIndicDigits: boolean,
): CurrencyDefinition {
  // Exponent 2 for all currently supported currencies. Kept explicit per-entry
  // (rather than a shared constant) so adding a 0- or 3-exponent currency later
  // forces a deliberate decision here.
  return { code, exponent: 2, nameEn, nameAr, prefersArabicIndicDigits };
}

/**
 * The allowlist. Any `currency` value written to the database MUST be a key here.
 *
 * Kept deliberately small: only currencies actually plausible for the launch
 * market. Widening it is a config change.
 */
export const SUPPORTED_CURRENCIES = {
  EGP: defineCurrency("EGP", "Egyptian Pound", "جنيه مصري", true),
  USD: defineCurrency("USD", "US Dollar", "دولار أمريكي", false),
} as const satisfies Record<string, CurrencyDefinition>;

export type SupportedCurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

/** Runtime type guard used at every write boundary in place of `v.literal`. */
export function isSupportedCurrency(value: unknown): value is SupportedCurrencyCode {
  return typeof value === "string" && Object.hasOwn(SUPPORTED_CURRENCIES, value);
}

export function getCurrency(code: SupportedCurrencyCode): CurrencyDefinition {
  const currency = SUPPORTED_CURRENCIES[code];
  if (currency === undefined) {
    throw new Error(`Unsupported currency: ${String(code)}`);
  }
  return currency;
}

export function isSupportedCurrencyCode(
  value: unknown,
): value is SupportedCurrencyCode {
  return isSupportedCurrency(value);
}

/**
 * FALLBACK DEFAULT — development only.
 *
 * ⚠️ This is NOT a business decision. Open decision **D1** asks whether the
 * launch currency is EGP or USD and remains unanswered. Production must supply
 * `DEFAULT_CURRENCY` via environment config; see SECURITY.md §6.
 *
 * EGP is used as the placeholder because the Phase B brief names Egyptian Arabic
 * as a first-class locale. It is a placeholder, not an approval.
 */
export const DEV_FALLBACK_CURRENCY: SupportedCurrencyCode = "EGP";

export interface ResolveCurrencyOptions {
  /** Value from `process.env.DEFAULT_CURRENCY` / Convex env. */
  readonly configured?: string | undefined;
  /** Value from `process.env.SUPPORTED_CURRENCIES` (comma separated). */
  readonly supported?: string | undefined;
}

/**
 * Resolve the active currency from config, falling back to the dev placeholder.
 * Never throws — an unresolvable currency falls back rather than crashing a
 * storefront, but the fallback is always logged by the caller.
 */
export function resolveCurrency(
  options: ResolveCurrencyOptions = {},
): SupportedCurrencyCode {
  if (options.configured !== undefined && isSupportedCurrency(options.configured)) {
    return options.configured;
  }

  if (options.supported !== undefined) {
    const parsed = options.supported
      .split(",")
      .map((entry) => entry.trim().toUpperCase())
      .filter(isSupportedCurrency);
    const first = parsed[0];
    if (first !== undefined) {
      return first;
    }
  }

  return DEV_FALLBACK_CURRENCY;
}
