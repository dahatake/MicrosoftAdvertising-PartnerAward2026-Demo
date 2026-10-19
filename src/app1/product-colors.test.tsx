import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FluentProvider } from '@fluentui/react-components';
import { resetSettings } from '../settings/store';
import { BRAND, brandDarkTheme, brandLightTheme, kindPalette } from '../theme/theme';
import {
  chroma,
  contrastRatio,
  DEFAULT_FINISH,
  metalGradient,
  PRODUCT_FINISHES,
  PRODUCT_GLASS,
  PRODUCT_LIGHTING,
  withAlpha,
  type ProductFinishId,
} from './brand';
import { ProductView } from './ProductView';

const FINISH_IDS = Object.keys(PRODUCT_FINISHES) as ProductFinishId[];
const DARK_SURFACES = BRAND.surfaceDark; // PARAM-022

beforeEach(() => {
  localStorage.clear();
  resetSettings(['en']);
});
afterEach(cleanup);

// NFR-UX-004 AC-094 製品色: Dune は SRC-009 で確かめた値、Platinum・Black・Sapphire は [ASSUMPTION] の仮置き
describe('NFR-UX-004 AC-094 製品色の定義', () => {
  it('Dune は #F9F7F1（SRC-009）で確認済み、ほかの 3 色は仮置き（confirmed=false）で、既定は Dune', () => {
    expect(PRODUCT_FINISHES.dune.base).toBe('#F9F7F1');
    expect(PRODUCT_FINISHES.dune.confirmed).toBe(true);
    expect(FINISH_IDS.sort()).toEqual(['black', 'dune', 'platinum', 'sapphire']);
    for (const id of ['platinum', 'black', 'sapphire'] as const) expect(PRODUCT_FINISHES[id].confirmed).toBe(false);
    expect(DEFAULT_FINISH).toBe('dune');
    for (const id of FINISH_IDS) expect(PRODUCT_FINISHES[id].id).toBe(id);
  });

  it.each(FINISH_IDS)('%s は落ち着いた色（原色・蛍光色でない: 彩度の目安 0.25 以下）', (id) => {
    const f = PRODUCT_FINISHES[id];
    for (const c of [f.base, f.highlight, f.shade, f.keys, f.edge]) expect(chroma(c), `${id} ${c}`).toBeLessThanOrEqual(0.25);
  });

  it.each(FINISH_IDS)('%s は上質な金属の素材（metalness 0.75 以上・roughness 0.25〜0.5）で、面の明るさは highlight > base > shade', (id) => {
    const f = PRODUCT_FINISHES[id];
    expect(f.metalness).toBeGreaterThanOrEqual(0.75);
    expect(f.metalness).toBeLessThanOrEqual(1);
    expect(f.roughness).toBeGreaterThanOrEqual(0.25);
    expect(f.roughness).toBeLessThanOrEqual(0.5);
    // 2D の金属のグラデーションが光の当たる側から影の側へ暗くなる（金属らしい陰影）
    expect(contrastRatio(f.highlight, '#000000')).toBeGreaterThan(contrastRatio(f.base, '#000000'));
    expect(contrastRatio(f.base, '#000000')).toBeGreaterThan(contrastRatio(f.shade, '#000000'));
  });
});

// NFR-UX-004 AC-094 暗い面（PARAM-022）の上で製品の輪郭が埋もれない
describe('NFR-UX-004 AC-094 暗い面の上の輪郭', () => {
  it.each(FINISH_IDS)('%s の縁の色は、暗い面の 2 色のどちらとも 3:1 以上（WCAG 1.4.11 の非テキストの目安）', (id) => {
    for (const bg of DARK_SURFACES) expect(contrastRatio(PRODUCT_FINISHES[id].edge, bg), `${id} on ${bg}`).toBeGreaterThanOrEqual(3);
  });

  it.each(['dune', 'platinum'] as const)('明るい製品色 %s は、地の色そのものが暗い面と 3:1 以上', (id) => {
    for (const bg of DARK_SURFACES) expect(contrastRatio(PRODUCT_FINISHES[id].base, bg)).toBeGreaterThanOrEqual(3);
  });

  it('暗い製品色（Black・Sapphire）は、光の当たる面（highlight）が地の色より暗い面と見分けやすい', () => {
    for (const id of ['black', 'sapphire'] as const) {
      const f = PRODUCT_FINISHES[id];
      for (const bg of DARK_SURFACES) expect(contrastRatio(f.highlight, bg)).toBeGreaterThan(contrastRatio(f.base, bg));
    }
  });

  it('背後からのリムライトが 2 灯以上あり、光の色はブランドの光のグラデーション（PARAM-023）から取る', () => {
    expect(PRODUCT_LIGHTING.rim.length).toBeGreaterThanOrEqual(2);
    for (const r of PRODUCT_LIGHTING.rim) {
      expect(BRAND.glow).toContain(r.color);
      expect(r.position[2]).toBeLessThan(0); // カメラ（+z）から見て製品の後ろ
      expect(r.intensity).toBeGreaterThan(PRODUCT_LIGHTING.ambient.intensity);
    }
    expect(BRAND.glow).toContain(PRODUCT_LIGHTING.fill.color);
    expect(PRODUCT_LIGHTING.environmentIntensity).toBeGreaterThan(0);
  });

  it('画面のガラスはブランドの光（PARAM-023）と暗い面（PARAM-022）の色で、クリアコートのつやを持つ', () => {
    expect(PRODUCT_GLASS.glow).toEqual(BRAND.glow);
    expect(DARK_SURFACES).toContain(PRODUCT_GLASS.base);
    expect(DARK_SURFACES).toContain(PRODUCT_GLASS.baseEnd);
    expect(PRODUCT_GLASS.clearcoat).toBe(1);
    expect(PRODUCT_GLASS.clearcoatRoughness).toBeLessThan(0.2);
  });
});

describe('NFR-UX-004 AC-094 色の計算', () => {
  it('コントラスト比は WCAG の定義どおり（白と黒で 21、同じ色で 1）', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#F9F7F1', '#F9F7F1')).toBe(1);
  });
  it('withAlpha は 8 桁の 16 進を返し、範囲外は丸める', () => {
    expect(withAlpha('#34BFFB', 0.5)).toBe('#34BFFB80');
    expect(withAlpha('#34BFFB', 2)).toBe('#34BFFBFF');
    expect(withAlpha('#34BFFB', -1)).toBe('#34BFFB00');
  });
  it('metalGradient は製品色の 3 段のグラデーション', () => {
    const f = PRODUCT_FINISHES.dune;
    expect(metalGradient(f)).toBe(`linear-gradient(145deg, ${f.highlight} 0%, ${f.base} 45%, ${f.shade} 100%)`);
  });
  it('種類の色（kindPalette）の意味づけは変えない', () => {
    expect(kindPalette).toEqual(['#0f6cbd', '#c4314b', '#13a10e', '#c239b3', '#ca5010', '#038387', '#8764b8', '#986f0b']);
  });
});

// NFR-UX-004 AC-094 / FR-005 AC-014: 2D の製品図は既定の製品色で、ライト・ダークのどちらでも同じ製品と説明文を表示する
describe('NFR-UX-004 AC-094 2D の製品図', () => {
  it.each([
    ['light', brandLightTheme],
    ['dark', brandDarkTheme],
  ])('%s のテーマでも 2D の製品図が既定の製品色（Dune）で、アクセシブルな名前を持つ', (_name, theme) => {
    render(
      <FluentProvider theme={theme}>
        <ProductView />
      </FluentProvider>,
    );
    const view = screen.getByTestId('product-view-2d');
    expect(view.getAttribute('data-product-finish')).toBe(PRODUCT_FINISHES[DEFAULT_FINISH].name);
    expect(view.getAttribute('role')).toBe('img');
    expect(view.getAttribute('aria-label')?.length).toBeGreaterThan(0);
    expect(screen.getByTestId('product-description')).toBeTruthy();
  });
});
