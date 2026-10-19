// NFR-UX-005 の結合テスト（ロゴと商標の扱い: テキストのワードマークと、設定によるロゴの差し替え）
// 期待値は要求定義書の受入基準と PARAM の表から（PARAM-013 見出しのフォント指定）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '../theme/ThemeProvider';
import { resetSettings, updateSettings } from '../settings/store';
import { resetDataset } from '../app2';
import { Shell } from './Shell';
import { BRAND_WORDMARK, BrandMark, brandLogoConfig, resolveBrandLogo } from './BrandMark';

const PARAM_013 = '"Segoe Sans", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

const css = readFileSync('src/theme/global.css', 'utf8');
let styleEl: HTMLStyleElement | null = null;

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
  vi.unstubAllEnvs();
});

// jsdom の getComputedStyle は var() を置換しないため、要素の計算済みのカスタムプロパティで置換する
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
const fontList = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim().replace(/'/g, '"'))
    .join(', ');

// ---------- Microsoft のロゴ・シンボル（四色の正方形）の色の検出 ----------
// 四色それぞれの色の系統（公開されている値と、その近い値）。3 色以上が同じファイル・同じ画面にそろうと、四色の正方形の組合せとみなす
const LOGO_COLOR_FAMILIES: { name: string; hex: string[]; rgb: [number, number, number][] }[] = [
  { name: '赤', hex: ['f25022', 'f35325'], rgb: [[242, 80, 34], [243, 83, 37]] },
  { name: '緑', hex: ['7fba00', '81bc06'], rgb: [[127, 186, 0], [129, 188, 6]] },
  { name: '青', hex: ['00a4ef', '05a6f0'], rgb: [[0, 164, 239], [5, 166, 240]] },
  { name: '黄', hex: ['ffb900', 'ffba08'], rgb: [[255, 185, 0], [255, 186, 8]] },
];
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 6);

/** 文字列（ソース・CSS・SVG・ビルド成果物）に現れるロゴの色の系統 */
function logoFamiliesInText(text: string): string[] {
  const lower = text.toLowerCase();
  const rgbs = Array.from(lower.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)).map((m) => [+m[1], +m[2], +m[3]]);
  return LOGO_COLOR_FAMILIES.filter(
    (f) => f.hex.some((h) => new RegExp(`#${h}(?![0-9a-f])`).test(lower) || lower.includes(`0x${h}`)) || rgbs.some((c) => f.rgb.some((r) => near(c, r))),
  ).map((f) => f.name);
}

/** 画面（DOM）に現れるロゴの色の系統: 要素の属性（style・fill・stroke・SVG）と、画面に効いているスタイルシート（Griffel が挿入した CSS を含む） */
function logoFamiliesInDom(root: HTMLElement): string[] {
  const sheets = Array.from(document.querySelectorAll('style'))
    .map((st) => st.textContent ?? '')
    .join('\n');
  const rules = Array.from(document.styleSheets)
    .flatMap((sh) => {
      try {
        return Array.from(sh.cssRules).map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .join('\n');
  return logoFamiliesInText(`${root.outerHTML}\n${sheets}\n${rules}`);
}

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.svg', '.json', '.map']);
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.avif', '.bmp']);
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const renderShell = () =>
  render(
    <ThemeProvider>
      <Shell />
    </ThemeProvider>,
  );

// NFR-UX-005 AC-095 シェルのヘッダーにテキストのワードマーク「Surface Ultra」が PARAM-013 の書体で表示される
describe('NFR-UX-005 AC-095 テキストのワードマーク', () => {
  it('シェルのヘッダー帯に「Surface Ultra」のワードマークが PARAM-013 の書体で表示される', () => {
    renderShell();
    const header = screen.getByTestId('shell-header');
    const mark = within(header).getByTestId('brand-wordmark');
    expect(mark.textContent).toBe('Surface Ultra');
    expect(BRAND_WORDMARK).toBe('Surface Ultra');
    expect(fontList(resolveVars(mark, getComputedStyle(mark).getPropertyValue('font-family')))).toBe(PARAM_013);
    // 見出し（h1）の中にあり、アクセシブルな名前にワードマークが含まれる
    expect(screen.getByRole('heading', { level: 1, name: /Surface Ultra/ })).toBeTruthy();
  });

  it('どの言語でもワードマークは翻訳されず「Surface Ultra」のまま（商標の表記）', () => {
    for (const lang of ['en', 'zh', 'ko', 'ja'] as const) {
      updateSettings({ lang });
      renderShell();
      expect(within(screen.getByTestId('shell-header')).getByTestId('brand-wordmark').textContent).toBe('Surface Ultra');
      cleanup();
    }
  });

  it('ロゴの設定がないとき、ヘッダー帯に画像・SVG の図形を置かない（ロゴを自作・再現しない）', () => {
    renderShell();
    const header = screen.getByTestId('shell-header');
    expect(header.querySelectorAll('img, svg, canvas, picture, object, embed')).toHaveLength(0);
    expect(within(header).queryByTestId('brand-logo')).toBeNull();
  });

  it('異常系: シェル・App1・App2 の画面に、Microsoft のロゴ・シンボルの四色の組合せ（3 色以上）が現れない', async () => {
    const { container } = renderShell();
    await screen.findByTestId('app-root-app1', undefined, { timeout: 10000 });
    const app1 = logoFamiliesInDom(container);
    expect(app1.length, `App1 表示中: ${app1.join('・')}`).toBeLessThan(3);
    fireEvent.click(screen.getByTestId('app-toggle-app2'));
    await screen.findByTestId('app-root-app2', undefined, { timeout: 10000 });
    const app2 = logoFamiliesInDom(container);
    expect(app2.length, `App2 表示中: ${app2.join('・')}`).toBeLessThan(3);
  }, 30000);

  it('異常系: ソースとビルド成果物（dist）に、ロゴ・シンボルを模した画像・SVG・CSS の図形（四色の組合せ）が含まれない', () => {
    const files = [...walk('src'), ...walk('public'), ...walk('dist'), 'index.html'].filter((f) => existsSync(f));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const ext = extname(f).toLowerCase();
      if (/(microsoft|msft|ms[-_]?logo|windows[-_]?logo|surface[-_]?logo|four[-_]?squares?)/i.test(f) && IMAGE_EXT.has(ext)) offenders.push(`${f}: ロゴの名前の画像`);
      if (!TEXT_EXT.has(ext) || f.endsWith('brandmark.test.tsx')) continue;
      const fams = logoFamiliesInText(readFileSync(f, 'utf8'));
      if (fams.length >= 3) offenders.push(`${f}: ${fams.join('・')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('検出の確認: 四色の正方形を描く SVG・CSS は検出される（検出器が働いている）', () => {
    const svg = '<svg><rect fill="#F25022"/><rect fill="#7FBA00"/><rect fill="#00A4EF"/><rect fill="#FFB900"/></svg>';
    expect(logoFamiliesInText(svg)).toHaveLength(4);
    expect(logoFamiliesInText('.a{background:rgb(242, 80, 34)}.b{background:rgb(127,186,0)}.c{background:rgb(0 164 239)}')).toHaveLength(3);
    const host = document.createElement('div');
    host.innerHTML = '<span style="background-color:#f25022"></span><span style="background-color:#7fba00"></span><span style="background-color:#00a4ef"></span>';
    document.body.appendChild(host);
    expect(logoFamiliesInDom(host)).toHaveLength(3);
    host.remove();
  });
});

// NFR-UX-005 AC-096 設定でロゴファイルに差し替えられ、指定なし・読み込み失敗ではワードマークに戻る
describe('NFR-UX-005 AC-096 ロゴの差し替え', () => {
  const logos = { light: '/brand/surface-logo-gray.svg', dark: '/brand/surface-logo-white.svg' };

  it('暗い面には暗い背景用（白）、明るい面には明るい背景用（グレー）のロゴを、アクセシブルな名前つきで表示する', () => {
    render(
      <ThemeProvider>
        <div data-testid="on-dark">
          <BrandMark surface="dark" logos={logos} />
        </div>
        <div data-testid="on-light">
          <BrandMark surface="light" logos={logos} />
        </div>
      </ThemeProvider>,
    );
    const dark = within(screen.getByTestId('on-dark')).getByRole('img', { name: 'Surface Ultra' });
    const light = within(screen.getByTestId('on-light')).getByRole('img', { name: 'Surface Ultra' });
    expect(dark.getAttribute('src')).toBe(logos.dark);
    expect(light.getAttribute('src')).toBe(logos.light);
    expect(screen.queryByTestId('brand-wordmark')).toBeNull();
  });

  it('ロゴは元の縦横比のまま（高さだけを決め、幅は auto・object-fit: contain。幅と高さの両方を固定しない）', () => {
    render(
      <ThemeProvider>
        <BrandMark surface="dark" logos={logos} />
      </ThemeProvider>,
    );
    const img = screen.getByTestId('brand-logo');
    const cs = getComputedStyle(img);
    expect(cs.width).toBe('auto');
    expect(cs.objectFit).toBe('contain');
    expect(resolveVars(img, cs.height)).not.toBe('auto');
    expect(img.hasAttribute('width')).toBe(false);
    expect(img.hasAttribute('height')).toBe(false);
  });

  it('環境変数 VITE_BRAND_LOGO_DARK を指定すると、シェルのヘッダー帯（暗い面）が暗い背景用のロゴになる', () => {
    vi.stubEnv('VITE_BRAND_LOGO_LIGHT', logos.light);
    vi.stubEnv('VITE_BRAND_LOGO_DARK', logos.dark);
    renderShell();
    const header = screen.getByTestId('shell-header');
    const img = within(header).getByRole('img', { name: 'Surface Ultra' });
    expect(img.getAttribute('src')).toBe(logos.dark);
    expect(within(header).queryByTestId('brand-wordmark')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /Surface Ultra/ })).toBeTruthy();
  });

  it('異常系: ロゴが読み込めないときはワードマークに戻り、ヘッダーのトグルも残る', () => {
    vi.stubEnv('VITE_BRAND_LOGO_DARK', '/brand/missing.svg');
    renderShell();
    const header = screen.getByTestId('shell-header');
    fireEvent.error(within(header).getByTestId('brand-logo'));
    expect(within(header).queryByTestId('brand-logo')).toBeNull();
    expect(within(header).getByTestId('brand-wordmark').textContent).toBe('Surface Ultra');
    expect(within(header).getByTestId('app-toggle-app1')).toBeTruthy();
    expect(within(header).getByTestId('app-toggle-app2')).toBeTruthy();
  });

  it('異常系: 指定がない・空白だけ・暗い背景用がないときは、ワードマークを表示する（明るい背景用を暗い面に流用しない）', () => {
    vi.stubEnv('VITE_BRAND_LOGO_LIGHT', logos.light);
    vi.stubEnv('VITE_BRAND_LOGO_DARK', '   ');
    renderShell();
    const header = screen.getByTestId('shell-header');
    expect(within(header).queryByTestId('brand-logo')).toBeNull();
    expect(within(header).getByTestId('brand-wordmark').textContent).toBe('Surface Ultra');
    cleanup();
    render(<BrandMark surface="light" logos={{}} />);
    expect(screen.getByTestId('brand-wordmark')).toBeTruthy();
  });

  it('異常系: 画像として扱えない値（javascript: など）は未指定とみなす', () => {
    expect(resolveBrandLogo(undefined)).toBeUndefined();
    expect(resolveBrandLogo('  ')).toBeUndefined();
    expect(resolveBrandLogo('javascript:alert(1)')).toBeUndefined();
    expect(resolveBrandLogo(' /brand/logo.svg ')).toBe('/brand/logo.svg');
    expect(resolveBrandLogo('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    expect(resolveBrandLogo('data:image/svg+xml;base64,AAAA')).toBe('data:image/svg+xml;base64,AAAA');
    expect(brandLogoConfig({ VITE_BRAND_LOGO_LIGHT: './l.png' })).toEqual({ light: './l.png', dark: undefined });
  });
});
