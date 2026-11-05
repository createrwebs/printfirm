import { LOCALES, type Locale } from "@/i18n/detect";
import { useI18n } from "@/i18n";

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();

  const labels: Record<Locale, string> = {
    th: t("nav.langTh") || "ไทย",
    en: t("nav.langEn") || "EN",
    zh: t("nav.langZh") || "中",
  };

  return (
    <div className="flex items-center gap-1 bg-neutral-900/40 p-0.5 rounded-md border border-neutral-800 text-xs" role="group">
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          className={`px-2 py-0.5 rounded transition font-medium ${
            locale === code
              ? "bg-amber-400 text-black shadow-xs"
              : "text-neutral-400 hover:text-white"
          }`}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {labels[code]}
        </button>
      ))}
    </div>
  );
}
