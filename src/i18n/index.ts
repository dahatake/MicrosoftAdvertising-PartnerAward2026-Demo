import { ja, type MessageKey, type Messages } from './locales/ja';
import { en } from './locales/en';
import { zh } from './locales/zh';
import { ko } from './locales/ko';

export const LANGUAGES = ['ja', 'en', 'zh', 'ko'] as const;
export type Lang = (typeof LANGUAGES)[number];

/** PARAM-001: ブラウザの言語が 4 言語以外のときの既定言語 */
export const FALLBACK_LANG: Lang = 'en';

/** 言語名の表示（自言語で表記し、辞書とは独立） */
export const LANGUAGE_LABELS: Record<Lang, string> = { ja: '日本語', en: 'English', zh: '中文', ko: '한국어' };

export const dictionaries: Record<Lang, Messages> = { ja, en, zh, ko };

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGUAGES as readonly string[]).includes(v);
}

/** ブラウザの言語（navigator.languages の並び）から対応言語を選ぶ。無ければ PARAM-001 の言語 */
export function detectLang(languages: readonly string[] | undefined): Lang {
  for (const tag of languages ?? []) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return FALLBACK_LANG;
}

export function translate(lang: Lang, key: MessageKey): string {
  return dictionaries[lang][key] ?? ja[key];
}

export type { MessageKey, Messages };
