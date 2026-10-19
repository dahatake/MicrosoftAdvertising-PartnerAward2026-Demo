// System Test: FR-024 1画面収容 / FR-025 左メニュー / FR-026 ボタン群 / FR-027 実広告素材の参照
// 期待値は docs/requirements-definition.md の受入基準だけから決めている（実装コードは参照しない）。
// 外部ネットワークに依存しない: 第三者ホストへの通信はすべて route で遮断またはモックし、記録する。
// 基準ビューポートは PARAM-015/016 = 1280x720。
// 画面の契約（実装が満たす data-testid。変更が必要なら競合として返す）:
//   共通   : app-toggle-app2, app-root-app2, lang-select(言語。対象外), persona-select-p1|p2, command-palette(対象外)
//   メニュー: side-nav（垂直メニュー。role=navigation）、項目 nav-item-<key>（key は
//            relation|plan|quote|production|order|asset|deploy|usage|kpi をこの順で DOM に並べる）
//            各項目は <アイコン svg|img>＋可視ラベル。ツールチップは role=tooltip（hover/focus で表示）。
//            選択中は aria-current="page"。業務領域の画面は area-root-<key>。
//   入力保持: asset 領域の絞り込み入力 asset-filter（input）、ほか領域は panel-input
//   カメラ  : camera-detail-open（くわしく選択を開く）、ボタン群 camera-group-size|angle|motion|character
//            （role=radiogroup + aria-label、各ボタン role=radio で aria-checked）、camera-now、camera-combo（4要素）
//            2D 不可の組合せは disabled の role=radio で理由 camera-disabled-reason
//   素材   : asset-real-item[data-provider=youtube|tiktok]（asset 領域）、asset-real-thumb(img)、
//            asset-real-url(a href)、asset-real-source、asset-real-rights、asset-real-notice、
//            asset-real-play(button)、asset-real-embed(iframe。再生後のみ)、asset-real-fallback（読込失敗時）、
//            asset-real-fallback-reason（原因と次の行動）
import { test, expect, Page } from '@playwright/test';

const T = (page: Page, id: string) => page.getByTestId(id);
test.use({ baseURL: process.env.BASE_URL ?? 'http://localhost:5173', viewport: { width: 1280, height: 720 } });

const KEYS = ['relation', 'plan', 'quote', 'production', 'order', 'asset', 'deploy', 'usage', 'kpi'] as const;
const YT = 'https://www.youtube.com/watch?v=fm6VQgCkj20';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

type Req = { url: string; type: string; host: string };
// 同一オリジン以外はすべて遮断。サムネイル画像（image）だけ 1x1 PNG を返す。記録を返す。
async function guardNetwork(page: Page, opts: { failThumbs?: boolean } = {}) {
  const seen: Req[] = [];
  const base = new URL(process.env.BASE_URL ?? 'http://localhost:5173');
  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.host === base.host || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    seen.push({ url: route.request().url(), type: route.request().resourceType(), host: u.host });
    if (!opts.failThumbs && route.request().resourceType() === 'image' && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    return route.abort('failed');
  });
  return seen;
}
async function openApp2(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await T(page, 'app-toggle-app2').click();
  await expect(T(page, 'app-root-app2')).toBeVisible();
}
async function openArea(page: Page, key: string) {
  await T(page, `nav-item-${key}`).click();
  await expect(T(page, `area-root-${key}`)).toBeVisible();
}
const pageOverflow = (page: Page) => page.evaluate(() => ({
  sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
  bw: document.body.scrollWidth, bh: document.body.scrollHeight, iw: window.innerWidth, ih: window.innerHeight,
}));
const hiddenScrollers = (page: Page) => page.evaluate(() => {
  const bad: string[] = [];
  document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const y = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const x = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (y || x) bad.push(`${el.tagName}[${el.getAttribute('data-testid') ?? el.className}] ${el.scrollWidth}x${el.scrollHeight}/${el.clientWidth}x${el.clientHeight}`);
  });
  return bad;
});
async function expectFits(page: Page) {
  const o = await pageOverflow(page);
  expect(o.sw).toBeLessThanOrEqual(o.iw);
  expect(o.sh).toBeLessThanOrEqual(o.ih);
  expect(o.bw).toBeLessThanOrEqual(o.iw);
  expect(o.bh).toBeLessThanOrEqual(o.ih);
}

// ---------- FR-024 ----------
// FR-024 AC-098
test('FR-024 AC-098 基準ビューポートで全業務領域の画面に縦横スクロールが発生しない', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  for (const k of KEYS) { await openArea(page, k); await expectFits(page); }
});

// FR-024 AC-098（異常系: 他ペルソナ・他言語でも崩れない）
test('FR-024 AC-098 ペルソナ・言語を切り替えても全業務領域で 1 画面に収まる（異常系: 長い文言の言語）', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  for (const lang of   ['en', 'zh', 'ko']) {
      await T(page, 'lang-select').selectOption(lang);
    await T(page, 'persona-select-p2').click();
    for (const k of KEYS) { await openArea(page, k); await expectFits(page); }
  }
});

// FR-024 AC-099
test('FR-024 AC-099 どのパネル・一覧・表にも内部スクロール領域（隠れた内容）がない', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  for (const k of KEYS) {
    await openArea(page, k);
    expect(await hiddenScrollers(page), `領域 ${k}`).toEqual([]);
  }
});

// ---------- FR-025 ----------
// FR-025 AC-102
test('FR-025 AC-102 左側の垂直メニューに 関係→企画→見積→制作→発注→素材→展開→利用状況→KPI 試算 の順で並ぶ', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  const nav = T(page, 'side-nav');
  await expect(nav).toBeVisible();
  const nb = (await nav.boundingBox())!;
  const ab = (await T(page, 'app-root-app2').boundingBox())!;
  expect(nb.x).toBeLessThan(ab.x + ab.width / 4); // 左側
  expect(nb.height).toBeGreaterThan(nb.width);     // 垂直
  const ids = await nav.locator('[data-testid^="nav-item-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(ids).toEqual(KEYS.map((k) => `nav-item-${k}`));
  const ys = await Promise.all(KEYS.map(async (k) => (await T(page, `nav-item-${k}`).boundingBox())!.y));
  expect([...ys].sort((a, b) => a - b)).toEqual(ys);
});

// FR-025 AC-103
test('FR-025 AC-103 各項目にアイコン（項目ごとに別）と文字ラベルがあり、hover/focus で 20 文字以内のツールチップが出る', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await T(page, 'lang-select').selectOption('ja');
  const iconSigs = new Set<string>();
  for (const k of KEYS) {
    const item = T(page, `nav-item-${k}`);
    const icon = item.locator('svg, img').first();
    await expect(icon, `${k} icon`).toBeVisible();
    iconSigs.add(await icon.evaluate((e) => e.outerHTML.replace(/\s+/g, ' ')));
    expect((await item.innerText()).trim().length, `${k} label`).toBeGreaterThan(0);
    await item.hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible();
    const t1 = (await tip.innerText()).trim();
    expect(t1.length).toBeGreaterThan(0);
    expect(t1.length).toBeLessThanOrEqual(20); // PARAM-017
    await page.mouse.move(700, 400);
    await expect(tip).toHaveCount(0);
    await item.focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    expect((await page.getByRole('tooltip').innerText()).trim()).toBe(t1);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  }
  expect(iconSigs.size).toBe(KEYS.length); // 項目ごとに異なる
});

// FR-025 AC-104
test('FR-025 AC-104 項目選択で画面が切り替わり、現在位置が aria-current とテキスト/形で示され、入力内容が失われない', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await openArea(page, 'asset');
  await T(page, 'asset-filter').fill('保持確認');
  await openArea(page, 'order');
  await expect(T(page, 'area-root-asset')).toHaveCount(0);
  await expect(T(page, 'nav-item-order')).toHaveAttribute('aria-current', 'page');
  for (const k of KEYS.filter((k) => k !== 'order')) await expect(T(page, `nav-item-${k}`)).not.toHaveAttribute('aria-current', 'page');
  // 色以外の手がかり: 選択中だけ outline/border/font-weight/下線などの形が異なる
  const sig = (k: string) => T(page, `nav-item-${k}`).evaluate((e) => {
    const s = getComputedStyle(e); return [s.outlineStyle + s.outlineWidth, s.borderLeftWidth + s.borderLeftStyle, s.fontWeight, s.textDecorationLine, e.querySelector('[data-testid="nav-current-mark"]') ? 'mark' : ''].join('|');
  });
  expect(await sig('order')).not.toBe(await sig('plan'));
  await openArea(page, 'asset');
  await expect(T(page, 'asset-filter')).toHaveValue('保持確認');
});

// FR-025 AC-104（異常系: 存在しない領域を直接指定しても画面が壊れない）
test('FR-025 AC-104 異常系: 不正なメニュー指定（ハッシュ）でも既定の領域が表示され、エラー画面にならない', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await page.evaluate(() => { location.hash = '#/app2/__no_such_area__'; });
  await expect(T(page, 'app-root-app2')).toBeVisible();
  await expect(T(page, 'side-nav')).toBeVisible();
  await expect(page.locator('[data-testid^="area-root-"]')).toHaveCount(1);
});

// ---------- FR-026 ----------
// FR-026 AC-108
test('FR-026 AC-108 App2 のどの業務領域にも select・role=combobox・role=listbox が存在しない（言語・ペルソナ・パレットは対象外）', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  for (const k of KEYS) {
    await openArea(page, k);
    const n = await T(page, `area-root-${k}`).evaluate((root) => root.querySelectorAll(
      'select, [role=combobox], [role=listbox], datalist').length);
    expect(n, `領域 ${k}`).toBe(0);
  }
  // 対象外の既存 UI を除いた App2 全体でも 0
  const total = await T(page, 'app-root-app2').evaluate((root) => Array.from(root.querySelectorAll(
    'select, [role=combobox], [role=listbox]')).filter((e) => !e.closest('[data-testid="lang-select"],[data-testid="command-palette"],[data-testid^="persona-select"]') &&
    !['lang-select', 'command-palette'].includes(e.getAttribute('data-testid') ?? '')).length);
  expect(total).toBe(0);
});

// FR-026 AC-109
test('FR-026 AC-109 くわしく選択の 4 項目がボタン群で、選ぶと「いま: …」と 4 要素が更新される', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await T(page, 'camera-detail-open').click();
  for (const g of ['size', 'angle', 'motion', 'character']) {
    const grp = T(page, `camera-group-${g}`);
    await expect(grp).toBeVisible();
    await expect(grp.locator('select')).toHaveCount(0);
    expect(await grp.getByRole('radio').count()).toBeGreaterThanOrEqual(2);
  }
  const before = (await T(page, 'camera-now').innerText()).trim();
  const before4 = (await T(page, 'camera-combo').innerText()).trim();
  const groups = ['size', 'angle', 'motion', 'character'];
  const changed: string[] = [];
  for (const g of groups) {
    const radios = T(page, `camera-group-${g}`).getByRole('radio');
    const n = await radios.count();
    for (let i = 0; i < n; i++) {
      const r = radios.nth(i);
      if ((await r.getAttribute('aria-checked')) !== 'true' && (await r.isEnabled())) { await r.click(); await expect(r).toHaveAttribute('aria-checked', 'true'); changed.push(g); break; }
    }
  }
  expect(changed.length).toBe(4);
  expect((await T(page, 'camera-now').innerText()).trim()).not.toBe(before);
  expect((await T(page, 'camera-combo').innerText()).trim()).not.toBe(before4);
  await expect(T(page, 'camera-now')).toContainText(/いま|Now|现在|지금/);
});

// FR-026 AC-109（異常系: 2D で表現できない組合せのボタンは無効化され理由が示される）
test('FR-026 AC-109 異常系: 2D で表現できない組合せのボタンは disabled で理由が示される', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await T(page, 'view-mode-2d').click();
  await T(page, 'camera-detail-open').click();
  const disabled = page.locator('[data-testid^="camera-group-"] [role=radio][aria-disabled=true], [data-testid^="camera-group-"] [role=radio]:disabled');
  expect(await disabled.count()).toBeGreaterThan(0);
  await disabled.first().hover();
  await expect(T(page, 'camera-disabled-reason')).toBeVisible();
  expect((await T(page, 'camera-disabled-reason').innerText()).trim().length).toBeGreaterThan(0);
});

// ---------- FR-027 ----------
// FR-027 AC-111
test('FR-027 AC-111 素材に YouTube と TikTok の実広告素材が各 1 件以上、サムネイルと元 URL リンクつきで表示される', async ({ page }) => {
  const seen = await guardNetwork(page);
  await openApp2(page);
  await openArea(page, 'asset');
  for (const p of ['youtube', 'tiktok']) {
    const item = page.locator(`[data-testid=asset-real-item][data-provider=${p}]`).first();
    await expect(item).toBeVisible();
    await expect(item.getByTestId('asset-real-thumb')).toBeVisible();
    const href = await item.getByTestId('asset-real-url').getAttribute('href');
    expect(href).toMatch(p === 'youtube' ? /^https:\/\/(www\.)?youtube\.com\// : /^https:\/\/(www\.)?tiktok\.com\//);
  }
  const yt = page.locator('[data-testid=asset-real-item][data-provider=youtube]').first().getByTestId('asset-real-url');
  await expect(yt).toHaveAttribute('href', YT); // PARAM-018
  expect(seen.length).toBeGreaterThanOrEqual(0);
});

// FR-027 AC-112
test('FR-027 AC-112 参照は読み取りだけ（GET/HEAD のみ）で、動画・画像ファイルを配布物に複製していない', async ({ page, request }) => {
  const writes: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (u.host !== new URL(process.env.BASE_URL ?? 'http://localhost:5173').host && !['GET', 'HEAD', 'OPTIONS'].includes(r.method())) writes.push(`${r.method()} ${r.url()}`); });
  await guardNetwork(page);
  await openApp2(page);
  await openArea(page, 'asset');
  await page.waitForTimeout(500);
  expect(writes).toEqual([]);
  // 配布元から動画ファイルが配信されない（自サイト内の素材参照が mp4/webm/mov でない）
  const media = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(n)));
  expect(media).toEqual([]);
});

// FR-027 AC-113
test('FR-027 AC-113 各実素材に提供元・公開 URL・権利許諾の根拠（依頼者の申告）と別製品の旨が表示される', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await T(page, 'lang-select').selectOption('ja');
  await openArea(page, 'asset');
  const items = page.getByTestId('asset-real-item');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) {
    const it = items.nth(i);
    await expect(it.getByTestId('asset-real-source')).toContainText(/YouTube|TikTok/);
    await expect(it.getByTestId('asset-real-url')).toHaveAttribute('href', /^https:\/\//);
    await expect(it.getByTestId('asset-real-rights')).toContainText('依頼者の申告');
    await expect(it.getByTestId('asset-real-notice')).toContainText(/別|実在/);
  }
});

// FR-027 AC-114（異常系: サムネイルが読み込めない）
test('FR-027 AC-114 異常系: サムネイル取得失敗時、壊れた画像・空枠が出ず、仮置き表示と元 URL・原因と次の行動が示される', async ({ page }) => {
  await guardNetwork(page, { failThumbs: true });
  await openApp2(page);
  await openArea(page, 'asset');
  const items = page.getByTestId('asset-real-item');
  const n = await items.count();
  expect(n).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < n; i++) {
    const it = items.nth(i);
    await expect(it.getByTestId('asset-real-fallback')).toBeVisible();
    await expect(it.getByTestId('asset-real-url')).toHaveAttribute('href', /^https:\/\//);
    expect((await it.getByTestId('asset-real-fallback-reason').innerText()).trim().length).toBeGreaterThan(5);
    const broken = await it.locator('img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((im) => im.offsetParent !== null && (!im.complete || im.naturalWidth === 0)).length);
    expect(broken).toBe(0);
    const box = await it.boundingBox();
    expect(box!.height).toBeGreaterThan(20);
  }
  await expectFits(page);
});

// FR-027 AC-115
test('FR-027 AC-115 再生前はサムネイル画像の取得だけで第三者通信し、プレーヤー・スクリプト・Cookie は「再生」後にだけ', async ({ page, context }) => {
  const seen = await guardNetwork(page);
  await openApp2(page);
  await openArea(page, 'asset');
  await expect(page.getByTestId('asset-real-item').first()).toBeVisible();
  await page.waitForTimeout(500);
  // 再生前: 第三者への通信は image のみ。iframe/script/media/xhr/fetch は無い
  expect(seen.filter((r) => r.type !== 'image'), JSON.stringify(seen)).toEqual([]);
  expect(await page.locator('iframe').count()).toBe(0);
  expect(await page.locator('video').evaluateAll((v) => (v as HTMLVideoElement[]).filter((x) => !x.paused).length)).toBe(0);
  const thirdCookies = (await context.cookies()).filter((c) => !/localhost|127\.0\.0\.1/.test(c.domain));
  expect(thirdCookies).toEqual([]);
  await expectFits(page);
  // 再生操作後にだけ埋め込みへ切り替わる（通信は遮断しているが iframe は置かれる）
  const item = page.locator('[data-testid=asset-real-item][data-provider=youtube]').first();
  await item.getByTestId('asset-real-play').click();
  await expect(item.locator('iframe[data-testid=asset-real-embed]')).toBeVisible();
  expect(seen.some((r) => /youtube/.test(r.host))).toBe(true);
  await expectFits(page); // 1 画面収容を壊さない
});

// FR-027 AC-115（キーボード操作）
test('FR-027 AC-115 「再生」ボタンはキーボードだけで操作できる', async ({ page }) => {
  await guardNetwork(page);
  await openApp2(page);
  await openArea(page, 'asset');
  const play = page.locator('[data-testid=asset-real-item][data-provider=youtube]').first().getByTestId('asset-real-play');
  await play.focus();
  await expect(play).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe[data-testid=asset-real-embed]').first()).toBeVisible();
});
