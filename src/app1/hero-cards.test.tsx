// NFR-UX-004 の結合テスト（App1 のヒーローとリッチなカード）
// AC-091（ヒーローの構造・暗い面と光のグラデーション・製品のビジュアルの名前・主 CTA）は System Test（tests/system/brand.spec.ts）が
// 実際の描画で判定する。ここでは、その前提となる構造と計算済みのスタイルを jsdom で確かめる。
// AC-092（価値説明と利用シーンのカード: 角丸 PARAM-024・影・グラデーション、「動きを減らす」で出現の動きが PARAM-007 の 0 ミリ秒）。
// jsdom の getComputedStyle は var() を置換しないため、要素の計算済みのカスタムプロパティで置換して判定する（resolveVars）。
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { tokens } from '@fluentui/react-components';
import { ThemeProvider } from '../theme/ThemeProvider';
import { App1 } from '../apps/App1';
import { resetSettings } from '../settings/store';
import { app1Text } from './content';
import { REDUCED_MOTION_MS, revealMotion } from './reveal';
import { OFFICIAL_SITE_URL } from './config';

// 期待値は要求定義書の PARAM の表から
const PARAM_007_MS = 0;
const PARAM_022 = ['#0A1522', '#021C3F'];
const PARAM_023 = ['#0538C7', '#34BFFB', '#AADFFF'];
const PARAM_024_REM = [0.75, 1.5];
const ROOT_FONT_PX = 16;

const css = readFileSync('src/theme/global.css', 'utf8');
let styleEl: HTMLStyleElement | null = null;
const realMatchMedia = window.matchMedia;

/** OS の設定（ライト/ダーク、動きを減らす）を差し替える */
function setOs({ dark = false, reduce = false }: { dark?: boolean; reduce?: boolean }) {
  window.matchMedia = ((q: string) => ({
    matches: (dark && q.includes('prefers-color-scheme: dark')) || (reduce && q.includes('prefers-reduced-motion: reduce')),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
});
afterEach(() => {
  cleanup();
  styleEl?.remove();
  window.matchMedia = realMatchMedia;
});

function resolveVars(el: Element, value: string, depth = 0): string {
  const start = value.indexOf('var(');
  if (start < 0 || depth > 30) return value;
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
const toPx = (v: string) => (v.endsWith('rem') ? parseFloat(v) * ROOT_FONT_PX : parseFloat(v));
const radiusOf = (el: Element) =>
  computed(el, 'border-radius') ||
  ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => computed(el, `border-${c}-radius`)).join(' ');

function renderApp1(os: { dark?: boolean; reduce?: boolean } = {}) {
  setOs(os);
  return render(
    <ThemeProvider>
      <App1 />
    </ThemeProvider>,
  );
}

/** カード: 角丸の半径が PARAM-024 の範囲、影がある、グラデーションまたは画像を含む */
function expectRichCard(el: HTMLElement, label: string) {
  const radius = radiusOf(el);
  const parts = radius.split(/[\s/]+/).filter(Boolean);
  expect(parts.length, `${label}: 角丸 ${radius}`).toBeGreaterThan(0);
  for (const r of parts) {
    const px = toPx(r);
    expect(px, `${label}: 角丸 ${r} が ${PARAM_024_REM[0]}rem 以上`).toBeGreaterThanOrEqual(PARAM_024_REM[0] * ROOT_FONT_PX);
    expect(px, `${label}: 角丸 ${r} が ${PARAM_024_REM[1]}rem 以下`).toBeLessThanOrEqual(PARAM_024_REM[1] * ROOT_FONT_PX);
  }
  const shadow = computed(el, 'box-shadow');
  expect(shadow, `${label}: 影`).not.toBe('');
  expect(shadow, `${label}: 影`).not.toBe('none');
  const images = [el, ...Array.from(el.querySelectorAll('*'))].map((e) => computed(e, 'background-image')).join(' | ');
  expect(images, `${label}: グラデーションまたは画像`).toMatch(/gradient\(|url\(/);
}

// NFR-UX-004 AC-091 ヒーローの構造（全幅の帯の中に大きな見出し・副題・製品のビジュアル・主 CTA）
describe('NFR-UX-004 AC-091 App1 のヒーロー', () => {
  for (const dark of [false, true]) {
    it(`OS が${dark ? 'ダーク' : 'ライト'}でもヒーローは暗い面（PARAM-022）と光のグラデーション（PARAM-023）`, () => {
      renderApp1({ dark });
      const hero = screen.getByTestId('app1-hero');
      const bg = computed(hero, 'background-color').toUpperCase();
      const img = computed(hero, 'background-image').toUpperCase();
      expect(img).toMatch(/GRADIENT\(/);
      expect([bg, img].join(' ')).toMatch(new RegExp(PARAM_022.join('|')));
      expect(img).toMatch(new RegExp(PARAM_023.join('|')));
      // 暗い面の上の文字は白（OS のテーマに追従しない）
      const heading = within(hero).getByRole('heading', { level: 2 });
      expect(computed(heading, 'color').toUpperCase()).toBe('#FFFFFF');
    });
  }
  it('見出し・副題・主 CTA（公式サイトを新しいタブで開く FR-003 AC-007）・名前を持つ製品のビジュアルがヒーローの中にある', () => {
    renderApp1();
    const hero = screen.getByTestId('app1-hero');
    const text = app1Text.ja;
    expect(within(hero).getByRole('heading', { level: 2 }).textContent).toBe(text.heroHeading);
    expect(hero.textContent).toContain(text.heroLead);
    const cta = within(hero).getByTestId('cta-official-site');
    expect(cta.getAttribute('href')).toBe(OFFICIAL_SITE_URL);
    expect(cta.getAttribute('target')).toBe('_blank');
    const visual = within(hero).getByTestId('app1-hero-visual');
    expect(visual.getAttribute('role')).toBe('img');
    expect(visual.getAttribute('aria-label')).toBe(text.heroVisualLabel);
    expect(within(hero).getByRole('img', { name: text.heroVisualLabel })).toBe(visual);
  });
  // NFR-UX-004 AC-091 大きな見出し: 文字は Fluent の type ramp のトークン（直書きの値・clamp を使わない。幅の切替は WIDE のメディアクエリ）
  it('見出しは Hero の type ramp、副題は Base500 のトークンの大きさと行の高さ（狭い幅の既定）', () => {
    renderApp1();
    const hero = screen.getByTestId('app1-hero');
    const heading = within(hero).getByRole('heading', { level: 2 });
    const lead = within(hero).getByText(app1Text.ja.heroLead);
    const pairs: [HTMLElement, string, string][] = [
      [heading, 'font-size', tokens.fontSizeHero800],
      [heading, 'line-height', tokens.lineHeightHero800],
      [lead, 'font-size', tokens.fontSizeBase500],
      [lead, 'line-height', tokens.lineHeightBase500],
    ];
    for (const [el, prop, token] of pairs) {
      const raw = getComputedStyle(el).getPropertyValue(prop);
      expect(raw, `${prop} は直書きの値でない`).not.toMatch(/clamp\(|vw/);
      expect(computed(el, prop), `${prop} = ${token}`).toBe(resolveVars(el, token));
      expect(computed(el, prop)).toMatch(/^\d+px$/);
    }
    expect(toPx(computed(heading, 'font-size'))).toBeGreaterThan(toPx(computed(lead, 'font-size')));
  });
  it('4 言語に製品のビジュアルの名前と導入の文言がある', () => {
    for (const t of Object.values(app1Text)) {
      expect(t.heroVisualLabel.trim()).not.toBe('');
      expect(t.heroEyebrow.trim()).not.toBe('');
    }
  });
});

// NFR-UX-004 AC-092 価値説明と利用シーンのリッチなカード
describe('NFR-UX-004 AC-092 価値説明と利用シーンのカード', () => {
  for (const dark of [false, true]) {
    it(`${dark ? 'ダーク' : 'ライト'}のテーマで、カードの角丸が PARAM-024 の範囲・影・グラデーションを持つ`, () => {
      renderApp1({ dark });
      const values = screen.getAllByTestId('value-card');
      const scenes = screen.getAllByTestId('scene-card');
      expect(values.length).toBe(app1Text.ja.valuePoints.length);
      expect(scenes.length).toBe(app1Text.ja.scenes.p1.length);
      values.forEach((c, i) => expectRichCard(c, `価値説明のカード ${i + 1}`));
      scenes.forEach((c, i) => expectRichCard(c, `利用シーンのカード ${i + 1}`));
    });
  }

  it('「動きを減らす」のとき出現の動きは PARAM-007（0 ミリ秒）で、最初から最終の状態（不透明・移動なし）', () => {
    expect(REDUCED_MOTION_MS).toBe(PARAM_007_MS);
    for (const i of [0, 1, 5]) {
      const m = revealMotion(true, i);
      expect(m.initial).toBe(false);
      expect(m.whileInView).toBeUndefined();
      expect(m.animate).toBeUndefined();
      const tr = m.transition as { duration?: number; delay?: number };
      expect((tr.duration ?? 0) * 1000).toBe(PARAM_007_MS);
      expect((tr.delay ?? 0) * 1000).toBe(PARAM_007_MS);
    }
    renderApp1({ reduce: true });
    const animated = [...screen.getAllByTestId('value-card'), ...screen.getAllByTestId('scene-card').map((c) => c.parentElement!)];
    for (const el of animated) {
      expect(['', '1']).toContain(el.style.opacity);
      expect(['', 'none']).toContain(el.style.transform);
    }
  });

  it('通常は出現の動きがある（隠れた状態から始まる）', () => {
    const m = revealMotion(false, 2);
    expect(m.initial).toMatchObject({ opacity: 0 });
    // 画面に入ったとき（IntersectionObserver がない環境では表示時）に不透明・移動なしへ動く
    expect(m.whileInView ?? m.animate).toMatchObject({ opacity: 1, y: 0 });
    expect((m.transition as { duration: number }).duration).toBeGreaterThan(0);
    renderApp1({ reduce: false });
    const first = screen.getAllByTestId('value-card')[0];
    expect(first.style.opacity).toBe('0');
  });

  it('異常系: 「動きを減らす」でも内容と操作は失われない（文言がすべてあり、ペルソナの切替で利用シーンが変わる）', () => {
    renderApp1({ reduce: true });
    const text = app1Text.ja;
    for (const v of text.valuePoints) expect(screen.getByText(v.title)).toBeTruthy();
    for (const sc of text.scenes.p1) expect(screen.getByText(sc.title)).toBeTruthy();
    fireEvent.click(screen.getByTestId('persona-select-p2'));
    expect(screen.getByTestId('persona-select-p2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('persona-select-p1').getAttribute('aria-pressed')).toBe('false');
    for (const sc of text.scenes.p2) expect(screen.getByText(sc.title)).toBeTruthy();
    for (const c of screen.getAllByTestId('scene-card')) expect(['', '1']).toContain(c.parentElement!.style.opacity);
    fireEvent.click(screen.getByTestId('presentation-start'));
    expect(screen.getByTestId('presentation-root')).toBeTruthy();
  });
});
