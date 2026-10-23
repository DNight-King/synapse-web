"use client";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getMessages, translate } from "./messages";

interface I18nContextValue {
  locale: Locale;
}

// The default is the English catalog, so components render correctly without a
// provider (tests, Storybook) rather than throwing.
const I18nContext = createContext<I18nContextValue>({ locale: DEFAULT_LOCALE });

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

/** Returns a `t(key, params)` bound to `namespace` for the active locale. */
export function useTranslations(namespace: string) {
  const locale = useLocale();
  const messages = useMemo(() => getMessages(locale), [locale]);
  return useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(messages, namespace, key, params),
    [messages, namespace]
  );
}
