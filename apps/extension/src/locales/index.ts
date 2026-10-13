import { zh } from './zh'
import { zhTW } from './zh-TW'
import { en } from './en'
import { ja } from './ja'
import { ko } from './ko'
import { de } from './de'
import { fr } from './fr'
import { es } from './es'
import { it } from './it'
import { pt } from './pt'
import { ru } from './ru'
import { ar } from './ar'
import { hi } from './hi'
import { vi } from './vi'
import { id } from './id'
import { th } from './th'
import { nl } from './nl'
import { pl } from './pl'

export type Locale = 
  | 'zh' | 'zh-TW' | 'en' | 'ja' | 'ko'
  | 'fr' | 'de' | 'es' | 'it'
  | 'pt' | 'ru' | 'ar' | 'hi' | 'vi' | 'id' | 'th'
  | 'nl' | 'pl';

export const LANGUAGES: { code: Locale; name: string; flag: string }[] = [
  // 1. 核心高频标配 (Core Tier)
  { code: 'zh', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁體中文', flag: '🇭🇰' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },

  // 2. FIGS 欧洲主流四强 (European Core)
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },

  // 3. 高人口与战略出海语种 (Strategic Emerging Markets)
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },

  // 4. 欧洲成熟市场补充
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
];

export const extTranslations: Record<Locale, typeof zh> = {
  zh,
  'zh-TW': zhTW,
  en,
  ja,
  ko,
  fr,
  de,
  es,
  it,
  pt,
  ru,
  ar,
  hi,
  vi,
  id,
  th,
  nl,
  pl,
};

export type ExtTranslationKey = keyof typeof zh;

export function getExtTranslation(locale: Locale, key: ExtTranslationKey | string): string {
  const dict = extTranslations[locale] || extTranslations.zh;
  return (dict as Record<string, string>)[key] || (extTranslations.zh as Record<string, string>)[key] || key;
}

export { zh, zhTW, en, ja, ko, fr, de, es, it, pt, ru, ar, hi, vi, id, th, nl, pl };
