// System Test: 架空の製品・非公式のデモである旨の注記（NFR-UX-005 の system の受入基準 AC-117・AC-118）
// 期待値は docs/requirements-definition.md の受入基準と PARAM の表だけから決めている（実装コードは正解にしない）。
//   PARAM-011 #0067B8 / PARAM-020 #2A66B2（主色）/ PARAM-012 4.5（最小コントラスト比）
//   PARAM-015×016 = 1280×720（基準のビューポート）/ PARAM-022 #0A1522・#021C3F / PARAM-023 #0538C7・#34BFFB・#AADFFF
// AC-119（integration）と AC-097（manual。公式ロゴを使う場合のみ有効）はここでは作らない。
//
// 画面の契約（実装が付ける data-testid。変更が必要なら競合として返す）:
//  brand-notice  … 注記の要素そのもの。role="note"。シェルのヘッダー帯（shell-header）の中または直下にあり、
//                  App1・App2 のどちらでも、4 ロケールのどれでも常に可視。閉じる・折りたたむ操作を持たない。
//                  文字は不透明の color で指定する（background-clip: text や半透明の文字は不可）。
//                  h1 の外（h1 の子孫ではない）。折り返して全文が読める（320 CSS ピクセルでも切れない）。
//  shell-header / brand-wordmark / app-toggle-app1 / app-toggle-app2 / lang-select / app-root-app1 / app-root-app2 /
//  nav-item-<key> / area-root-<key>（既存。brand.spec.ts・app2-helpers.ts と同じ契約）
//  ヘッダーの見出し h1 は shell-header の中に 1 つあり、テキストは正式名称だけ（FR-022 AC-086）。
// 注記の文言は、各ロケールで「架空」「非公式」「仮置き」を表す語を含む（下の WORDS の語のいずれか）。
// ベース URL は playwright.config の baseURL。localStorage は各テストの最初に空にする。
import { test, expect, Page, Locator } from '@playwright/test';
import { go } from './app2-helpers';

type Scheme = 'light' | 'dark';
type RGB = [number, number, number];
type Color = { rgb: RGB; a: number };
type Lang = 'ja' | 'en' | 'zh' | 'ko';

const OFFICIAL_NAME = 'MicrosoftAdvertising-PartnerAward2026-Demo'; // FR-022 AC-086
const LANGS: Lang[] = ['ja', 'en', 'zh', 'ko'];
const APPS = ['app1', 'app2'] as const;
const KEYS = ['relation', 'plan', 'quote', 'production', 'order', 'asset', 'deploy', 'usage', 'kpi'] as const; // FR-025
const MIN_CONTRAST = 4.5; // PARAM-012
const PRIMARY: Record<Scheme, string> = { light: '#0067B8', dark: '#2A66B2' }; // PARAM-011 / PARAM-020
const DARK_SURFACE = ['#0A1522', '#021C3F']; // PARAM-022
const LIGHT_GRADIENT = ['#0538C7', '#34BFFB', '#AADFFF']; // PARAM-023
const SCHEMES: Scheme[] = ['light', 'dark'];
// 各ロケールの注記が含むべき 3 つの意味（架空・非公式・仮置き）。公式サイトではない旨は「非公式」「unofficial」等で確かめる
const WORDS: Record<Lang, RegExp[]> = {
  ja: [/架空/, /非公式/, /仮置き/],
  en: [/fictional/i, /unofficial/i, /placeholder/i],
  zh: [/虚构|架空/, /非官方/, /占位|暂定|临时/],
  ko: [/가상|허구/, /비공식/, /임시|가안|플레이스홀더/],
};

const T = (page: Page, id: string) => page.getByTestId(id);

// ---------- 色の計算（WCAG 2.2） ----------
const hexRgb = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
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
const sameColor = (a: RGB, hex: string, tol = 1) => hexRgb(hex).every((v, i) => Math.abs(a[i] - v) <= tol);
const lin = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (rgb: RGB) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
const worstRatio = (t: number, lo: number, hi: number) => (t >= lo && t <= hi ? 1 : Math.min(ratio(t, lo), ratio(t, hi)));

// ---------- 画面の準備 ----------
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
async function open(page: Page, scheme: Scheme = 'light', viewport = { width: 1280, height: 720 }) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      sessionStorage.setItem('__seeded', '1');
    }
  });
  await page.emulateMedia({ colorScheme: scheme });
  await page.setViewportSize(viewport);
  await page.goto('/');
  await expect(T(page, 'app-root-app1')).toBeVisible();
  await settle(page);
}
async function useApp(page: Page, app: (typeof APPS)[number]) {
  await T(page, `app-toggle-${app}`).click();
  await expect(T(page, `app-root-${app}`)).toBeVisible();
  await settle(page);
}
async function useLang(page: Page, lang: Lang) {
  await T(page, 'lang-select').selectOption(lang);
  await expect(T(page, 'lang-select')).toHaveValue(lang);
  await settle(page);
}
async function parkMouse(page: Page) {
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width - 1, vp.height - 1);
}

// ---------- 注記の検査 ----------
async function noticeText(page: Page) {
  return ((await T(page, 'brand-notice').innerText()) ?? '').trim();
}
// 可視・role=note・ヘッダー帯の中または直下・そのロケールの言語の文言・テキスト要素（画像・SVG ではない）
async function expectNotice(page: Page, lang: Lang, label: string) {
  const n = T(page, 'brand-notice');
  await expect(n, `${label}: 注記が可視`).toBeVisible();
  await expect(n, `${label}: role=note`).toHaveAttribute('role', 'note');
  const text = await noticeText(page);
  for (const re of WORDS[lang]) expect(text, `${label}: 注記「${text}」が ${re} を含む`).toMatch(re);
  const geo = await page.evaluate(() => {
    const note = document.querySelector('[data-testid="brand-notice"]') as HTMLElement;
    const header = document.querySelector('[data-testid="shell-header"]') as HTMLElement;
    const nb = note.getBoundingClientRect();
    const hb = header.getBoundingClientRect();
    const cs = getComputedStyle(note);
    return {
      inside: header.contains(note),
      noteTop: nb.top, noteBottom: nb.bottom, headTop: hb.top, headBottom: hb.bottom,
      hasGraphicText: !!note.querySelector('img, svg, canvas') && !note.textContent?.trim(),
      visible: cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0,
      inH1: !!note.closest('h1'),
    };
  });
  expect(geo.visible, `${label}: 計算済みのスタイルで可視`).toBe(true);
  expect(geo.hasGraphicText, `${label}: 画像・SVG の文字ではない`).toBe(false);
  expect(geo.inH1, `${label}: h1 の外`).toBe(false);
  // 「ヘッダー帯の中」または「直下」（帯の下端から 24 CSS ピクセル以内に始まる）
  const ok = geo.inside || (geo.noteTop >= geo.headBottom - 1 && geo.noteTop <= geo.headBottom + 24);
  expect(ok, `${label}: ヘッダー帯の中または直下（注記 ${geo.noteTop}〜${geo.noteBottom} / ヘッダー ${geo.headTop}〜${geo.headBottom}）`).toBe(true);
}

// ---------- 検査の部品（brand.spec.ts と同じ流儀） ----------
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
// containers の中のすべての文字が、実際の背景（描画の画素）に対して PARAM-012 以上
async function expectTextContrast(containers: [Locator, string][]) {
  const page = containers[0][0].page();
  await parkMouse(page);
  const decoder = await page.context().newPage();
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
// 欠けない: ビューポートからはみ出さず、overflow で切り取られず、内容が切れない
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
      if (d.clientWidth > 0 && d.scrollWidth > d.clientWidth + 1) out.push(`${d.tagName} の内容が横に切れる（${d.scrollWidth} > ${d.clientWidth}）`);
      const clamp = (cs as any).webkitLineClamp;
      if (cs.textOverflow === 'ellipsis' || (clamp && clamp !== 'none')) out.push(`${d.tagName} が省略表示（ellipsis / line-clamp）`);
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
    return out;
  });
  expect(problems, `${label} が欠けない`).toEqual([]);
}
async function expectNoHorizontalScroll(page: Page, label: string) {
  const o = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth,
  }));
  expect(o.sw, `${label}: 文書の幅が横スクロールを起こさない`).toBeLessThanOrEqual(o.iw);
  expect(o.bw, `${label}: body の幅が横スクロールを起こさない`).toBeLessThanOrEqual(o.iw);
}
// 暗い面（PARAM-022）に光のグラデーション（PARAM-023）
async function expectDarkSurfaceWithGradient(loc: Locator, label: string) {
  await expect(loc, `${label} が表示される`).toBeVisible();
  const s = await loc.evaluate((el) => {
    const parts = [getComputedStyle(el), getComputedStyle(el, '::before'), getComputedStyle(el, '::after')];
    return { bgColors: parts.map((p) => p.backgroundColor).join(' | '), images: parts.map((p) => p.backgroundImage).join(' | ') };
  });
  expect(s.images, `${label}: 計算済みの background-image に gradient を含む`).toMatch(/gradient\(/);
  const all = [...parseColors(s.bgColors), ...parseColors(s.images)].filter((c) => c.a > 0);
  expect(all.some((c) => DARK_SURFACE.some((d) => sameColor(c.rgb, d))), `${label}: 暗い面 ${DARK_SURFACE.join('・')}（実際 ${JSON.stringify(s)}）`).toBe(true);
  const grad = parseColors(s.images).filter((c) => c.a > 0);
  expect(grad.some((c) => LIGHT_GRADIENT.some((d) => sameColor(c.rgb, d))), `${label}: グラデーションに ${LIGHT_GRADIENT.join('・')} の色（実際 ${s.images}）`).toBe(true);
}
// トグルの選択中の項目: 主色・ピル形・ARIA の選択状態
async function expectSelectedToggle(page: Page, app: (typeof APPS)[number], scheme: Scheme, label: string) {
  const el = T(page, `app-toggle-${app}`);
  await parkMouse(page);
  const r = await el.evaluate((e) => {
    const cs = getComputedStyle(e);
    const b = e.getBoundingClientRect();
    return {
      bg: cs.backgroundColor, w: b.width, h: b.height,
      radii: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius],
      aria: ['aria-pressed', 'aria-selected', 'aria-checked'].some((a) => e.getAttribute(a) === 'true'),
    };
  });
  const bg = parseColors(r.bg)[0];
  expect(bg?.a === 1 && sameColor(bg.rgb, PRIMARY[scheme]), `${label}: 選択中が主色 ${PRIMARY[scheme]}（実際 ${r.bg}）`).toBe(true);
  expect(r.aria, `${label}: 選択が ARIA（aria-pressed 等）で示される`).toBe(true);
  for (const raw of r.radii) {
    const tok = raw.trim().split(/\s+/);
    const px = (v: string, base: number) => (v.endsWith('%') ? (parseFloat(v) / 100) * base : parseFloat(v));
    expect(Math.min(px(tok[0], r.w), px(tok[1] ?? tok[0], r.h)), `${label}: ピル形（${raw}）`).toBeGreaterThanOrEqual(r.h / 2 - 0.5);
  }
}

// ======================= AC-117 =======================
for (const lang of LANGS) {
  // NFR-UX-005 AC-117 正常系: ロケールごとに App1・App2 の両方で注記が可視・role=note・そのロケールの言語
  test(`NFR-UX-005 AC-117 [N5-117-${lang}] ${lang} で App1・App2 のヘッダー帯の中または直下に注記が常に可視`, async ({ page }) => {
    await open(page);
    await useLang(page, lang);
    for (const app of APPS) {
      await useApp(page, app);
      await expectNotice(page, lang, `${lang}/${app}`);
    }
  });
}

// NFR-UX-005 AC-117 言語の切替で注記の言語も切り替わる（4 言語を巡回し、各言語の文言が他の言語と異なる）
test('NFR-UX-005 AC-117 [N5-117-switch] 言語を切り替えると注記の言語も切り替わる（App1・App2）', async ({ page }) => {
  await open(page);
  for (const app of APPS) {
    await useApp(page, app);
    const seen = new Map<string, Lang>();
    for (const lang of ['en', 'ja', 'ko', 'zh', 'en'] as Lang[]) {
      await useLang(page, lang);
      await expectNotice(page, lang, `${app}/${lang}`);
      const t = await noticeText(page);
      if (seen.has(t)) expect(seen.get(t), `${app}: 同じ文言は同じ言語だけ`).toBe(lang);
      seen.set(t, lang);
    }
    expect(seen.size, `${app}: 4 言語の文言がすべて異なる`).toBe(4);
  }
});

// NFR-UX-005 AC-117 異常系: 閉じる操作・折りたたみがなく、時間・操作（アプリ切替・テーマ変更・再読込）で消えない
test('NFR-UX-005 AC-117 [N5-117-persist] 異常系: 閉じる操作がなく、時間経過・切替・再読込で注記が消えない', async ({ page }) => {
  await open(page);
  await useLang(page, 'en');
  const n = T(page, 'brand-notice');
  await expect(n.getByRole('button')).toHaveCount(0);
  await expect(n.locator('[aria-expanded], [aria-label*="close" i], [aria-label*="閉" i]')).toHaveCount(0);
  await page.waitForTimeout(6000);
  await expectNotice(page, 'en', '時間経過後');
  // 注記をクリック・Esc しても消えない
  await n.click({ trial: false }).catch(() => undefined);
  await page.keyboard.press('Escape');
  await expectNotice(page, 'en', 'クリック・Esc 後');
  for (const app of ['app2', 'app1', 'app2'] as const) {
    await useApp(page, app);
    await expectNotice(page, 'en', `切替後 ${app}`);
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectNotice(page, 'en', 'ダーク');
  await page.reload();
  await expect(T(page, 'app-root-app1').or(T(page, 'app-root-app2'))).toBeVisible();
  await expectNotice(page, 'en', '再読込後');
});

// NFR-UX-005 AC-117 コントラスト: 注記の文字と実際の背景が、ライト・ダークのどちらでも PARAM-012 以上（4 ロケール・両アプリ）
for (const scheme of SCHEMES) {
  test(`NFR-UX-005 AC-117 [N5-117-contrast-${scheme}] ${scheme} テーマで注記の文字と背景のコントラスト比が 4.5 以上（4 言語・両アプリ）`, async ({ page }) => {
    await open(page, scheme);
    for (const lang of LANGS) {
      await useLang(page, lang);
      for (const app of APPS) {
        await useApp(page, app);
        await expectTextContrast([[T(page, 'brand-notice'), `${scheme}/${lang}/${app} 注記`]]);
      }
    }
  });
}

// NFR-UX-005 AC-117 異常系: 幅 320 CSS ピクセルでも注記が折り返して全文が読め、横スクロールが発生しない
test('NFR-UX-005 AC-117 [N5-117-320] 異常系: 幅 320px でも注記の文字が切れず、横スクロールが発生しない（4 言語・両アプリ）', async ({ page }) => {
  await open(page, 'light', { width: 320, height: 640 });
  for (const lang of LANGS) {
    await useLang(page, lang);
    for (const app of APPS) {
      await useApp(page, app);
      const label = `320px/${lang}/${app}`;
      await expectNotice(page, lang, label);
      await expectNotClipped(T(page, 'brand-notice'), `${label} 注記`);
      await expectNoHorizontalScroll(page, label);
      // 全文が折り返して見える: 要素の高さが 1 行より高い、または scrollHeight が clientHeight を超えない
      const full = await T(page, 'brand-notice').evaluate((e) => e.scrollHeight <= e.clientHeight + 1);
      expect(full, `${label}: 注記の高さが内容に合い全文が見える`).toBe(true);
    }
  }
});

// ======================= AC-118 =======================
// NFR-UX-005 AC-118 h1 は正式名称だけ。注記とワードマークは h1 の外（4 言語・両アプリ）
test('NFR-UX-005 AC-118 [N5-118-h1] 注記を表示した状態でもヘッダーの h1 は正式名称だけで、注記・ワードマークは h1 の外', async ({ page }) => {
  await open(page);
  for (const lang of LANGS) {
    await useLang(page, lang);
    for (const app of APPS) {
      await useApp(page, app);
      const label = `${lang}/${app}`;
      await expect(T(page, 'brand-notice'), `${label}: 注記が表示されている`).toBeVisible();
      const h1s = T(page, 'shell-header').locator('h1');
      await expect(h1s, `${label}: ヘッダーの h1 は 1 つ`).toHaveCount(1);
      await expect(h1s, `${label}: h1 は正式名称だけ`).toHaveText(OFFICIAL_NAME);
      const outside = await page.evaluate(() => ['brand-notice', 'brand-wordmark'].map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        return { id, exists: !!el, inH1: !!el?.closest('h1'), h1Inside: !!el?.querySelector('h1') };
      }));
      for (const o of outside) {
        expect(o.exists, `${label}: ${o.id} がある`).toBe(true);
        expect(o.inH1, `${label}: ${o.id} は h1 の外`).toBe(false);
        expect(o.h1Inside, `${label}: ${o.id} は h1 を含まない`).toBe(false);
      }
      await expect(page, `${label}: document.title も正式名称`).toHaveTitle(OFFICIAL_NAME);
    }
  }
});

// NFR-UX-005 AC-118 / FR-024 AC-098: 注記を表示した状態で、App2 のすべての業務領域が基準のビューポートで縦横スクロールなし
test('NFR-UX-005 AC-118 [N5-118-fit] 注記を表示した App2 の全業務領域が 1280×720 で縦横スクロールなし（4 言語）', async ({ page }) => {
  await open(page, 'light', { width: 1280, height: 720 }); // PARAM-015 × PARAM-016
  await useApp(page, 'app2');
  for (const lang of LANGS) {
    await useLang(page, lang);
    for (const k of KEYS) {
      await go(page, k);
      const label = `${lang}/${k}`;
      await expect(T(page, 'brand-notice'), `${label}: 注記が表示されている`).toBeVisible();
      const o = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
        bw: document.body.scrollWidth, bh: document.body.scrollHeight, iw: window.innerWidth, ih: window.innerHeight,
      }));
      expect(o.sw, `${label}: 横（文書）`).toBeLessThanOrEqual(o.iw);
      expect(o.sh, `${label}: 縦（文書）`).toBeLessThanOrEqual(o.ih);
      expect(o.bw, `${label}: 横（body）`).toBeLessThanOrEqual(o.iw);
      expect(o.bh, `${label}: 縦（body）`).toBeLessThanOrEqual(o.ih);
    }
  }
});

// NFR-UX-005 AC-118 / NFR-UX-004 AC-116: 注記を表示した状態でも、ヘッダー帯が AC-116 の条件を満たす（ライト・ダーク）
for (const scheme of SCHEMES) {
  test(`NFR-UX-005 AC-118 [N5-118-header-${scheme}] ${scheme} テーマで注記があってもヘッダー帯が AC-116 の条件（グラデーション・コントラスト・ピル形トグル）を満たす`, async ({ page }) => {
    await open(page, scheme);
    for (const app of APPS) {
      await useApp(page, app);
      const label = `${scheme}/${app}`;
      await expect(T(page, 'brand-notice'), `${label}: 注記が表示されている`).toBeVisible();
      await expectDarkSurfaceWithGradient(T(page, 'shell-header'), `${label} ヘッダー帯`);
      await expectSelectedToggle(page, app, scheme, `${label} トグル`);
      await expectTextContrast([
        [T(page, 'brand-wordmark'), `${label} ワードマーク`],
        [T(page, `app-toggle-app1`), `${label} トグル App1`],
        [T(page, `app-toggle-app2`), `${label} トグル App2`],
        [T(page, 'brand-notice'), `${label} 注記`],
      ]);
    }
  });
}

// NFR-UX-005 AC-118 / NFR-UX-004 AC-116 異常系: 幅 320px でも、注記があってもトグルとワードマークが欠けない
test('NFR-UX-005 AC-118 [N5-118-header-320] 異常系: 幅 320px で注記があってもトグルとワードマークが欠けない（4 言語・両アプリ）', async ({ page }) => {
  await open(page, 'light', { width: 320, height: 640 });
  for (const lang of LANGS) {
    await useLang(page, lang);
    for (const app of APPS) {
      await useApp(page, app);
      const label = `320px/${lang}/${app}`;
      await expectNotClipped(T(page, 'brand-wordmark'), `${label} ワードマーク`);
      await expectNotClipped(T(page, 'app-toggle-app1'), `${label} トグル App1`);
      await expectNotClipped(T(page, 'app-toggle-app2'), `${label} トグル App2`);
      await expectNoHorizontalScroll(page, label);
    }
  }
});
