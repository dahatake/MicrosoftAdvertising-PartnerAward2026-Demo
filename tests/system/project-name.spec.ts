import { test, expect, type Page } from '@playwright/test';
import { dictionaries } from '../../src/i18n';

// FR-022 AC-086: 期待値は AC の正式名称だけ。辞書は検査対象であり正解には使わない。
// translate() のフォールバックや加工後の表示だけでは app.title 自体の誤りを隠せるため、
// 各ロケールの生の値も完全一致で検査する。機械向け識別子は対象外。
const OFFICIAL_NAME = 'MicrosoftAdvertising-PartnerAward2026-Demo';
const OLD_NAME = 'MicrosoftAdvertizingPartnerAward2026-Demo';
const LOCALES = ['en', 'ja', 'ko', 'zh'] as const;

async function expectOfficialName(page: Page) {
  const heading = page.getByRole('banner').getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(OFFICIAL_NAME);
  await expect.poll(() => heading.textContent()).toBe(OFFICIAL_NAME);
  await expect(page).toHaveTitle(OFFICIAL_NAME);
}

// FR-022 AC-086 正常系: 4 言語すべてで辞書・可視見出し・document.title を検査する。
test('FR-022 AC-086 4言語の app.title・可視見出し・document.title が正式名称と完全一致', async ({ page }) => {
  await page.goto('/');
  for (const locale of LOCALES) {
    await test.step(locale, async () => {
      expect.soft(dictionaries[locale]['app.title']).toBe(OFFICIAL_NAME);
      await page.getByTestId('lang-select').selectOption(locale);
      await expect(page.getByTestId('lang-select')).toHaveValue(locale);
      await expectOfficialName(page);
    });
  }
});

// FR-022 AC-086 異常系（回帰検知）: 言語切替で旧名や翻訳名に戻る不具合を拒否する。
// 未指定の不正入力時の挙動は要求しない。各ケースは独立したブラウザー状態で開始する。
test('FR-022 AC-086 異常系: 連続切替と元の言語への復帰でも旧名・翻訳名に戻らない', async ({ page }) => {
  await page.goto('/');
  for (const locale of ['en', 'ja', 'ko', 'zh', 'en'] as const) {
    await page.getByTestId('lang-select').selectOption(locale);
    await expect(page.getByTestId('lang-select')).toHaveValue(locale);
    await expectOfficialName(page);
    await expect(page.getByRole('banner').getByRole('heading', { level: 1 })).not.toContainText(OLD_NAME);
    await expect(page).not.toHaveTitle(OLD_NAME);
  }
});
