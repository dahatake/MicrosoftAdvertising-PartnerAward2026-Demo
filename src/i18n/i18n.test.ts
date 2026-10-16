import { beforeEach, describe, expect, it } from 'vitest';
import { LANGUAGES, FALLBACK_LANG, detectLang, dictionaries, translate } from './index';
import { ja } from './locales/ja';
import { initialSettings, resetSettings, updateSettings, getSettings } from '../settings/store';

beforeEach(() => localStorage.clear());

// FR-002 AC-003 ブラウザの言語が ja/en/zh/ko のとき、その言語になる
describe('FR-002 AC-003 detectLang', () => {
  it.each([
    [['ko-KR'], 'ko'],
    [['ja'], 'ja'],
    [['zh-CN'], 'zh'],
    [['en-US'], 'en'],
    [['fr', 'ko'], 'ko'],
  ])('%j → %s', (langs, expected) => {
    expect(detectLang(langs)).toBe(expected);
  });
});

// FR-002 AC-004 4 言語以外は PARAM-001 の言語
describe('FR-002 AC-004 fallback', () => {
  it('4 言語以外・空は PARAM-001（en）', () => {
    expect(FALLBACK_LANG).toBe('en');
    expect(detectLang(['fr-FR', 'de'])).toBe('en');
    expect(detectLang([])).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
});

// FR-002 AC-005 4 言語すべてに翻訳の欠落がない
describe('FR-002 AC-005 辞書の網羅', () => {
  it.each(LANGUAGES)('%s は ja と同じキーを持ち、空文字がない', (lang) => {
    expect(Object.keys(dictionaries[lang]).sort()).toEqual(Object.keys(ja).sort());
    for (const v of Object.values(dictionaries[lang])) expect(v.trim()).not.toBe('');
  });
  it('translate は選択言語の文言を返す', () => {
    expect(translate('en', 'shell.language')).toBe('Language');
    expect(translate('ko', 'shell.language')).toBe('언어');
  });
});

// FR-002 AC-006 選んだ言語は保存され、ブラウザの言語より優先される
describe('FR-002 AC-006 言語の保存と復元', () => {
  it('保存済みの言語がブラウザの言語より優先される', () => {
    updateSettings({ lang: 'zh' });
    expect(localStorage.getItem('lang')).toBe('zh');
    expect(initialSettings(['ko']).lang).toBe('zh');
    resetSettings(['ja']);
    expect(getSettings().lang).toBe('zh');
  });
  it('不正な保存値は無視してブラウザの言語を使う', () => {
    localStorage.setItem('lang', 'xx');
    expect(initialSettings(['ko']).lang).toBe('ko');
  });
});

// FR-001 AC-001 アプリを切り替えても言語・表示方法は保たれる（設定ストアが 1 つ）
describe('FR-001 AC-001 切替で設定を保つ', () => {
  it('app を変えても lang/viewMethod は変わらない', () => {
    updateSettings({ lang: 'ko', viewMethod: '3d' });
    updateSettings({ app: 'app2' });
    expect(getSettings()).toMatchObject({ lang: 'ko', viewMethod: '3d', app: 'app2' });
  });
});
