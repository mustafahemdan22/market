import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  isRTL as checkIsRTL,
  localeDirection,
  formatMoney as sharedFormatMoney,
  formatNumber as sharedFormatNumber,
  type SupportedLocale,
  type SupportedCurrencyCode,
  DEV_FALLBACK_CURRENCY,
} from "@grocery/shared";
import { en } from "./locales/en";
import { ar } from "./locales/ar";
import type { TranslationKey } from "./keys";

import type { ViewStyle } from "react-native";

const dictionaries: Record<SupportedLocale, typeof ar> = {
  "ar-EG": ar,
  en: en,
};

interface I18nContextValue {
  readonly locale: SupportedLocale;
  readonly isRTL: boolean;
  readonly direction: "rtl" | "ltr";
  readonly currency: SupportedCurrencyCode;
  readonly setLocale: (locale: SupportedLocale) => void;
  readonly toggleLanguage: () => void;
  readonly setCurrency: (currency: SupportedCurrencyCode) => void;
  readonly t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  readonly formatMoney: (
    minor: number,
    options?: { currency?: SupportedCurrencyCode; symbol?: boolean },
  ) => string;
  readonly formatNumber: (value: number) => string;
  readonly mirrorStyle: () => ViewStyle;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  readonly children: ReactNode;
  readonly initialLocale?: SupportedLocale;
  readonly initialCurrency?: SupportedCurrencyCode;
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  initialCurrency = DEV_FALLBACK_CURRENCY,
}: I18nProviderProps) {
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);
  const [currency, setCurrency] = useState<SupportedCurrencyCode>(initialCurrency);

  const isRTL = useMemo(() => checkIsRTL(locale), [locale]);
  const direction = useMemo(() => localeDirection(locale), [locale]);

  const toggleLanguage = () => {
    setLocale((prev) => (prev.startsWith("ar") ? "en" : "ar-EG"));
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const dict = dictionaries[locale] ?? ar;
    let template = dict[key] ?? en[key] ?? key;

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        template = template.replaceAll(`{${k}}`, String(v));
      }
    }
    return template;
  };

  const formatMoney = (
    minor: number,
    options?: { currency?: SupportedCurrencyCode; symbol?: boolean },
  ): string => {
    return sharedFormatMoney(minor, {
      locale,
      currency: options?.currency ?? currency,
      symbol: options?.symbol ?? true,
    });
  };

  const formatNumber = (value: number): string => {
    return sharedFormatNumber(value, locale);
  };

  const mirrorStyle = (): ViewStyle => {
    return {
      transform: [{ scaleX: isRTL ? -1 : 1 }],
    };
  };

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      isRTL,
      direction,
      currency,
      setLocale,
      toggleLanguage,
      setCurrency,
      t,
      formatMoney,
      formatNumber,
      mirrorStyle,
    };
  }, [locale, isRTL, direction, currency]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function useFormat() {
  const { formatMoney, formatNumber, locale, currency } = useI18n();
  return { formatMoney, formatNumber, locale, currency };
}
