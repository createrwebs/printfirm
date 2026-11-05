import { LOCALES, type Locale } from '../../i18n/detect'
import { useI18n } from '../../i18n'

/** 顶栏英/泰/中切换：点击后写入偏好，覆盖浏览器语言 */
export default function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()

  const labels: Record<Locale, string> = {
    en: t('nav.langEn') || 'EN',
    th: t('nav.langTh') || 'ไทย',
    zh: t('nav.langZh') || '中',
  }

  return (
    <div className="pf-nav-lang" role="group" aria-label={t('nav.language')}>
      {LOCALES.map((code: Locale) => (
        <button
          key={code}
          type="button"
          className={locale === code ? 'is-active' : undefined}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {labels[code]}
        </button>
      ))}
    </div>
  )
}
