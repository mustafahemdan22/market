import { isSupportedCurrency, type SupportedCurrencyCode } from "../currency/index";
import { toMajorUnits, type MinorUnits } from "./money";

/**
 * BCP-47 locale tags supported at launch.
 *
 * `ar-EG` is Egypt-specific; Arabic-Indic digits and Egyptian currency placement
 * differ from, say, `ar-SA`. Using the region tag matters for `Intl`.
 */
export const SUPPORTED_LOCALES = ["en", "ar-EG"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ar-EG";

/** Language codes extracted from supported locales. */
export type SupportedLanguage = "en" | "ar";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve a device locale tag to a supported locale.
 *
 * Matches on the base language so `ar-EG`, `ar-SA`, and `ar` all resolve to
 * `ar-EG` (our only Arabic variant), rather than falling back to English.
 */
export function resolveLocale(requested: string | undefined | null): SupportedLocale {
  if (requested == null) {
    return DEFAULT_LOCALE;
  }

  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === requested.toLowerCase(),
  );
  if (exact !== undefined) {
    return exact;
  }

  const base = requested.split("-")[0]?.toLowerCase();
  if (base === "ar") {
    return "ar-EG";
  }
  if (base === "en") {
    return "en";
  }

  return DEFAULT_LOCALE;
}

export function localeDirection(locale: SupportedLocale): "rtl" | "ltr" {
  return locale.startsWith("ar") ? "rtl" : "ltr";
}

export function isRTL(locale: SupportedLocale): boolean {
  return localeDirection(locale) === "rtl";
}

export interface FormatMoneyOptions {
  readonly locale: SupportedLocale;
  readonly currency: SupportedCurrencyCode;
  /** Render without the currency symbol (for dense table cells). */
  readonly symbol?: boolean;
}

/**
 * Format minor units as a locale-aware currency string.
 *
 * All shaping — digit substitution, symbol placement, thousands separators,
 * bidi isolation — is delegated to `Intl`. Nothing here is hand-rolled, because
 * Arabic currency rendering has rules that are easy to get subtly wrong.
 */
export function formatMoney(minor: MinorUnits, options: FormatMoneyOptions): string {
  const { locale, currency, symbol = true } = options;

  if (!isSupportedCurrency(currency)) {
    throw new Error(`Cannot format unsupported currency: ${String(currency)}`);
  }

  const major = toMajorUnits(minor, currency);

  return new Intl.NumberFormat(locale, {
    style: symbol ? "currency" : "decimal",
    ...(symbol ? { currency } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Format a quantity. Arabic-Indic digits are used when the locale calls for it.
 */
export function formatNumber(value: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Plural category selection.
 *
 * Arabic has SIX plural categories (zero/one/two/few/many/other) and English has
 * TWO. A naive `count === 1 ? singular : plural` produces incorrect Arabic.
 * This delegates to `Intl.PluralRules` so the CLDR data drives correctness.
 */
export function pluralCategory(count: number, locale: SupportedLocale): Intl.LDMLPluralRule {
  return new Intl.PluralRules(locale).select(count);
}

export type PluralCategory = ReturnType<typeof pluralCategory>;
