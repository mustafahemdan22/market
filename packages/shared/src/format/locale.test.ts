import { describe, expect, it } from "vitest";
import {
  DEV_FALLBACK_CURRENCY,
  SUPPORTED_CURRENCIES,
  getCurrency,
  isSupportedCurrency,
  resolveCurrency,
} from "../currency/index";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  formatMoney,
  formatNumber,
  isRTL,
  isSupportedLocale,
  localeDirection,
  pluralCategory,
  resolveLocale,
} from "./locale";

describe("currency allowlist", () => {
  it("contains both launch candidates", () => {
    // D1 is unresolved; the code supports both so neither is baked in.
    expect(SUPPORTED_CURRENCIES.EGP).toBeDefined();
    expect(SUPPORTED_CURRENCIES.USD).toBeDefined();
  });

  it("gives every currency exponent 2", () => {
    // toMajorUnits only supports exponent 2. If this ever changes, the currency
    // needs a decimal-safe scaling path first.
    for (const [code, currency] of Object.entries(SUPPORTED_CURRENCIES)) {
      expect(currency.exponent, `${code} exponent`).toBe(2);
    }
  });

  it("validates codes", () => {
    expect(isSupportedCurrency("EGP")).toBe(true);
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("JPY")).toBe(false);
    expect(isSupportedCurrency("")).toBe(false);
    expect(isSupportedCurrency(null)).toBe(false);
    expect(isSupportedCurrency(123)).toBe(false);
  });

  it("throws a helpful error for an unknown code", () => {
    expect(() => getCurrency("JPY" as "EGP")).toThrow(/Unsupported currency/);
  });
});

describe("resolveCurrency", () => {
  it("prefers an explicit supported configuration", () => {
    expect(resolveCurrency({ configured: "USD" })).toBe("USD");
    expect(resolveCurrency({ configured: "EGP" })).toBe("EGP");
  });

  it("falls back to the supported list when configured is unusable", () => {
    expect(resolveCurrency({ configured: "JPY", supported: "USD,EGP" })).toBe("USD");
    expect(resolveCurrency({ configured: undefined, supported: "EGP" })).toBe("EGP");
  });

  it("normalises case and whitespace in the supported list", () => {
    expect(resolveCurrency({ supported: " usd , egp " })).toBe("USD");
  });

  it("falls back to the dev placeholder when nothing is configured", () => {
    // The placeholder is explicitly NOT a business decision — see D1.
    expect(resolveCurrency()).toBe(DEV_FALLBACK_CURRENCY);
    expect(resolveCurrency({ configured: "INVALID" })).toBe(DEV_FALLBACK_CURRENCY);
    expect(resolveCurrency({ supported: "nonsense" })).toBe(DEV_FALLBACK_CURRENCY);
  });

  it("never returns an unsupported currency", () => {
    const cases = [
      resolveCurrency(),
      resolveCurrency({ configured: "JPY" }),
      resolveCurrency({ supported: "XYZ" }),
    ];
    for (const code of cases) {
      expect(isSupportedCurrency(code)).toBe(true);
    }
  });
});

describe("locale resolution", () => {
  it("resolves exact matches", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("ar-EG")).toBe("ar-EG");
  });

  it("is case-insensitive", () => {
    expect(resolveLocale("AR-eg")).toBe("ar-EG");
    expect(resolveLocale("EN")).toBe("en");
  });

  it("resolves any Arabic variant to ar-EG", () => {
    // A device set to ar-SA should still get Arabic, not English.
    expect(resolveLocale("ar-SA")).toBe("ar-EG");
    expect(resolveLocale("ar")).toBe("ar-EG");
  });

  it("resolves regional English variants to en", () => {
    expect(resolveLocale("en-GB")).toBe("en");
    expect(resolveLocale("en-US")).toBe("en");
  });

  it("falls back to the default for unsupported or missing input", () => {
    expect(resolveLocale("fr-FR")).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("validates locales", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("ar-EG")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
    expect(SUPPORTED_LOCALES).toContain("ar-EG");
  });
});

describe("direction", () => {
  it("maps Arabic to RTL and English to LTR", () => {
    expect(localeDirection("ar-EG")).toBe("rtl");
    expect(localeDirection("en")).toBe("ltr");
    expect(isRTL("ar-EG")).toBe(true);
    expect(isRTL("en")).toBe(false);
  });
});

describe("formatMoney", () => {
  it("formats EGP in Arabic and English", () => {
    const ar = formatMoney(1250, { locale: "ar-EG", currency: "EGP" });
    const en = formatMoney(1250, { locale: "en", currency: "EGP" });
    expect(ar).toContain("١٢٫٥٠");
    expect(en).toContain("12.50");
    expect(ar).not.toBe(en); // different digits/symbol placement
  });

  it("produces identical numeric output for EGP and USD", () => {
    // Switching currency (D1) changes the SYMBOL and digits, never the amount.
    expect(formatMoney(4999, { locale: "en", currency: "EGP" })).toContain("49.99");
    expect(formatMoney(4999, { locale: "en", currency: "USD" })).toContain("49.99");
  });

  it("always shows two fraction digits", () => {
    expect(formatMoney(5, { locale: "en", currency: "EGP" })).toContain("0.05");
    expect(formatMoney(1000, { locale: "en", currency: "EGP" })).toContain("10.00");
  });

  it("can omit the currency symbol for dense layouts", () => {
    const withSymbol = formatMoney(1250, { locale: "en", currency: "EGP" });
    const withoutSymbol = formatMoney(1250, { locale: "en", currency: "EGP", symbol: false });
    expect(withoutSymbol).toContain("12.50");
    expect(withoutSymbol.length).toBeLessThanOrEqual(withSymbol.length);
  });

  it("throws for an unsupported currency rather than mis-formatting", () => {
    expect(() => formatMoney(100, { locale: "en", currency: "JPY" as "EGP" })).toThrow(
      /unsupported currency/i,
    );
  });

  it("rejects fractional minor units", () => {
    expect(() => formatMoney(12.5, { locale: "en", currency: "EGP" })).toThrow();
  });

  it("handles zero and large amounts", () => {
    expect(formatMoney(0, { locale: "en", currency: "EGP" })).toContain("0.00");
    expect(formatMoney(100000000, { locale: "en", currency: "EGP" })).toContain("1,000,000.00");
  });
});

describe("formatNumber", () => {
  it("formats quantities per locale", () => {
    expect(formatNumber(1500, "en")).toBe("1,500");
    expect(formatNumber(1500, "ar-EG")).not.toBe("1,500"); // Arabic-Indic digits
  });

  it("handles zero", () => {
    expect(formatNumber(0, "en")).toBe("0");
  });
});

describe("pluralCategory", () => {
  it("uses two categories in English", () => {
    expect(pluralCategory(1, "en")).toBe("one");
    expect(pluralCategory(2, "en")).toBe("other");
    expect(pluralCategory(0, "en")).toBe("other");
  });

  it("uses six categories in Arabic — the reason for Intl.PluralRules", () => {
    // A naive `count === 1 ? singular : plural` is wrong for all of these.
    const categories = [0, 1, 2, 3, 11, 100].map((n) => pluralCategory(n, "ar-EG"));
    expect(new Set(categories).size).toBeGreaterThan(2);
    expect(pluralCategory(0, "ar-EG")).toBe("zero");
    expect(pluralCategory(1, "ar-EG")).toBe("one");
    expect(pluralCategory(2, "ar-EG")).toBe("two");
  });
});
