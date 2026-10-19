// NFR-UX-004 AC-093 の結合テスト: App2（広告素材管理）の画面のブランドの形（計算済みのスタイルの検査）。
// 主操作のボタンはピル形、パネル・カードの角丸は PARAM-024 の範囲、ライトのテーマのページの面は PARAM-021、
// App2 のページの見出し帯は PARAM-022 の暗い面に PARAM-023 の光のグラデーション。全幅のヒーローと入場のアニメーションを持たない。
// jsdom の getComputedStyle は var() を置換しないため、その要素の計算済みのカスタムプロパティで置換して判定する（resolveVars）。
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { brandDarkTheme } from '../theme/theme';
import { App2 } from '../apps/App2';
import { resetDataset, resetPersona } from './index';
import { resetAllLayouts } from '../layout/store';
import { resetSettings } from '../settings/store';

// 期待値は要求定義書の PARAM の表から
const PARAM_011 = '#0067B8';
const PARAM_012 = 4.5;
const PARAM_020 = '#2A66B2';
const PARAM_021 = '#F5F5F7';
const PARAM_022 = ['#0A1522', '#021C3F'];
const PARAM_023 = ['#0538C7', '#34BFFB', '#AADFFF'];
const PARAM_024_PX = [0.75 * 16, 1.5 * 16];

const css = readFileSync('src/theme/global.css', 'utf8');
let styleEl: HTMLStyleElement | null = null;
const realMatchMedia = window.matchMedia;

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
  resetAllLayouts();
  resetSettings(['ja']);
  resetPersona();
  resetDataset();
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
/** 角丸の 4 つの値（jsdom は var() を含む一括指定を各角に展開しないため、一括指定を解決する） */
const radii = (el: Element) => {
  const r = computed(el, 'border-radius') || ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => computed(el, `border-${c}-radius`)).join(' ');
  return r.split(/[\s/]+/).filter(Boolean);
};
const toPx = (v: string) => (v.endsWith('rem') ? parseFloat(v) * 16 : parseFloat(v));

const rgb = (hex: string) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
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

function renderApp2(dark: boolean) {
  setOsScheme(dark);
  return render(
    <ThemeProvider>
      <App2 />
    </ThemeProvider>,
  );
}

const SCHEMES = [
  [false, PARAM_011, 'ライト'],
  [true, PARAM_020, 'ダーク'],
] as const;

describe('NFR-UX-004 AC-093 App2 のブランドの形', () => {
  for (const [dark, primary, label] of SCHEMES) {
    // NFR-UX-004 AC-093 主操作のボタンはピル形・主色
    it(`${label}のテーマで App2 の主操作のボタンがすべて主色のピル形（文字とのコントラスト比 4.5 以上）`, () => {
      renderApp2(dark);
      // 企画の確定（FR-020）を出すため企画を選び、What-If の実行を出すため制作プロジェクトを選ぶ
      fireEvent.click(screen.getAllByTestId('plan-item')[0]);
      fireEvent.click(screen.getAllByTestId('project-item')[0]);
      const root = screen.getByTestId('app-root-app2');
      for (const id of ['op-confirm-plan', 'asset-register', 'order-register', 'whatif-run']) {
        expect(screen.getByTestId(id).classList.contains('brand-primary-button'), `${id} は PrimaryButton`).toBe(true);
      }
      const buttons = Array.from(root.querySelectorAll<HTMLElement>('.brand-primary-button'));
      expect(buttons.length).toBeGreaterThanOrEqual(4);
      for (const el of buttons) {
        const id = el.getAttribute('data-testid');
        expect(computed(el, 'background-color').toUpperCase(), `${id} の背景`).toBe(primary);
        for (const r of radii(el)) expect(parseFloat(r), `${id} の角丸`).toBeGreaterThanOrEqual(1000);
        expect(contrast(computed(el, 'color'), primary), `${id} の文字`).toBeGreaterThanOrEqual(PARAM_012);
      }
    });

    // NFR-UX-004 AC-093 パネル・カードの角丸が PARAM-024 の範囲
    it(`${label}のテーマで App2 のパネルとカード（素材・発注の行、詳細）の角丸が PARAM-024（.75〜1.5rem）の範囲`, () => {
      renderApp2(dark);
      // 詳細のカードを出すためキャンペーンを選ぶ
      fireEvent.click(screen.getAllByTestId('campaign-item')[0]);
      const root = screen.getByTestId('app-root-app2');
      const panels = Array.from(root.querySelectorAll('[data-testid^="layout-panel-"]'));
      const cards = [
        ...panels,
        screen.getAllByTestId('asset-row')[0],
        screen.getAllByTestId('order-row')[0],
        screen.getByTestId('node-detail-empty'),
      ];
      expect(panels.length).toBe(11);
      for (const el of cards) {
        const parts = radii(el);
        expect(parts.length, `${el.getAttribute('data-testid')} の角丸`).toBeGreaterThan(0);
        for (const r of parts) {
          const px = toPx(r);
          expect(px, `${el.getAttribute('data-testid')} の角丸 ${r}`).toBeGreaterThanOrEqual(PARAM_024_PX[0]);
          expect(px, `${el.getAttribute('data-testid')} の角丸 ${r}`).toBeLessThanOrEqual(PARAM_024_PX[1]);
        }
      }
      // パネルは影を持つカード
      for (const el of panels) expect(computed(el, 'box-shadow')).not.toMatch(/^(none)?$/);
    });

    // NFR-UX-004 AC-093 見出し帯は暗い面＋光のグラデーション（テーマによらない）
    it(`${label}のテーマで App2 のページの見出し帯が PARAM-022 の暗い面に PARAM-023 の光のグラデーションを重ねる`, () => {
      renderApp2(dark);
      const band = screen.getByTestId('app2-heading-band');
      expect(band.contains(screen.getByRole('heading', { level: 2 }))).toBe(true);
      expect(computed(band, 'background-color').toUpperCase()).toBe(PARAM_022[0]);
      const image = computed(band, 'background-image').toUpperCase();
      expect(image).toMatch(/GRADIENT\(/);
      for (const c of [...PARAM_023, PARAM_022[1]]) expect(image, `グラデーションの色 ${c}`).toContain(c);
      // 帯の上の見出しと説明の文字は、暗い面に対してコントラスト比 PARAM-012 以上
      const heading = screen.getByRole('heading', { level: 2 });
      const lead = band.querySelector('p')!;
      for (const el of [heading, lead]) {
        for (const bg of PARAM_022) expect(contrast(computed(el, 'color'), bg)).toBeGreaterThanOrEqual(PARAM_012);
      }
    });

    // NFR-UX-004 AC-093 全幅のヒーローと、装飾の出現アニメーションを持たない
    it(`${label}のテーマで App2 は全幅のヒーロー（ビューポートの高さの半分以上の帯）と入場のアニメーションを持たない`, () => {
      renderApp2(dark);
      const root = screen.getByTestId('app-root-app2');
      // 文書のスタイルシート（Griffel・global.css）から、入場のアニメーション（animation-name）か、
      // 高さを vh 系の単位で 50 以上にする規則を集め、その規則が App2 のどの要素にも当たらないことを確かめる
      // （全要素の getComputedStyle は jsdom で遅いため、規則から当たる要素を引く）
      const tallVh = (v: string) => {
        const m = /(\d+(?:\.\d+)?)(s|d|l)?vh/.exec(v);
        return m ? parseFloat(m[1]) >= 50 : false;
      };
      const offending: string[] = [];
      const visit = (rules: CSSRuleList, inMedia: boolean) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule) {
            // 「動きを減らす」などのメディアの規則の中も見る（中の animation-name: none は対象外）
            visit(rule.cssRules, true);
            continue;
          }
          if (!(rule instanceof CSSStyleRule)) continue;
          const st = rule.style;
          const anim = st.getPropertyValue('animation-name') || st.getPropertyValue('animation');
          const animates = !!anim && !/^\s*none\b/.test(anim) && !/^0s\b/.test(anim);
          const tall = tallVh(st.getPropertyValue('height')) || tallVh(st.getPropertyValue('min-height'));
          if (!animates && !tall) continue;
          let hits: Element[] = [];
          try {
            hits = [root, ...Array.from(root.querySelectorAll('*'))].filter((el) => el.matches(rule.selectorText));
          } catch {
            continue; // jsdom が解釈できない選択子（疑似要素など）は要素に当たらない
          }
          if (hits.length) offending.push(`${inMedia ? '@media ' : ''}${rule.selectorText} { ${st.cssText} }`);
        }
      };
      for (const sheet of Array.from(document.styleSheets)) visit(sheet.cssRules, false);
      expect(offending).toEqual([]);
      // インラインのスタイルでも、入場の動きと高い帯を持たない
      for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('[style]'))] as HTMLElement[]) {
        expect(el.style.animationName || '', `${el.tagName} のインラインの animation`).toMatch(/^(none)?$/);
        expect(tallVh(el.style.height) || tallVh(el.style.minHeight), `${el.tagName} のインラインの高さ`).toBe(false);
      }
      // 見出し帯とパネル・カードは、入場の動きの初期状態（透明・移動）を持たない
      const band = screen.getByTestId('app2-heading-band');
      const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="layout-panel-"]'));
      for (const el of [band, ...panels]) {
        const cs = getComputedStyle(el);
        expect(['', '1']).toContain(cs.getPropertyValue('opacity').trim());
        expect(['', 'none']).toContain(cs.getPropertyValue('transform').trim());
        expect(['', 'none', 'all 0s ease 0s']).toContain(cs.getPropertyValue('transition').trim());
        expect(el.style.opacity).toBe('');
        expect(el.style.transform).toBe('');
      }
      // 見出し帯は中身の分の高さ（最小の高さを持たない）
      expect(['', '0', '0px', 'auto']).toContain(getComputedStyle(band).getPropertyValue('min-height').trim());
    });
  }

  // NFR-UX-004 AC-093 ページの面: ライトのテーマは PARAM-021、ダークはテーマの面に追従
  it('ライトのテーマでページの面が PARAM-021、ダークのテーマではテーマの面（PARAM-021 ではない）', () => {
    renderApp2(false);
    expect(computed(screen.getByTestId('app-root-app2'), 'background-color').toUpperCase()).toBe(PARAM_021);
    cleanup();
    renderApp2(true);
    const darkBg = computed(screen.getByTestId('app-root-app2'), 'background-color').toUpperCase();
    expect(darkBg).toBe(brandDarkTheme.colorNeutralBackground2.toUpperCase());
    expect(darkBg).not.toBe(PARAM_021);
  });
});
