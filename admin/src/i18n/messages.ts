import type { Locale } from "./detect";
import { th, type AdminMessages } from "./locales/th";
import { en } from "./locales/en";
import { zh } from "./locales/zh";

export type { AdminMessages };

export const messages: Record<Locale, AdminMessages> = {
  th,
  en,
  zh,
};
