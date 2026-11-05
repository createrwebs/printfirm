/** 浏览器语言检测、本地覆盖与 html lang 同步 */

export type Locale = 'th' | 'en' | 'zh'

export const LOCALES: Locale[] = ['th', 'en', 'zh']

export const LOCALE_STORAGE_KEY = 'printfilm.locale.v3'

export const LOCALE_HTML: Record<Locale, string> = {
  th: 'th-TH',
  en: 'en',
  zh: 'zh-CN',
}

export const LOCALE_DATE: Record<Locale, string> = {
  th: 'th-TH',
  en: 'en-US',
  zh: 'zh-CN',
}

// ค่าเริ่มต้นเป็นภาษาไทย
let activeLocale: Locale = 'th'

// ตรวจสอบว่าเป็นภาษาที่รองรับ
export function isLocale(value: unknown): value is Locale {
  return value === 'th' || value === 'en' || value === 'zh'
}

// แมปจากเบราว์เซอร์ (ค่าเริ่มต้น th)
export function localeFromBrowser(lang?: string): Locale {
  const raw = (lang || '').trim().toLowerCase()
  if (raw.startsWith('en')) return 'en'
  if (raw.startsWith('zh')) return 'zh'
  return 'th'
}

// อ่านค่าที่เคยเลือก
export function readStoredLocale(): Locale | null {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(raw)) return raw
    return null
  } catch {
    return null
  }
}

// เริ่มต้น: ค่าเริ่มต้นคือภาษาไทย (th)
export function detectLocale(): Locale {
  const stored = typeof window === 'undefined' ? null : readStoredLocale()
  if (stored) return stored
  return 'th'
}

export function getActiveLocale(): Locale {
  return activeLocale
}

// 应用语言：写 html lang；persist 时才写入 localStorage
export function applyLocale(locale: Locale, persist: boolean): void {
  activeLocale = locale
  if (persist) {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    } catch {
      /* ignore quota / private mode */
    }
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LOCALE_HTML[locale]
  }
}

// 日期เวลา按当前语言格式化
export function formatDateTime(value?: string | Date | null, locale: Locale = activeLocale): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(LOCALE_DATE[locale], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
