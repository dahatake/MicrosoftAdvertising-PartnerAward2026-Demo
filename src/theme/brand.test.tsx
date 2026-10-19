// NFR-UX-004 の単体・結合テスト（デザイン基盤: ブランドの主色・ピル形の主ボタン・見出しと本文のフォント指定）
// jsdom の getComputedStyle は CSS のカスケードと CSS 変数の継承は計算するが、var() の置換はしないため、
// 計算済みのスタイルの var() を、その要素の計算済みのカスタムプロパティで置換して判定する（resolveVars）。
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { THEME_SWITCHING_ATTR, ThemeProvider } from './ThemeProvider';
import { BRAND, brandDark, brandDarkTheme, brandLight, brandLightTheme, brandRamp, pickTheme } from './theme';
import { PrimaryButton } from './BrandButton';
import { Shell } from '../shell/Shell';
import { App1 } from '../apps/App1';
import { AssetPanel, PlanQuotePanel, resetDataset } from '../app2';
import { resetSettings } from '../settings/store';

// 期待値は要求定義書の PARAM の表から
const PARAM_011 = '#0067B8';
const PARAM_012 = 4.5;
const PARAM_013 = '"Segoe Sans", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
const PARAM_014 = '"Segoe Sans", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
const PARAM_020 = '#2A66B2';

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

// ---------- 計算済みのスタイルの解決 ----------
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
  const replaced = own || fallback;
  return resolveVars(el, value.slice(0, start) + replaced + value.slice(end + 1), depth + 1);
}
const computed = (el: Element, prop: string) => resolveVars(el, getComputedStyle(el).getPropertyValue(prop));
const fontList = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim().replace(/'/g, '"'))
    .join(', ');

// ---------- WCAG 2.2 の相対輝度とコントラスト比 ----------
const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** 主操作のボタン: 計算済みの背景色が主色、角丸がピル形、文字と背景のコントラスト比が PARAM-012 以上 */
function expectPrimaryPill(el: HTMLElement, primary: string) {
  expect(computed(el, 'background-color').toUpperCase()).toBe(primary.toUpperCase());
  // jsdom は var() を含む border-radius の一括指定を各角に展開しないため、一括指定を解決して 4 つの値を見る
  const radius = computed(el, 'border-radius') || ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => computed(el, `border-${c}-radius`)).join(' ');
  const parts = radius.split(/[\s/]+/).filter(Boolean);
  expect(parts.length).toBeGreaterThan(0);
  for (const r of parts) {
    // Fluent の borderRadiusCircular（10000px）。どの高さのボタンでも半径が高さの半分以上になる
    expect(parseFloat(r), `角丸 ${radius}`).toBeGreaterThanOrEqual(1000);
  }
  const fg = computed(el, 'color');
  expect(fg).toMatch(/^#[0-9a-f]{6}$/i);
  expect(contrast(fg, primary)).toBeGreaterThanOrEqual(PARAM_012);
}

// NFR-UX-004 AC-089 テーマの主色（ライト PARAM-011、ダーク PARAM-020）と、主色の上の文字のコントラスト比
describe('NFR-UX-004 AC-089 ブランドの主色のテーマ', () => {
  it('ライトのテーマの主要ボタンの背景が PARAM-011、ダークが PARAM-020 になる', () => {
    expect(brandLightTheme.colorBrandBackground.toUpperCase()).toBe(PARAM_011);
    expect(brandDarkTheme.colorBrandBackground.toUpperCase()).toBe(PARAM_020);
    expect(pickTheme(false)).toBe(brandLightTheme);
    expect(pickTheme(true)).toBe(brandDarkTheme);
    expect(BRAND.primaryLight).toBe(PARAM_011);
    expect(BRAND.primaryDark).toBe(PARAM_020);
  });
  it('主色の上の文字（colorNeutralForegroundOnBrand）とのコントラスト比が PARAM-012 以上', () => {
    for (const t of [brandLightTheme, brandDarkTheme]) {
      expect(contrast(t.colorNeutralForegroundOnBrand, t.colorBrandBackground)).toBeGreaterThanOrEqual(PARAM_012);
    }
  });
  it('ブランドランプは 16 段で、暗い段から明るい段へ輝度が単調に増え、基準の段が基準色になる', () => {
    for (const [ramp, base, anchor] of [
      [brandLight, PARAM_011, 80],
      [brandDark, PARAM_020, 70],
    ] as const) {
      const steps = Object.keys(ramp).map(Number);
      expect(steps).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);
      const l = steps.map((s) => lum(ramp[s as keyof typeof ramp]));
      for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
      expect(ramp[anchor as keyof typeof ramp]).toBe(base);
    }
    // 異常系: 基準の段が端（10・160）でも 16 段がそろう
    expect(Object.values(brandRamp(PARAM_011, 10))[0]).toBe(PARAM_011);
    expect(Object.values(brandRamp(PARAM_011, 160))[15]).toBe(PARAM_011);
  });
});

// NFR-UX-004 AC-089 主操作のボタン（App1 の主 CTA、App2 の企画の確定・見積の提出・承認・素材登録の確定）が主色のピル形
describe('NFR-UX-004 AC-089 主操作のボタンは主色・ピル形', () => {
  for (const [dark, primary, label] of [
    [false, PARAM_011, 'ライト'],
    [true, PARAM_020, 'ダーク'],
  ] as const) {
    it(`${label}のテーマで App1 の主 CTA が主色・ピル形・コントラスト比 4.5 以上`, () => {
      setOsScheme(dark);
      render(
        <ThemeProvider>
          <App1 />
        </ThemeProvider>,
      );
      expectPrimaryPill(screen.getByTestId('cta-official-site'), primary);
    });
    it(`${label}のテーマで App2 の企画の確定・見積の提出・承認・素材登録の確定が主色・ピル形`, () => {
      setOsScheme(dark);
      render(
        <ThemeProvider>
          <PlanQuotePanel />
          <AssetPanel />
        </ThemeProvider>,
      );
      fireEvent.click(screen.getAllByTestId('plan-item')[0]);
      expectPrimaryPill(screen.getByTestId('op-confirm-plan'), primary);
      fireEvent.click(screen.getAllByTestId('quote-item')[0]);
      expectPrimaryPill(screen.getByTestId('op-submit-quote'), primary);
      expectPrimaryPill(screen.getByTestId('op-approve-quote'), primary);
      expectPrimaryPill(screen.getByTestId('asset-register'), primary);
    });
  }
  it('異常系: 表示中に OS のテーマが変わると、同期的に新しい主色になり、切替の間は遷移を止める属性が付く', () => {
    let listener: ((e: { matches: boolean }) => void) | undefined;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => (listener = fn),
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    render(
      <ThemeProvider>
        <App1 />
      </ThemeProvider>,
    );
    expectPrimaryPill(screen.getByTestId('cta-official-site'), PARAM_011);
    listener!({ matches: true });
    expect(document.documentElement.hasAttribute(THEME_SWITCHING_ATTR)).toBe(true);
    expect(css).toMatch(/\[data-theme-switching\] \*[\s\S]*?transition: none !important/);
    expectPrimaryPill(screen.getByTestId('cta-official-site'), PARAM_020);
    document.documentElement.removeAttribute(THEME_SWITCHING_ATTR);
  });
  it('PrimaryButton は appearance を上書きされず、リンク（as="a"）でも主色・ピル形になる', () => {
    render(
      <ThemeProvider>
        <PrimaryButton appearance="subtle" data-testid="b1">
          x
        </PrimaryButton>
        <PrimaryButton as="a" href="#x" data-testid="b2">
          y
        </PrimaryButton>
      </ThemeProvider>,
    );
    expectPrimaryPill(screen.getByTestId('b1'), PARAM_011);
    expectPrimaryPill(screen.getByTestId('b2'), PARAM_011);
    expect(screen.getByTestId('b2').tagName).toBe('A');
  });
});

// NFR-UX-004 AC-090 見出しのフォント指定が PARAM-013、本文が PARAM-014（App1・App2・シェル。計算済みのスタイル）
describe('NFR-UX-004 AC-090 見出しと本文のフォント指定', () => {
  const HEADINGS = 'h1, h2, h3, h4, h5, h6, [role="heading"], .fui-Title1, .fui-Title2, .fui-Title3, .fui-Subtitle1, .fui-Subtitle2, .fui-LargeTitle, .fui-Display';
  const BODY = '.fui-Body1, .fui-Caption1, .fui-Text, p, li, button, label';

  function expectFonts(root: HTMLElement, label: string) {
    const headings = Array.from(root.querySelectorAll<HTMLElement>(HEADINGS));
    expect(headings.length, `${label}: 見出しがある`).toBeGreaterThan(0);
    for (const h of headings) {
      expect(fontList(computed(h, 'font-family')), `${label}: 見出し <${h.tagName}> ${h.textContent?.slice(0, 20)}`).toBe(PARAM_013);
    }
    const bodies = Array.from(root.querySelectorAll<HTMLElement>(BODY)).filter((e) => !e.closest(HEADINGS));
    expect(bodies.length, `${label}: 本文がある`).toBeGreaterThan(0);
    for (const b of bodies) {
      expect(fontList(computed(b, 'font-family')), `${label}: 本文 <${b.tagName}> ${b.textContent?.slice(0, 20)}`).toBe(PARAM_014);
    }
  }

  it('シェル（ヘッダー・アプリの切替を含む）の見出しと本文', () => {
    const { container } = render(
      <ThemeProvider>
        <Shell />
      </ThemeProvider>,
    );
    expectFonts(container, 'シェル');
  });
  it('App1 の見出しと本文', () => {
    const { container } = render(
      <ThemeProvider>
        <App1 />
      </ThemeProvider>,
    );
    expectFonts(container, 'App1');
  });
  it('App2 の見出しと本文（ダークのテーマでも同じ指定）', () => {
    setOsScheme(true);
    const { container } = render(
      <ThemeProvider>
        <PlanQuotePanel />
        <AssetPanel />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getAllByTestId('plan-item')[0]);
    expectFonts(container, 'App2');
  });
  it('FluentProvider の本文の既定（fontFamilyBase）が PARAM-014 で、見出しの変数が PARAM-013', () => {
    const { container } = render(
      <ThemeProvider>
        <span>x</span>
      </ThemeProvider>,
    );
    const provider = container.firstElementChild as HTMLElement;
    expect(fontList(computed(provider, 'font-family'))).toBe(PARAM_014);
    expect(fontList(getComputedStyle(provider).getPropertyValue('--brandFontFamilyDisplay'))).toBe(PARAM_013);
  });
});
