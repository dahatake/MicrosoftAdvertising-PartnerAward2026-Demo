// System Test part 1/3: シェル・多言語・表示切替・カメラ・App1
// 期待値は docs/requirements-definition.md の受入基準だけから決めている。
// 画面要素の契約（実装側が満たす data-testid。実装は後で作られるため、ここで定義する）:
//   app-toggle-app1 / app-toggle-app2 / app-root-app1 / app-root-app2
//   lang-select（<select> value=ja|en|zh|ko） / view-mode-2d / view-mode-3d / view-mode-reason
//   cta-official-site / persona-select-p1 / persona-select-p2 / presentation-start / presentation-root
//   presentation-scene / presentation-prev / presentation-next / presentation-stop / presentation-close
//   product-view-2d / product-view-3d-canvas / architecture-2d
//   camera-simple-slider / camera-preset-<n:0..8> / camera-now / camera-detail-size|angle|motion|character
//   camera-combo / camera-mini-preview
//   layout-panel-<id> / layout-menu-<id> / layout-reset / layout-save-note / panel-input / command-palette
// 【2026-10-19 更新（FR-024〜026・AC-080 Q-006 A）】App2 は業務領域ごとに 1 領域ずつ表示する（左メニュー nav-item-<key>、
//   領域の画面は area-root-<key>）。パネルの ID は実装の割当に依存させず、領域の中の最初の layout-panel-* と、
//   その layout-menu-<同じ id> を使う。くわしく選択は camera-detail-open で開き、camera-group-<part> のボタン群
//   （role=radiogroup、各ボタン role=radio・aria-checked）で選ぶ（select は使わない）。
// 環境変数 BASE_URL（既定 http://localhost:5173）。
import { test, expect, Page } from '@playwright/test';
import { go } from './app2-helpers';

const T = (page: Page, id: string) => page.getByTestId(id);
const goto = async (page: Page) => { await page.goto('/'); };
/** 領域 key の最初のパネルの要素と、その layout-menu-<id> */
async function firstPanel(page: Page, key: string) {
  const el = T(page, `area-root-${key}`).locator('[data-testid^="layout-panel-"]').first();
  const tid = (await el.getAttribute('data-testid'))!;
  const id = tid.replace('layout-panel-', '');
  return { id, panel: T(page, tid), menu: T(page, `layout-menu-${id}`) };
}

test.use({ baseURL: process.env.BASE_URL ?? 'http://localhost:5173' });

// ---------- FR-001 ----------
test('FR-001 AC-001 トグルで App2 に切替・App1 に戻る。再読込なし・言語と表示方法を保つ', async ({ page }) => {
  await goto(page);
  await T(page, 'lang-select').selectOption('ko');
  await T(page, 'view-mode-3d').click();
  await page.evaluate(() => { (window as any).__noReload = 1; });
  await T(page, 'app-toggle-app2').click();
  await expect(T(page, 'app-root-app2')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__noReload)).toBe(1);
  await expect(T(page, 'lang-select')).toHaveValue('ko');
  await expect(T(page, 'view-mode-3d')).toBeChecked();
  await T(page, 'app-toggle-app1').click();
  await expect(T(page, 'app-root-app1')).toBeVisible();
  await expect(T(page, 'lang-select')).toHaveValue('ko');
});

// ---------- FR-001 ----------
test('FR-001 AC-002 初回表示は App1 で、ログイン入力欄・ボタンはどの画面にも無い（異常系: 認証要求なし）', async ({ page }) => {
  await goto(page);
  await expect(T(page, 'app-root-app1')).toBeVisible();
  const check = async () => {
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /log ?in|sign ?in|ログイン|サインイン|登录|로그인/i })).toHaveCount(0);
  };
  await check();
  await T(page, 'app-toggle-app2').click();
  await check();
});

// ---------- FR-002 ----------
for (const [lang, word] of [['ko', /[가-힣]/], ['ja', /[ぁ-んァ-ン]/], ['zh', /[\u4e00-\u9fff]/], ['en', /^[\x00-\x7F\s]+$/]] as const) {
  test(`FR-002 AC-003 ブラウザ言語 ${lang} で初回表示がその言語になる`, async ({ browser }) => {
    const ctx = await browser.newContext({ locale: lang === 'zh' ? 'zh-CN' : lang });
    const page = await ctx.newPage();
    await goto(page);
    await expect(T(page, 'lang-select')).toHaveValue(lang);
    const text = await T(page, 'app-root-app1').innerText();
    expect(text).toMatch(word);
    await ctx.close();
  });
}

// ---------- FR-003 ----------
test('FR-003 AC-007 CTA で公式サイトが新しいタブで開き、元の画面は保たれる', async ({ page, context }) => {
  await goto(page);
  const [popup] = await Promise.all([context.waitForEvent('page'), T(page, 'cta-official-site').click()]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  expect(context.pages().length).toBe(2);
  await expect(T(page, 'app-root-app1')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

// ---------- FR-004 ----------
test('FR-004 AC-010 ペルソナを選んで開始すると全画面で場面が順に表示され、ペルソナ変更で内容が変わる', async ({ page }) => {
  await goto(page);
  await T(page, 'persona-select-p1').click();
  await T(page, 'presentation-start').click();
  await expect(T(page, 'presentation-root')).toBeVisible();
  const box = await T(page, 'presentation-root').boundingBox();
  const vp = page.viewportSize()!;
  expect(box!.width).toBeGreaterThanOrEqual(vp.width - 2);
  expect(box!.height).toBeGreaterThanOrEqual(vp.height - 2);
  const s1 = await T(page, 'presentation-scene').innerText();
  await T(page, 'presentation-next').click();
  expect(await T(page, 'presentation-scene').innerText()).not.toBe(s1);
  await T(page, 'presentation-close').click();
  await T(page, 'persona-select-p2').click();
  await T(page, 'presentation-start').click();
  const s2 = await T(page, 'presentation-scene').innerText();
  expect(s2).not.toBe(s1);
});

test('FR-004 AC-067 P-1 は既定 2D 製品ビューで 1 操作で 3D、P-2 は説明文と 2D 構成図が既定', async ({ page }) => {
  await goto(page);
  await T(page, 'persona-select-p1').click();
  await expect(T(page, 'product-view-2d')).toBeVisible();
  await expect(T(page, 'product-view-3d-canvas')).toHaveCount(0);
  await T(page, 'view-mode-3d').click();
  await expect(T(page, 'product-view-3d-canvas')).toBeVisible();
  await page.reload();
  await T(page, 'persona-select-p2').click();
  await expect(T(page, 'architecture-2d')).toBeVisible();
  await expect(T(page, 'product-view-3d-canvas')).toHaveCount(0);
});

test('FR-004 AC-011 Esc で元の画面に戻り、言語・表示方法・スクロール位置が保たれる', async ({ page }) => {
  await goto(page);
  await T(page, 'lang-select').selectOption('en');
  await T(page, 'view-mode-3d').click();
  await page.evaluate(() => window.scrollTo(0, 300));
  const y = await page.evaluate(() => window.scrollY);
  await T(page, 'persona-select-p1').click();
  await T(page, 'presentation-start').click();
  await page.keyboard.press('Escape');
  await expect(T(page, 'presentation-root')).toHaveCount(0);
  await expect(T(page, 'lang-select')).toHaveValue('en');
  await expect(T(page, 'view-mode-3d')).toBeChecked();
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
});

test('FR-004 AC-012 前へ・次へ・停止がキーボードだけで操作できる', async ({ page }) => {
  await goto(page);
  await T(page, 'persona-select-p1').click();
  await T(page, 'presentation-start').focus();
  await page.keyboard.press('Enter');
  const s1 = await T(page, 'presentation-scene').innerText();
  await page.keyboard.press('ArrowRight');
  const s2 = await T(page, 'presentation-scene').innerText();
  expect(s2).not.toBe(s1);
  await page.keyboard.press('ArrowLeft');
  expect(await T(page, 'presentation-scene').innerText()).toBe(s1);
  await T(page, 'presentation-stop').focus();
  await page.keyboard.press('Enter');
  await expect(T(page, 'presentation-root')).toHaveCount(0);
});

// ---------- FR-005 ----------
test('FR-005 AC-013 3D を選ぶと空でない 3D ビューが描画され、ドラッグ・キーボードで回転する', async ({ page }) => {
  await goto(page);
  await expect(T(page, 'product-view-3d-canvas')).toHaveCount(0); // 既定は 2D
  await T(page, 'view-mode-3d').click();
  const c = T(page, 'product-view-3d-canvas');
  await expect(c).toBeVisible();
  const snap = () => c.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const before = await snap();
  expect(before.length).toBeGreaterThan(2000); // 空でない（空キャンバスの dataURL は短い）
  const b = (await c.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterDrag = await snap();
  expect(afterDrag).not.toBe(before);
  await c.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  expect(await snap()).not.toBe(afterDrag);
});

// ---------- FR-008 ----------
test('FR-008 AC-023 2D→3D で同じ ID 集合の項目が表示され、選択・絞り込みが保たれる', async ({ page }) => {
  await goto(page);
  // AC-023 は App1 のペルソナを指定しない。シェルのトグルで App2 の DualView 例を使う。
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  // 項目（関係図のノード）はキャンペーンを選ぶと表示される。選択状態は aria-checked / aria-selected / data-selected
  await T(page, 'campaign-item').first().click();
  const ids = () => T(page, 'relation-node').evaluateAll(es => es.map(e => e.getAttribute('data-entity-id')).sort());
  const before = await ids();
  expect(before.length).toBeGreaterThan(0);
  await T(page, 'relation-node').nth(1).click();
  const selected = await T(page, 'relation-node').nth(1).getAttribute('data-entity-id');
  await T(page, 'view-mode-3d').click();
  expect(await ids()).toEqual(before);
  await expect(page.locator(`[data-testid="relation-node"][data-entity-id="${selected}"][aria-checked=true], [data-testid="relation-node"][data-entity-id="${selected}"][aria-selected=true]`)).toBeVisible();
  // 3D の DualView も同じ ID 集合を持つ
  const dual = await page.locator('[data-item-id]').evaluateAll(es => [...new Set(es.map(e => e.getAttribute('data-item-id')))].sort());
  expect(dual).toEqual(before);
});

// ---------- FR-009 ----------
test('FR-009 AC-026 かんたん選択で 9 プリセットを選べ、プレビューと「いま: …」が更新される', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  const slider = T(page, 'camera-simple-slider');
  await expect(slider).toBeVisible();
  for (let n = 0; n < 9; n++) await expect(T(page, `camera-preset-${n}`)).toHaveCount(1);
  await expect(T(page, 'camera-mini-preview')).toHaveCount(9);
  const now0 = await T(page, 'camera-now').innerText();
  await T(page, 'camera-preset-8').click();
  expect(await T(page, 'camera-now').innerText()).not.toBe(now0);
  await expect(T(page, 'camera-preset-8')).toHaveAttribute('aria-checked', 'true');
});

test('FR-009 AC-027 くわしく選択で 4 要素を個別に変更でき、「いま: …」と内部の組合せが更新される', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  const combo0 = await T(page, 'camera-combo').getAttribute('data-value');
  const now0 = await T(page, 'camera-now').innerText();
  await T(page, 'camera-detail-open').click();
  for (const k of ['size', 'angle', 'motion', 'character']) {
    const grp = T(page, `camera-group-${k}`);
    await expect(grp.locator('select')).toHaveCount(0); // AC-109: select ではなくボタン群
    const radios = grp.getByRole('radio');
    expect(await radios.count()).toBeGreaterThan(1);
    const before = await T(page, 'camera-combo').getAttribute('data-value');
    // 現在選択中でなく、無効でない（2D で表現できる）ボタンを選ぶ
    let done = false;
    for (let i = 0; i < await radios.count(); i++) {
      const r = radios.nth(i);
      if ((await r.getAttribute('aria-checked')) !== 'true' && (await r.isEnabled())) {
        await r.click();
        await expect(r).toHaveAttribute('aria-checked', 'true');
        done = true;
        break;
      }
    }
    expect(done, `${k} に選べるボタンがある`).toBe(true);
    expect(await T(page, 'camera-combo').getAttribute('data-value')).not.toBe(before);
  }
  expect(await T(page, 'camera-combo').getAttribute('data-value')).not.toBe(combo0);
  expect(await T(page, 'camera-now').innerText()).not.toBe(now0);
});

test('FR-009 AC-030 「動きを減らす」設定ではミニプレビューもカメラワーク選択も動かない（最大 0ms）', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await T(page, 'camera-preset-7').click();
  const anims = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
  expect(anims).toBe(0);
  const dur = await T(page, 'camera-combo').getAttribute('data-max-duration-ms');
  expect(dur).toBe('0');
  await ctx.close();
});

// ---------- FR-010 ----------
test('FR-010 AC-033 パネルの移動・サイズ変更・タブ化・非表示・最大化が即反映される', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  const { panel: p, menu } = await firstPanel(page, 'relation');
  const w0 = (await p.boundingBox())!.width;
  await menu.click();
  await page.getByRole('menuitem', { name: /widen|wider|広く|拡大|넓|宽/i }).click();
  expect((await p.boundingBox())!.width).not.toBe(w0);
  await menu.click();
  await page.getByRole('menuitem', { name: /maxim|最大|최대/i }).click();
  await expect(p).toHaveAttribute('data-maximized', 'true');
  await menu.click();
  await page.getByRole('menuitem', { name: /hide|非表示|숨|隐藏/i }).click();
  await expect(p).toBeHidden();
});

test('FR-010 AC-034 レイアウトは localStorage に保存・再訪で復元・「既定に戻す」で戻る', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  const { id, panel: p, menu } = await firstPanel(page, 'relation');
  await menu.click();
  await page.getByRole('menuitem', { name: /hide|非表示|숨|隐藏/i }).click();
  await expect(p).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => /layout/i.test(k)))).toBe(true);
  await page.reload();
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  await expect(T(page, `layout-panel-${id}`)).toBeHidden();
  await T(page, 'layout-reset').click();
  await expect(T(page, `layout-panel-${id}`)).toBeVisible();
});

test('FR-010 AC-035 キーボードのメニュー操作でもドラッグと同じ結果（移動・サイズ変更）になる', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  const { panel: p, menu } = await firstPanel(page, 'relation');
  const b0 = (await p.boundingBox())!;
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const b1 = (await p.boundingBox())!;
  expect([b1.x, b1.y, b1.width, b1.height]).not.toEqual([b0.x, b0.y, b0.width, b0.height]);
});

test('FR-010 AC-037 レイアウトを変更しても入力中の内容・選択中の対象が失われない', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await go(page, 'relation');
  await T(page, 'panel-input').fill('入力中のテキスト');
  await T(page, 'campaign-item').first().click();
  const sel = await T(page, 'campaign-item').first().getAttribute('data-campaign-id');
  // 入力欄を含むパネルとは別の最初のパネルで大きさを変える（入力欄のパネルは残る）
  const { menu } = await firstPanel(page, 'relation');
  await menu.click();
  await page.getByRole('menuitem', { name: /widen|wider|広く|拡大|넓|宽/i }).click();
  await expect(T(page, 'panel-input')).toHaveValue('入力中のテキスト');
  await expect(page.locator(`[data-testid="campaign-item"][data-campaign-id="${sel}"]`)).toHaveAttribute('aria-pressed', 'true');
  // 異常系: 入力欄のあるパネルを最大化しても入力内容は失われない
  const memoPanel = T(page, 'area-root-relation').locator('[data-testid^="layout-panel-"]').filter({ has: T(page, 'panel-input') });
  const memoId = ((await memoPanel.getAttribute('data-testid')) ?? '').replace('layout-panel-', '');
  await T(page, `layout-menu-${memoId}`).click();
  await page.getByRole('menuitem', { name: /maxim|最大|최대/i }).click();
  await expect(T(page, 'panel-input')).toHaveValue('入力中のテキスト');
});

test('FR-010 AC-038 コマンドパレットからキーボードだけでレイアウト・アプリ・言語・表示方法に到達できる', async ({ page }) => {
  await goto(page);
  await page.keyboard.press('Control+k');
  await expect(T(page, 'command-palette')).toBeVisible();
  for (const q of ['layout', 'App2', 'language', '3D']) {
    await page.keyboard.type(q);
    await expect(T(page, 'command-palette').getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
  }
  await page.keyboard.type('App2');
  await page.keyboard.press('Enter');
  await expect(T(page, 'app-root-app2')).toBeVisible();
  await expect(T(page, 'command-palette')).toHaveCount(0);
});
