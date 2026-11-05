import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyLocale, detectLocale, type Locale } from "./detect";
import { interpolate, lookupMessage, type TVars } from "./lookup";
import { messages, type AdminMessages } from "./messages";

export type TFunction = (path: string, vars?: TVars) => string;

type I18nValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: TFunction;
  m: AdminMessages;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const next = detectLocale();
    applyLocale(next, false);
    return next;
  });

  const m = messages[locale];

  useEffect(() => {
    applyLocale(locale, false);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    applyLocale(next, true);
    setLocaleState(next);
  }, []);

  const t = useCallback<TFunction>(
    (path, vars) => {
      const raw = lookupMessage(m, path);
      if (!raw) return path;
      return interpolate(raw, vars);
    },
    [m],
  );

  const value = useMemo(() => ({ locale, setLocale, t, m }), [locale, setLocale, t, m]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
