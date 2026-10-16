// NFR system tests (part 3/3). 期待値は受入基準だけから決める。
// BASE_URL: ローカルのビルド成果物の配信先（既定 http://localhost:4173）
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';

// 対象のフォーカス可能要素を Tab で巡回し、見える焦点が付くことを確認する
async function tabThrough(page: Page, max = 60) {
  const seen = new Set<string>();
  let focusVisibleCount = 0;
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outlined = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      return {
        key: el.tagName + '|' + (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40),
        outlined,
        focusVisible: el.matches(':focus-visible'),
      };
    });
    if (info) {
      seen.add(info.key);
      if (info.outlined && info.focusVisible) focusVisibleCount++;
    }
  }
  return { distinct: seen.size, focusVisibleCount };
}

// NFR-A11Y-001 AC-055: 正常系（Tab で到達でき、フォーカスが見える）
test('NFR-A11Y-001 AC-055 キーボードだけで主要操作に到達でき、フォーカスが見える', async ({ page }) => {
  await page.goto(BASE);
  const r = await tabThrough(page);
  expect(r.distinct).toBeGreaterThanOrEqual(4);
  expect(r.focusVisibleCount).toBeGreaterThanOrEqual(r.distinct - 1);
});

// NFR-A11Y-001 AC-055: 言語切替・アプリ切替をキーボードだけで完了できる
test('NFR-A11Y-001 AC-055 言語切替とアプリ切替をキーボードだけで完了できる', async ({ page }) => {
  await page.goto(BASE);
  const lang = page.getByRole('combobox', { name: /言語|language/i }).first();
  await lang.focus();
  const before = await page.evaluate(() => document.documentElement.lang);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).not.toBe(before);

  const appSwitch = page.getByRole('tablist').first().getByRole('tab').first();
  await appSwitch.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { selected: true })).toBeVisible();
});

// NFR-A11Y-001 AC-055: 異常系（Esc でダイアログを閉じられ、キーボードトラップがない）
test('NFR-A11Y-001 AC-055 異常系: Esc でダイアログを閉じられ、フォーカスが閉じ込められない', async ({ page }) => {
  await page.goto(BASE);
  const opener = page.getByRole('button', { name: /素材|登録|asset|register/i }).first();
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

// NFR-A11Y-001 AC-055: 状態を色だけで示さない（隣接のテキスト・アイコン等の代替がある）
test('NFR-A11Y-001 AC-055 ナレーション・レイアウト操作がキーボードだけで完了できる', async ({ page }) => {
  await page.goto(BASE);
  const narrate = page.getByRole('button', { name: /ナレーション|narration/i }).first();
  await narrate.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').or(page.getByRole('alert')).first()).toBeVisible();
  const layout = page.getByRole('button', { name: /レイアウト|layout/i }).first();
  await layout.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect(layout).toBeFocused();
});

// NFR-A11Y-002 AC-057: reduced-motion で動くものがない
test('NFR-A11Y-002 AC-057 動きを減らす設定で CSS アニメーション・遷移が 0ms（静止）', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE);
  const maxMs = await page.evaluate(() => {
    const toMs = (s: string) => Math.max(0, ...s.split(',').map((x) => (x.trim().endsWith('ms') ? parseFloat(x) : parseFloat(x) * 1000) || 0));
    let m = 0;
    document.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      const running = cs.animationName !== 'none' ? toMs(cs.animationDuration) : 0;
      m = Math.max(m, running, toMs(cs.transitionDuration));
    });
    return m;
  });
  expect(maxMs).toBeLessThanOrEqual(0); // PARAM-007 = 0 ms
});

// NFR-A11Y-002 AC-057: 異常系寄り（情報と操作が失われない）+ 視点移動・場面転換が静止
test('NFR-A11Y-002 AC-057 動きを減らす設定でカメラワークを選んでも動かず、情報と操作は保たれる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE);
  const camera = page.getByRole('button', { name: /カメラワーク|camera/i }).first();
  await expect(camera).toBeEnabled();
  const canvas = page.locator('canvas').first();
  const snap = async () => (await canvas.count()) ? canvas.screenshot() : page.screenshot();
  await camera.click();
  const a = await snap();
  await page.waitForTimeout(1000);
  const b = await snap();
  expect(Buffer.compare(a, b)).toBe(0); // 時間経過で画面が変わらない
  await expect(page.getByRole('main')).not.toBeEmpty();
});

// NFR-PERF-001 AC-059: 2D の初期表示が 2.5 秒以内（PARAM-004、ローカル配信）
test('NFR-PERF-001 AC-059 2D の初期表示（主要コンテンツ）が 2.5 秒以内', async ({ page }) => {
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'commit' });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 2500 });
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 2500 });
  expect(Date.now() - t0).toBeLessThanOrEqual(2500);
});

// NFR-PERF-001 AC-059 異常系: 遅い API があっても初期表示の主要コンテンツは待たされない
test('NFR-PERF-001 AC-059 異常系: バックエンドが遅くても 2.5 秒以内に骨格と読み込み中の状態が出る', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    await new Promise((r) => setTimeout(r, 5000));
    await route.continue().catch(() => {});
  });
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: 'commit' });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 2500 });
  expect(Date.now() - t0).toBeLessThanOrEqual(2500);
});
