// NFR-UX-005 AC-117 AC-118 AC-119 の結合テスト（架空の製品・非公式のデモの注記）
// 期待値は要求定義書の受入基準と PARAM-012（コントラスト比 4.5）から。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BRAND } from '../theme/theme';
import { resetSettings, updateSettings } from '../settings/store';
import { resetDataset } from '../app2';
import { LANGUAGES, translate, type Lang } from '../i18n';
import { Shell } from './Shell';

const PARAM_012 = 4.5;

// 4 言語それぞれに含まれるべき語（いずれか）: 架空・非公式・仮置き（AC-119）
const WORDS: Record<string, { fictional: RegExp; unofficial: RegExp; placeholder: RegExp }> = {
  ja: { fictional: /架空/, unofficial: /非公式/, placeholder: /仮置き/ },
  en: { fictional: /fictional/i, unofficial: /unofficial/i, placeholder: /placeholder/i },
  zh: { fictional: /虚构|架空/, unofficial: /非官方/, placeholder: /占位|暂定|临时/ },
  ko: { fictional: /가상|허구/, unofficial: /비공식/, placeholder: /임시|가안|플레이스홀더/ },
};

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(cleanup);

describe('NFR-UX-005 注記の文言（AC-119）', () => {
  it.each(LANGUAGES as readonly Lang[])('%s: 架空・非公式・仮置きを含む', (lang) => {
    const text = translate(lang, 'shell.brandNotice');
    expect(text.length).toBeGreaterThan(10);
    const w = WORDS[lang];
    expect(text).toMatch(w.fictional);
    expect(text).toMatch(w.unofficial);
    expect(text).toMatch(w.placeholder);
    expect(text).toMatch(/Microsoft/);
  });

  it('4 ロケールの文言が欠けず、互いに異なる', () => {
    const texts = (LANGUAGES as readonly Lang[]).map((l) => translate(l, 'shell.brandNotice'));
    expect(new Set(texts).size).toBe(4);
    expect(texts.every((t) => t !== 'shell.brandNotice')).toBe(true);
  });

  it('注記の文字色と暗い帯の面（ライト・ダーク共通）のコントラスト比が PARAM-012 以上', () => {
    for (const bg of [...BRAND.surfaceDark]) {
      expect(contrast(BRAND.foregroundOnDarkMuted, bg)).toBeGreaterThanOrEqual(PARAM_012);
    }
  });
});

describe('NFR-UX-005 注記の表示（AC-117 AC-118 AC-119）', () => {
  it.each(LANGUAGES as readonly Lang[])('%s: role=note・ヘッダー帯の中・h1 の外・閉じる操作なし', (lang) => {
    updateSettings({ lang });
    render(
      <ThemeProvider>
        <Shell />
      </ThemeProvider>,
    );
    const note = screen.getByTestId('brand-notice');
    expect(note.getAttribute('role')).toBe('note');
    expect(note.textContent).toBe(translate(lang, 'shell.brandNotice'));
    expect(screen.getByTestId('shell-header').contains(note)).toBe(true);
    const h1 = document.querySelector('h1')!;
    expect(h1.contains(note)).toBe(false);
    expect(h1.textContent).toBe('MicrosoftAdvertising-PartnerAward2026-Demo');
    expect(note.querySelector('button, svg, img, [aria-expanded]')).toBeNull();
  });

  it('言語を切り替えると注記の言語も切り替わる', () => {
    render(
      <ThemeProvider>
        <Shell />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('brand-notice').textContent).toMatch(/架空/);
    cleanup();
    updateSettings({ lang: 'en' });
    render(
      <ThemeProvider>
        <Shell />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('brand-notice').textContent).toMatch(/fictional/i);
  });
});
