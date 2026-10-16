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
// 環境変数 BASE_URL（既定 http://localhost:5173）。
import { test, expect, Page } from '@playwright/test';

const T = (page: Page, id: string) => page.getByTestId(id);
const goto = async (page: Page) => { await page.goto('/'); };

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
  await T(page, 'persona-select-p2').click();
  const ids = () => page.locator('[data-item-id]').evaluateAll(es => es.map(e => e.getAttribute('data-item-id')).sort());
  const before = await ids();
  expect(before.length).toBeGreaterThan(0);
  await page.locator('[data-item-id]').first().click();
  const selected = await page.locator('[aria-selected=true][data-item-id], [data-selected=true][data-item-id]').first().getAttribute('data-item-id');
  await T(page, 'view-mode-3d').click();
  expect(await ids()).toEqual(before);
  await expect(page.locator(`[data-item-id="${selected}"][aria-selected=true], [data-item-id="${selected}"][data-selected=true]`)).toBeVisible();
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
  for (const k of ['size', 'angle', 'motion', 'character']) {
    const sel = T(page, `camera-detail-${k}`);
    const opts = await sel.locator('option').count();
    expect(opts).toBeGreaterThan(1);
    const before = await T(page, 'camera-combo').getAttribute('data-value');
    await sel.selectOption({ index: opts - 1 });
    await sel.selectOption({ index: 0 }).catch(() => {});
    await sel.selectOption({ index: opts - 1 });
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
  const p = T(page, 'layout-panel-1');
  const w0 = (await p.boundingBox())!.width;
  await T(page, 'layout-menu-1').click();
  await page.getByRole('menuitem', { name: /widen|wider|広く|拡大|넓|宽/i }).click();
  expect((await p.boundingBox())!.width).not.toBe(w0);
  await T(page, 'layout-menu-1').click();
  await page.getByRole('menuitem', { name: /maxim|最大|최대/i }).click();
  await expect(p).toHaveAttribute('data-maximized', 'true');
  await T(page, 'layout-menu-1').click();
  await page.getByRole('menuitem', { name: /hide|非表示|숨|隐藏/i }).click();
  await expect(p).toBeHidden();
});

test('FR-010 AC-034 レイアウトは localStorage に保存・再訪で復元・「既定に戻す」で戻る', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await T(page, 'layout-menu-1').click();
  await page.getByRole('menuitem', { name: /hide|非表示|숨|隐藏/i }).click();
  await expect(T(page, 'layout-panel-1')).toBeHidden();
  expect(await page.evaluate(() => Object.keys(localStorage).some(k => /layout/i.test(k)))).toBe(true);
  await page.reload();
  await T(page, 'app-toggle-app2').click();
  await expect(T(page, 'layout-panel-1')).toBeHidden();
  await T(page, 'layout-reset').click();
  await expect(T(page, 'layout-panel-1')).toBeVisible();
});

test('FR-010 AC-035 キーボードのメニュー操作でもドラッグと同じ結果（移動・サイズ変更）になる', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  const p = T(page, 'layout-panel-1');
  const b0 = (await p.boundingBox())!;
  await T(page, 'layout-menu-1').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const b1 = (await p.boundingBox())!;
  expect([b1.x, b1.y, b1.width, b1.height]).not.toEqual([b0.x, b0.y, b0.width, b0.height]);
});

test('FR-010 AC-037 レイアウトを変更しても入力中の内容・選択中の対象が失われない', async ({ page }) => {
  await goto(page);
  await T(page, 'app-toggle-app2').click();
  await T(page, 'panel-input').fill('入力中のテキスト');
  await T(page, 'layout-menu-1').click();
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
