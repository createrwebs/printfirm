export type Locale = "th" | "en" | "zh";

export const LOCALES: Locale[] = ["th", "en", "zh"];

export const LOCALE_STORAGE_KEY = "printfilm.admin.locale.v3";

export const LOCALE_HTML: Record<Locale, string> = {
  th: "th-TH",
  en: "en",
  zh: "zh-CN",
};

export const LOCALE_DATE: Record<Locale, string> = {
  th: "th-TH",
  en: "en-US",
  zh: "zh-CN",
};

let activeLocale: Locale = "th";

export function isLocale(value: unknown): value is Locale {
  return value === "th" || value === "en" || value === "zh";
}

export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

export function detectLocale(): Locale {
  const stored = typeof window === "undefined" ? null : readStoredLocale();
  if (stored) return stored;
  return "th";
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function applyLocale(locale: Locale, persist: boolean): void {
  activeLocale = locale;
  if (persist) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = LOCALE_HTML[locale];
  }
}

export function formatDateTime(value?: string | Date | null, locale: Locale = activeLocale): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE_DATE[locale], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
