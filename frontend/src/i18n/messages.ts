import type { Locale } from './detect'
import { en } from './locales/en'
import { th } from './locales/th'
import { zh } from './locales/zh'

export type Messages = typeof zh

export const messages: Record<Locale, Messages> = {
  en: en as unknown as Messages,
  th: th as unknown as Messages,
  zh,
}
