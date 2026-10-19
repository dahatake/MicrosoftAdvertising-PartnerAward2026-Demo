// NFR-UX-004 AC-116 シェルのヘッダー帯のトグル（結合テスト: Shell と ThemeProvider・デザイン基盤）
// キーボードでフォーカスした状態でも、選択中の項目が主色のピル形で示されること、
// 未選択の項目のホバー・押下の背景がデザイントークン（CSS 変数）で、白の文字とのコントラスト比を保つことを確かめる。
// jsdom の getComputedStyle は var() を置換しないため、要素の計算済みのカスタムプロパティで置換して判定する（resolveVars）。
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { BRAND, brandDarkTheme, brandLightTheme, brandTokens } from '../theme/theme';
import { resetSettings } from '../settings/store';
import { resetDataset } from '../app2';
import { APPS } from '../apps/registry';
import { Shell } from './Shell';

// 期待値は要求定義書の PARAM の表から
const PARAM_011 = '#0067B8';
const PARAM_012 = 4.5;
const PARAM_020 = '#2A66B2';
const PARAM_022 = ['#0A1522', '#021C3F'];

const css = readFileSync('src/theme/global.css', 'utf8');
let styleEl: HTMLStyleElement | null = null;
const realMatchMedia = window.matchMedia;

/** OS のライト/ダークの設定を差し替える（ThemeProvider は prefers-color-scheme に追従する） */
function setOsScheme(dark: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: dark && q.includes('dark'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
  styleEl = document.createElement('style');
  styleEl.textContent = css; // main.tsx と同じく global.css を効かせる
  document.head.appendChild(styleEl);
});
afterEach(() => {
  cleanup();
  styleEl?.remove();
  window.matchMedia = realMatchMedia;
});

function resolveVars(el: Element, value: string, depth = 0): string {
  const start = value.indexOf('var(');
  if (start < 0 || depth > 20) return value;
  let i = start + 4;
  let level = 1;
  let comma = -1;
  for (; i < value.length && level > 0; i++) {
    const ch = value[i];
    if (ch === '(') level++;
    else if (ch === ')') level--;
    else if (ch === ',' && level === 1 && comma < 0) comma = i;
  }
  const end = i - 1;
  const name = value.slice(start + 4, comma > 0 ? comma : end).trim();
  const fallback = comma > 0 ? value.slice(comma + 1, end).trim() : '';
  const own = getComputedStyle(el).getPropertyValue(name).trim();
  return resolveVars(el, value.slice(0, start) + (own || fallback) + value.slice(end + 1), depth + 1);
}
const computed = (el: Element, prop: string) => resolveVars(el, getComputedStyle(el).getPropertyValue(prop));

// ---------- WCAG 2.2 の相対輝度とコントラスト比（半透明の色は下の面に重ねてから測る） ----------
const rgba = (hex: string): [number, number, number, number] => {
  const h = hex.replace('#', '');
  const n = (s: string) => parseInt(s, 16);
  return [n(h.slice(0, 2)), n(h.slice(2, 4)), n(h.slice(4, 6)), h.length >= 8 ? n(h.slice(6, 8)) / 255 : 1];
};
const over = (top: string, base: string) => {
  const [r, g, b, a] = rgba(top);
  const [R, G, B] = rgba(base);
  return `#${[r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a)].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
};
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = rgba(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** 選択中の項目: 背景が主色、角丸がピル形（Fluent の borderRadiusCircular）、文字と背景のコントラスト比が PARAM-012 以上 */
function expectSelectedPill(el: HTMLElement, primary: string) {
  expect(el.getAttribute('aria-selected')).toBe('true');
  expect(computed(el, 'background-color').toUpperCase()).toBe(primary.toUpperCase());
  const radius = computed(el, 'border-radius') || ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => computed(el, `border-${c}-radius`)).join(' ');
  const parts = radius.split(/[\s/]+/).filter(Boolean);
  expect(parts.length).toBeGreaterThan(0);
  for (const r of parts) expect(parseFloat(r), `角丸 ${radius}`).toBeGreaterThanOrEqual(1000);
  const fg = computed(el, 'color');
  expect(fg).toMatch(/^#[0-9a-f]{6}$/i);
  expect(contrast(fg, primary)).toBeGreaterThanOrEqual(PARAM_012);
}

/** キーボードの操作（Tab キー）でフォーカスを移したときと同じ状態にする（Fluent は data-fui-focus-visible を付ける） */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', code: 'Tab', keyCode: 9 });
  el.focus();
  expect(document.activeElement).toBe(el);
  expect(el.hasAttribute('data-fui-focus-visible'), 'キーボードのフォーカスの属性').toBe(true);
}

describe('NFR-UX-004 AC-116 ヘッダー帯のトグル（キーボードのフォーカス）', () => {
  for (const [name, dark, primary] of [
    ['ライト', false, PARAM_011],
    ['ダーク', true, PARAM_020],
  ] as const) {
    it(`${name}のテーマ: キーボードでフォーカスした選択中のタブも主色のピル形で、aria-selected で選択が伝わる`, () => {
      setOsScheme(dark);
      render(
        <ThemeProvider>
          <Shell />
        </ThemeProvider>,
      );
      const selected = screen.getByTestId(`app-toggle-${APPS[0].id}`);
      expectSelectedPill(selected, primary);
      keyboardFocus(selected);
      expectSelectedPill(selected, primary);

      // キーボードで別の項目を選んでも（Enter）、選択の移った項目がフォーカス中のままピル形で、前の項目は選択が外れる
      const next = screen.getByTestId(`app-toggle-${APPS[1].id}`);
      keyboardFocus(next);
      expect(next.getAttribute('aria-selected')).toBe('false');
      fireEvent.keyDown(next, { key: 'Enter', code: 'Enter', keyCode: 13 });
      fireEvent.click(next);
      const nextNow = screen.getByTestId(`app-toggle-${APPS[1].id}`);
      keyboardFocus(nextNow);
      expectSelectedPill(nextNow, primary);
      expect(screen.getByTestId(`app-toggle-${APPS[0].id}`).getAttribute('aria-selected')).toBe('false');
    });
  }
});

// NFR-UX-004 AC-116・NFR-UX-001 AC-064 幅 320px でもトグルが横にはみ出さない（App1・App2 のどちらを選んでも）。
// jsdom は配置を計算しないため、はみ出さないための計算済みのスタイル（折り返し・縮小・幅の上限）を確かめる。実際の幅は E2E-068 で確かめる
describe('NFR-UX-004 AC-116 狭い画面でのトグルの折り返し', () => {
  for (const app of APPS) {
    it(`${app.id} を選んだとき: ヘッダー帯とタブの並びが折り返し、各タブが縮んで文字を折り返す（行の幅を超えない）`, () => {
      render(
        <ThemeProvider>
          <Shell />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getByTestId(`app-toggle-${app.id}`));
      expect(screen.getByTestId(`app-toggle-${app.id}`).getAttribute('aria-selected')).toBe('true');
      const header = screen.getByTestId('shell-header');
      expect(getComputedStyle(header).flexWrap).toBe('wrap');
      const list = screen.getByRole('tablist');
      expect(getComputedStyle(list).flexWrap).toBe('wrap');
      expect(getComputedStyle(list).maxWidth).toBe('100%');
      expect(parseFloat(getComputedStyle(list).minWidth)).toBe(0);
      for (const a of APPS) {
        const tab = screen.getByTestId(`app-toggle-${a.id}`);
        const cs = getComputedStyle(tab);
        expect(cs.maxWidth, `${a.id} の幅の上限`).toBe('100%');
        expect(parseFloat(cs.minWidth), `${a.id} の最小幅`).toBe(0);
        expect(cs.whiteSpace, `${a.id} の文字の折り返し`).toBe('normal');
        expect(cs.flexShrink, `${a.id} の縮小`).toBe('1');
      }
    });
  }
});

describe('NFR-UX-004 AC-116 未選択のトグルのホバー・押下の背景（デザイントークン）', () => {
  it('暗い面の上のホバー・押下の背景は brandTokens の CSS 変数で、ライト・ダークどちらのテーマにも同じ値が定義される', () => {
    expect(brandTokens.surfaceOnDarkHover).toBe('var(--brandSurfaceOnDarkHover)');
    expect(brandTokens.surfaceOnDarkPressed).toBe('var(--brandSurfaceOnDarkPressed)');
    for (const t of [brandLightTheme, brandDarkTheme]) {
      expect(t.brandSurfaceOnDarkHover).toBe(BRAND.surfaceOnDarkHover);
      expect(t.brandSurfaceOnDarkPressed).toBe(BRAND.surfaceOnDarkPressed);
    }
    for (const dark of [false, true]) {
      setOsScheme(dark);
      render(
        <ThemeProvider>
          <Shell />
        </ThemeProvider>,
      );
      const idle = screen.getByTestId(`app-toggle-${APPS[1].id}`);
      expect(getComputedStyle(idle).getPropertyValue('--brandSurfaceOnDarkHover').trim().toUpperCase()).toBe(BRAND.surfaceOnDarkHover);
      expect(getComputedStyle(idle).getPropertyValue('--brandSurfaceOnDarkPressed').trim().toUpperCase()).toBe(BRAND.surfaceOnDarkPressed);
      cleanup();
    }
  });

  it('ホバー・押下の背景を暗い面（PARAM-022）に重ねても、白の文字とのコントラスト比が PARAM-012 以上', () => {
    for (const base of PARAM_022) {
      for (const top of [BRAND.surfaceOnDarkHover, BRAND.surfaceOnDarkPressed]) {
        expect(contrast(BRAND.foregroundOnDark, over(top, base)), `${top} over ${base}`).toBeGreaterThanOrEqual(PARAM_012);
      }
    }
  });

  it('異常系: Shell.tsx のスタイルに色の値（#hex・rgb()・rgba()）を直書きしない（デザイントークンを使う）', () => {
    const src = readFileSync('src/shell/Shell.tsx', 'utf8');
    expect(src).not.toMatch(/rgba?\(/i);
    expect(src).not.toMatch(/['"`]#[0-9a-f]{3,8}['"`]/i);
  });
});
