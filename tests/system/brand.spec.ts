// System Test: Surface ブランドのビジュアル表現（NFR-UX-004 の system の受入基準 AC-089・AC-091・AC-116）
// 期待値は docs/requirements-definition.md の受入基準と PARAM の表だけから決めている（実装コードは正解にしない）。
//   PARAM-011 #0067B8（ライトの主色）/ PARAM-020 #2A66B2（ダークの主色）/ PARAM-012 4.5（最小コントラスト比）
//   PARAM-022 #0A1522・#021C3F（暗い面）/ PARAM-023 #0538C7・#34BFFB・#AADFFF（光のグラデーションの色）
// ライト/ダークは page.emulateMedia({ colorScheme }) で OS の設定として切り替える（NFR-UX-001 のテーマ追従）。
// 文字のコントラスト比は、文字を透明にした要素の実際の描画（スクリーンショットの画素）を背景として、
// 文字の色との最悪の比（背景の画素の輝度の 1〜99 パーセンタイル）で判定する（グラデーションの上の文字のため）。
//
// 画面の契約（実装が付ける data-testid。変更が必要なら競合として返す）:
//  シェル : shell-header   … FR-001 のアプリ切替のトグルを含むヘッダー帯。暗い面とグラデーションの背景は
//                            この要素自身か、その ::before / ::after の計算済みのスタイルに置く
//           brand-wordmark … テキストのワードマーク「Surface Ultra」（NFR-UX-005 AC-095。shell-header の中）
//           app-toggle-app1 / app-toggle-app2（既存）… トグルの各項目。選択中の項目は、この要素自身が主色の背景・
//                            ピル形を持ち、選択の状態を role に合った ARIA（button の aria-pressed="true"、
//                            tab・option の aria-selected="true"、radio の aria-checked="true"）で示す
//  App1   : app-root-app1（既存）
//           app1-hero      … 全幅のヒーロー。暗い面とグラデーションの背景はこの要素自身か ::before / ::after
//           app1-hero-visual … ヒーローの製品のビジュアル（アクセシブルな名前を持つ要素そのもの。img・role=img・canvas など）
//           cta-official-site（既存）… 主 CTA。app1-hero の中に置く
//  App2   : app-root-app2 / plan-item / quote-item（既存）
//           op-confirm-plan / op-submit-quote / op-approve-quote（既存。FR-020 の主操作。企画・見積を選ぶと表示）
//           asset-register（既存。素材登録の確定）
//           FR-025 の左メニュー（nav-item-<key>）で業務領域を 1 つずつ開く（既定は relation）。企画の操作は plan、
//           見積の操作は quote、素材登録は asset の領域（app2-helpers.ts の go と同じ割当）
//  主操作のボタンは、この testid の要素自身が背景色を持つ。文字の色は不透明の color で指定する
//  （background-clip: text のグラデーション文字や半透明の文字は、コントラスト比を判定できないため不可）。
// ベース URL は playwright.config の baseURL。localStorage は各テストの最初に空にする。
import { test, expect, Page, Locator } from '@playwright/test';
import { go } from './app2-helpers';

type Scheme = 'light' | 'dark';
type RGB = [number, number, number];
type Color = { rgb: RGB; a: number };

const hexRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const PRIMARY: Record<Scheme, string> = { light: '#0067B8', dark: '#2A66B2' }; // PARAM-011 / PARAM-020
const MIN_CONTRAST = 4.5; // PARAM-012
const DARK_SURFACE = ['#0A1522', '#021C3F']; // PARAM-022
const LIGHT_GRADIENT = ['#0538C7', '#34BFFB', '#AADFFF']; // PARAM-023
const SCHEMES: [Scheme, string][] = [['light', 'ライト'], ['dark', 'ダーク']];

const T = (page: Page, id: string) => page.getByTestId(id);

// ---------- 色の計算（WCAG 2.2 の相対輝度とコントラスト比） ----------
function parseColors(css: string): Color[] {
  const out: Color[] = [];
  for (const m of css.matchAll(/rgba?\(([^)]+)\)/g)) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
    out.push({ rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 });
  }
  for (const m of css.matchAll(/color\(srgb\s+([^)]+)\)/g)) {
    const p = m[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
    out.push({ rgb: [p[0] * 255, p[1] * 255, p[2] * 255], a: p.length > 3 ? p[3] : 1 });
  }
  return out;
}
const sameColor = (a: RGB, hex: string, tol = 1) => {
  const b = hexRgb(hex);
  return a.every((v, i) => Math.abs(v - b[i]) <= tol);
};
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb: RGB) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
// 背景の輝度が lo〜hi に分布するときの、文字の輝度 t に対する最悪のコントラスト比
const worstRatio = (t: number, lo: number, hi: number) => (t >= lo && t <= hi ? 1 : Math.min(ratio(t, lo), ratio(t, hi)));

// ---------- 画面の準備 ----------
async function open(page: Page, scheme: Scheme, viewport?: { width: number; height: number }) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      sessionStorage.setItem('__seeded', '1');
    }
  });
  await page.emulateMedia({ colorScheme: scheme });
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(T(page, 'app-root-app1')).toBeVisible();
  await settle(page);
}

// 有限の入場アニメーションとフォントの読み込みが終わるのを待つ（無限のアニメーションは待たない）
async function settle(page: Page) {
  await page.evaluate(async () => {
    await (document as any).fonts?.ready;
    const finite = document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity);
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => undefined))),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  });
}

// 計測中に hover の色が混ざらないよう、マウスを対象から離す
async function parkMouse(page: Page) {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width - 1, vp.height - 1);
}

async function toApp2(page: Page) {
  await T(page, 'app-toggle-app2').click();
  await expect(T(page, 'app-root-app2')).toBeVisible();
  await settle(page);
}

// ---------- 検査の部品 ----------
// ピル形: 角丸の半径（水平・垂直とも）が要素の高さの半分以上
async function expectPill(loc: Locator, label: string) {
  const r = await loc.evaluate((el) => {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return {
      w: b.width,
      h: b.height,
      radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
    };
  });
  const half = r.h / 2 - 0.5;
  for (const raw of r.radii) {
    const tok = raw.trim().split(/\s+/);
    const toPx = (v: string, base: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * base : parseFloat(v));
    const horiz = toPx(tok[0], r.w);
    const vert = toPx(tok[1] ?? tok[0], r.h);
    expect(Math.min(horiz, vert), `${label}: ピル形（角丸 ${raw} が高さ ${r.h}px の半分以上）`).toBeGreaterThanOrEqual(half);
  }
}

// 主操作のボタン: 背景色が主色、文字と背景のコントラスト比が PARAM-012 以上、ピル形
async function expectPrimaryButton(loc: Locator, scheme: Scheme, label: string) {
  await expect(loc, `${label} が表示される`).toBeVisible();
  await parkMouse(loc.page());
  const c = await loc.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const textEl = (walker.nextNode()?.parentElement ?? el) as HTMLElement;
    const ts = getComputedStyle(textEl) as CSSStyleDeclaration & { webkitTextFillColor?: string };
    return { bg: getComputedStyle(el).backgroundColor, fg: ts.webkitTextFillColor || ts.color };
  });
  const bg = parseColors(c.bg)[0];
  const fg = parseColors(c.fg)[0];
  expect(bg?.a === 1 && sameColor(bg.rgb, PRIMARY[scheme]), `${label}: 背景色が ${PRIMARY[scheme]}（実際 ${c.bg}）`).toBe(true);
  expect(fg?.a, `${label}: 文字の色が不透明（実際 ${c.fg}）`).toBe(1);
  const cr = ratio(luminance(fg.rgb), luminance(bg.rgb));
  expect(cr, `${label}: 文字 ${c.fg} と背景 ${c.bg} のコントラスト比`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  await expectPill(loc, label);
}

// 暗い面（PARAM-022）に光のグラデーション（PARAM-023 の色を含む gradient）を重ねた背景
async function expectDarkSurfaceWithGradient(loc: Locator, label: string) {
  await expect(loc, `${label} が表示される`).toBeVisible();
  const s = await loc.evaluate((el) => {
    const parts = [getComputedStyle(el), getComputedStyle(el, '::before'), getComputedStyle(el, '::after')];
    return {
      bgColors: parts.map((p) => p.backgroundColor).join(' | '),
      images: parts.map((p) => p.backgroundImage).join(' | '),
    };
  });
  expect(s.images, `${label}: 計算済みの background-image に gradient を含む`).toMatch(/gradient\(/);
  const all = [...parseColors(s.bgColors), ...parseColors(s.images)].filter((c) => c.a > 0);
  expect(
    all.some((c) => DARK_SURFACE.some((d) => sameColor(c.rgb, d))),
    `${label}: 暗い面 ${DARK_SURFACE.join('・')} を使う（実際 ${JSON.stringify(s)}）`,
  ).toBe(true);
  const grad = parseColors(s.images).filter((c) => c.a > 0);
  expect(
    grad.some((c) => LIGHT_GRADIENT.some((d) => sameColor(c.rgb, d))),
    `${label}: グラデーションに ${LIGHT_GRADIENT.join('・')} のいずれかの色を含む（実際 ${s.images}）`,
  ).toBe(true);
}

// container の中の、文字を直接持つ見える要素に印を付けて返す
async function textElements(container: Locator): Promise<Locator[]> {
  const page = container.page();
  const tag = `t${Math.random().toString(36).slice(2, 8)}`;
  const n = await container.evaluate((root, tg) => {
    let i = 0;
    for (const el of [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[]) {
      const own = Array.from(el.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim());
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (own && b.width >= 4 && b.height >= 4 && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0) {
        el.setAttribute('data-st-text', `${tg}-${i++}`);
      }
    }
    return i;
  }, tag);
  return Array.from({ length: n }, (_, i) => page.locator(`[data-st-text="${tag}-${i}"]`));
}

// 要素の文字を透明にして描画を撮り、背景の画素の輝度の 1〜99 パーセンタイルを返す
async function backdropRange(loc: Locator, decoder: Page): Promise<{ lo: number; hi: number }> {
  const page = loc.page();
  await loc.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = '__st_hide_text';
    s.textContent =
      '[data-st-hide], [data-st-hide] * { color: transparent !important; -webkit-text-fill-color: transparent !important;' +
      ' text-shadow: none !important; caret-color: transparent !important; text-decoration-color: transparent !important; }';
    document.head.appendChild(s);
  });
  await loc.evaluate((el) => el.setAttribute('data-st-hide', ''));
  const png = await loc.screenshot({ animations: 'disabled' });
  await loc.evaluate((el) => el.removeAttribute('data-st-hide'));
  await page.evaluate(() => document.getElementById('__st_hide_text')?.remove());
  return decoder.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    const ln = (v: number) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const L: number[] = [];
    for (let i = 0; i < d.length; i += 4) L.push(0.2126 * ln(d[i]) + 0.7152 * ln(d[i + 1]) + 0.0722 * ln(d[i + 2]));
    L.sort((a, b) => a - b);
    return { lo: L[Math.floor(L.length * 0.01)], hi: L[Math.min(L.length - 1, Math.floor(L.length * 0.99))] };
  }, png.toString('base64'));
}

// containers の中のすべての文字が、実際の背景に対して PARAM-012 以上のコントラスト比を持つ
async function expectTextContrast(containers: [Locator, string][]) {
  const page = containers[0][0].page();
  await parkMouse(page);
  const decoder = await page.context().newPage(); // 画素の復号用（対象の画面には触れない）
  try {
    for (const [container, label] of containers) {
      const els = await textElements(container);
      expect(els.length, `${label}: 文字がある`).toBeGreaterThan(0);
      for (const el of els) {
        const info = await el.evaluate((e) => {
          const cs = getComputedStyle(e) as CSSStyleDeclaration & { webkitTextFillColor?: string };
          return { fg: cs.webkitTextFillColor || cs.color, text: (e.textContent ?? '').trim().slice(0, 30) };
        });
        const fg = parseColors(info.fg)[0];
        expect(fg?.a, `${label}「${info.text}」: 文字の色が不透明（実際 ${info.fg}）`).toBe(1);
        const { lo, hi } = await backdropRange(el, decoder);
        const cr = worstRatio(luminance(fg.rgb), lo, hi);
        expect(cr, `${label}「${info.text}」: 文字 ${info.fg} と背景（輝度 ${lo.toFixed(3)}〜${hi.toFixed(3)}）のコントラスト比`)
          .toBeGreaterThanOrEqual(MIN_CONTRAST);
      }
    }
  } finally {
    await decoder.close();
  }
}

// 欠けない: 横方向にビューポートからはみ出さず、overflow で切り取られず、ほかの要素に覆われない
async function expectNotClipped(loc: Locator, label: string) {
  await expect(loc, `${label} が表示される`).toBeVisible();
  await loc.scrollIntoViewIfNeeded();
  const problems = await loc.evaluate((el) => {
    const out: string[] = [];
    const b = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    if (b.left < -0.5 || b.right > vw + 0.5) out.push(`ビューポートの外（${b.left.toFixed(1)}〜${b.right.toFixed(1)} / 幅 ${vw}）`);
    for (const d of [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[]) {
      const cs = getComputedStyle(d);
      if (d.clientWidth > 0 && d.scrollWidth > d.clientWidth + 1 && cs.overflowX !== 'visible') {
        out.push(`${d.tagName} の内容が切り取られる（${d.scrollWidth} > ${d.clientWidth}）`);
      }
    }
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/hidden|clip/.test(`${cs.overflowX} ${cs.overflowY}`)) {
        const pb = p.getBoundingClientRect();
        if (b.left < pb.left - 0.5 || b.right > pb.right + 0.5 || b.top < pb.top - 0.5 || b.bottom > pb.bottom + 0.5) {
          out.push(`祖先 ${p.tagName}[${p.getAttribute('data-testid') ?? ''}] で切り取られる`);
        }
      }
    }
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) out.push(`中央がほかの要素（${hit?.tagName}）に覆われる`);
    return out;
  });
  expect(problems, `${label} が欠けない`).toEqual([]);
}

// 選択の状態が role に合った ARIA で支援技術に伝わる
const selectedByAria = (page: Page) =>
  page
    .getByRole('button', { pressed: true })
    .or(page.getByRole('tab', { selected: true }))
    .or(page.getByRole('option', { selected: true }))
    .or(page.getByRole('radio', { checked: true }));

async function bg(loc: Locator) {
  return parseColors(await loc.evaluate((el) => getComputedStyle(el).backgroundColor))[0];
}

// ======================================================================
// NFR-UX-004 AC-089: 主 CTA と App2 の主操作のボタン
// ======================================================================
for (const [scheme, jp] of SCHEMES) {
  // NFR-UX-004 AC-089
  test(`NFR-UX-004 AC-089 ${jp}のテーマで主 CTA と App2 の主操作のボタンが ${scheme === 'light' ? 'PARAM-011' : 'PARAM-020'} のピル形・コントラスト比 4.5 以上`, async ({ page }) => {
    await open(page, scheme);
    await expectPrimaryButton(T(page, 'cta-official-site'), scheme, 'App1 の主 CTA');
    await toApp2(page);
    // FR-025: 主操作のボタンは業務領域の画面にあるので、左メニューで該当の領域を開いてから確かめる
    await go(page, 'plan');
    await settle(page);
    await T(page, 'plan-item').first().click();
    await expectPrimaryButton(T(page, 'op-confirm-plan'), scheme, 'App2 の企画の確定');
    await go(page, 'quote');
    await settle(page);
    await T(page, 'quote-item').first().click();
    await expectPrimaryButton(T(page, 'op-submit-quote'), scheme, 'App2 の見積の提出');
    await expectPrimaryButton(T(page, 'op-approve-quote'), scheme, 'App2 の見積の承認');
    await go(page, 'asset');
    await settle(page);
    await expectPrimaryButton(T(page, 'asset-register'), scheme, 'App2 の素材登録の確定');
  });
}

// NFR-UX-004 AC-089（異常系: 再読み込みなしで OS のテーマが変わっても、前のテーマの色が残らない）
test('NFR-UX-004 AC-089 異常系: 表示中に OS のテーマを切り替えると主操作のボタンが新しいテーマの主色に追従する', async ({ page }) => {
  await open(page, 'light');
  await expectPrimaryButton(T(page, 'cta-official-site'), 'light', 'App1 の主 CTA（ライト）');
  await page.emulateMedia({ colorScheme: 'dark' });
  await settle(page);
  await expectPrimaryButton(T(page, 'cta-official-site'), 'dark', 'App1 の主 CTA（ダークへ切替後）');
  await toApp2(page);
  await go(page, 'asset'); // FR-025: 素材登録は素材の領域の画面にある
  await settle(page);
  await expectPrimaryButton(T(page, 'asset-register'), 'dark', 'App2 の素材登録の確定（ダーク）');
  await page.emulateMedia({ colorScheme: 'light' });
  await settle(page);
  await expectPrimaryButton(T(page, 'asset-register'), 'light', 'App2 の素材登録の確定（ライトへ戻した後）');
});

// ======================================================================
// NFR-UX-004 AC-091: App1 の全幅のヒーロー
// ======================================================================
for (const [scheme, jp] of SCHEMES) {
  // NFR-UX-004 AC-091
  test(`NFR-UX-004 AC-091 OS が${jp}の設定で App1 の最初の画面に暗い面の全幅のヒーロー（グラデーション・大きな見出し・製品のビジュアル・主 CTA）`, async ({ page }) => {
    await open(page, scheme);
    const hero = T(page, 'app1-hero');
    await expect(hero).toBeVisible();
    await expect(hero, '最初の画面（スクロールなし）にヒーローがある').toBeInViewport();
    // 全幅
    const geo = await hero.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { left: b.left, width: b.width, vw: document.documentElement.clientWidth };
    });
    expect(geo.left, 'ヒーローが左端から始まる').toBeLessThanOrEqual(0.5);
    expect(geo.width, 'ヒーローがビューポートの全幅').toBeGreaterThanOrEqual(geo.vw - 1);
    // OS のテーマによらず暗い面に光のグラデーション
    await expectDarkSurfaceWithGradient(hero, `ヒーロー（OS ${jp}）`);
    // 大きな見出し: ヒーローの中の見出しで、ヒーローの見出し以外の文字より大きい
    const heading = hero.getByRole('heading').first();
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
    const sizes = await hero.evaluate((root) => {
      const h = root.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]') as HTMLElement;
      const others: number[] = [];
      for (const el of Array.from(root.querySelectorAll('*')) as HTMLElement[]) {
        if (el.closest('h1,h2,h3,h4,h5,h6,[role="heading"]')) continue;
        if (Array.from(el.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && c.textContent?.trim())) {
          others.push(parseFloat(getComputedStyle(el).fontSize));
        }
      }
      return { heading: parseFloat(getComputedStyle(h).fontSize), maxOther: Math.max(0, ...others) };
    });
    expect(sizes.heading, 'ヒーローの見出しがヒーローのほかの文字より大きい').toBeGreaterThan(sizes.maxOther);
    // 製品のビジュアル（アクセシブルな名前を持つ）
    const visual = hero.getByTestId('app1-hero-visual');
    await expect(visual).toBeVisible();
    await expect(visual, '製品のビジュアルがアクセシブルな名前を持つ').toHaveAccessibleName(/\S/);
    // 主 CTA がヒーローの中にあり、最初の画面に見える
    const cta = hero.getByTestId('cta-official-site');
    await expect(cta).toBeVisible();
    await expect(cta).toBeInViewport();
    // ヒーローの文字と背景のコントラスト比
    await expectTextContrast([[hero, `ヒーロー（OS ${jp}）`]]);
  });
}

// NFR-UX-004 AC-091（異常系: 狭い画面）
test('NFR-UX-004 AC-091 異常系: 幅 320 CSS ピクセルでもヒーローの見出しと CTA が欠けない', async ({ page }) => {
  await open(page, 'light', { width: 320, height: 640 });
  const hero = T(page, 'app1-hero');
  await expect(hero).toBeVisible();
  const geo = await hero.evaluate((el) => ({ w: el.getBoundingClientRect().width, vw: document.documentElement.clientWidth }));
  expect(geo.w, '幅 320 でもヒーローは全幅').toBeGreaterThanOrEqual(geo.vw - 1);
  await expectNotClipped(hero.getByRole('heading').first(), 'ヒーローの見出し');
  await expectNotClipped(hero.getByTestId('cta-official-site'), '主 CTA');
  await expectDarkSurfaceWithGradient(hero, 'ヒーロー（幅 320）');
});

// ======================================================================
// NFR-UX-004 AC-116: シェルのヘッダー帯・ワードマーク・トグル
// ======================================================================
for (const [scheme, jp] of SCHEMES) {
  // NFR-UX-004 AC-116
  test(`NFR-UX-004 AC-116 ${jp}のテーマでシェルのヘッダーが暗い面と光のグラデーション・ワードマークとトグルの文字のコントラスト比 4.5 以上`, async ({ page }) => {
    await open(page, scheme);
    const header = T(page, 'shell-header');
    const wordmark = header.getByTestId('brand-wordmark');
    const t1 = header.getByTestId('app-toggle-app1');
    const t2 = header.getByTestId('app-toggle-app2');
    await expect(wordmark, 'ワードマークがヘッダーの中にある').toBeVisible();
    await expect(t1, 'トグルがヘッダーの中にある').toBeVisible();
    await expectDarkSurfaceWithGradient(header, `シェルのヘッダー（${jp}、App1 表示中）`);
    await expectTextContrast([[wordmark, 'ワードマーク'], [t1, 'トグル App1（選択中）'], [t2, 'トグル App2（未選択）']]);
    // App2 に切り替えても同じ帯で、選択が入れ替わったトグルの文字も読める
    await toApp2(page);
    await expectDarkSurfaceWithGradient(header, `シェルのヘッダー（${jp}、App2 表示中）`);
    await expectTextContrast([[wordmark, 'ワードマーク'], [t1, 'トグル App1（未選択）'], [t2, 'トグル App2（選択中）']]);
  });

  // NFR-UX-004 AC-116
  test(`NFR-UX-004 AC-116 ${jp}のテーマでトグルの選択中の項目が主色のピル形・選択の状態が支援技術に伝わる`, async ({ page }) => {
    await open(page, scheme);
    const header = T(page, 'shell-header');
    const items = { app1: header.getByTestId('app-toggle-app1'), app2: header.getByTestId('app-toggle-app2') };
    const check = async (sel: 'app1' | 'app2') => {
      const other = sel === 'app1' ? 'app2' : 'app1';
      await parkMouse(page);
      await expect(items[sel].and(selectedByAria(page)), `${sel} の項目が選択中として支援技術に伝わる`).toHaveCount(1);
      await expect(items[other].and(selectedByAria(page)), `${other} の項目は選択中として伝わらない`).toHaveCount(0);
      const b = await bg(items[sel]);
      expect(b?.a === 1 && sameColor(b.rgb, PRIMARY[scheme]), `選択中の ${sel} の背景が ${PRIMARY[scheme]}（実際 ${JSON.stringify(b)}）`).toBe(true);
      await expectPill(items[sel], `選択中の ${sel} の項目`);
      const o = await bg(items[other]);
      expect(!!o && o.a > 0 && sameColor(o.rgb, PRIMARY[scheme]), `未選択の ${other} は主色の背景で示されない`).toBe(false);
    };
    await check('app1');
    // 異常系: 選択を変えると、色と状態の両方が新しい項目に移る（古い項目に残らない）
    await toApp2(page);
    await check('app2');
    await T(page, 'app-toggle-app1').click();
    await expect(T(page, 'app-root-app1')).toBeVisible();
    await settle(page);
    await check('app1');
  });
}

// NFR-UX-004 AC-116（異常系: 狭い画面）
test('NFR-UX-004 AC-116 異常系: 幅 320 CSS ピクセルでもトグルとワードマークが欠けない', async ({ page }) => {
  await open(page, 'light', { width: 320, height: 640 });
  const header = T(page, 'shell-header');
  await expect(header).toBeVisible();
  await expectNotClipped(header.getByTestId('brand-wordmark'), 'ワードマーク');
  await expectNotClipped(header.getByTestId('app-toggle-app1'), 'トグル App1');
  await expectNotClipped(header.getByTestId('app-toggle-app2'), 'トグル App2');
  // 狭い画面でもトグルを操作でき、切替後も欠けない
  await toApp2(page);
  await expectNotClipped(header.getByTestId('brand-wordmark'), 'ワードマーク（App2）');
  await expectNotClipped(header.getByTestId('app-toggle-app1'), 'トグル App1（App2）');
  await expectNotClipped(header.getByTestId('app-toggle-app2'), 'トグル App2（App2）');
  await expectDarkSurfaceWithGradient(header, 'シェルのヘッダー（幅 320）');
});
