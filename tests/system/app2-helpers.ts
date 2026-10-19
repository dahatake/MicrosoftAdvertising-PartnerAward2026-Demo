// App2 の System Test 共通部品（FR-024〜026 導入後の画面）。期待値は要求定義書の受入基準だけから決める。
// 画面の契約（app2-layout-nav.spec.ts 冒頭に加えて）:
//   - 業務領域の画面は 1 領域ずつ表示する（FR-025・Q-006 A）。領域への操作対象の割当は FR-025 のメニュー名どおり:
//       relation: campaign-item / relation-node / node-detail / relation-view(-3d)
//       plan: plan-item、quote: quote-item / edit-quote / save-quote / version-row / state-badge
//       production: project-item と project-*、order: order-*、asset: asset-*（登録フォーム・一覧・asset-filter）
//       deploy: deployment-row、usage: deployment-row（選ぶと usage-actual / kpi-target-input / usage-save）
//       kpi: whatif-*
//     ペルソナ・表現・表示方法・言語・カメラワークは領域に依らず常に画面にある。
//   - 選択項目（旧 select）は、同じ data-testid のボタン群（role=radiogroup、各ボタン role=radio・aria-checked）。
//     先頭の選択肢は空の「選択してください」ではなく実際の値。値は各ボタンの data-value。
//   - ペルソナは data-testid=persona-buttons の radiogroup（順序 P-3, P-4, P-5。data-value=P-3|P-4|P-5）、
//     表現は representation-select の radiogroup（data-value=table|graph|gantt|relation）。
//   - 件数が多い一覧は 1 画面に収まる件数ずつ表示し、ページ送りのボタン（data-testid が -pager で終わる要素の中の
//     「次へ」ボタン。名前は 次|next|下一|다음）で全件に到達できる（AC-100）。
import { expect, Locator, Page } from '@playwright/test';

export const T = (page: Page, id: string) => page.getByTestId(id);

export async function go(page: Page, key: string) {
  await T(page, `nav-item-${key}`).click();
  await expect(T(page, `area-root-${key}`)).toBeVisible();
}

/** ボタン群（旧 select）で、scope 内の group の index 番目の選択肢を選ぶ */
export async function pick(scope: Page | Locator, group: string, index = 0) {
  const r = scope.getByTestId(group).getByRole('radio').nth(index);
  await r.click();
  await expect(r).toHaveAttribute('aria-checked', 'true');
}
export async function pickValue(page: Page, group: string, value: string) {
  const r = T(page, group).locator(`[role=radio][data-value="${value}"]`);
  await r.click();
  await expect(r).toHaveAttribute('aria-checked', 'true');
}
export async function checkedValue(page: Page, group: string) {
  return T(page, group).locator('[role=radio][aria-checked=true]').first().getAttribute('data-value');
}

/** 選択中か（aria-selected / aria-checked / aria-current のいずれかが true） */
export async function isSelected(el: Locator) {
  return el.evaluate((e) => ['aria-selected', 'aria-checked', 'aria-current'].some((a) => e.getAttribute(a) === 'true' || e.getAttribute(a) === 'page'));
}

/** 現在の領域で、loc が見えるまでページ送り（次へ）する。見つかった loc を返す（最大 40 ページ） */
export async function findOnPages(page: Page, loc: Locator): Promise<Locator> {
  for (let i = 0; i < 40; i++) {
    if ((await loc.count()) > 0 && (await loc.first().isVisible())) return loc.first();
    const next = page.locator('[data-testid$="-pager"]').getByRole('button', { name: /次|next|下一|다음/i }).filter({ hasNot: page.locator('[disabled]') });
    let clicked = false;
    const n = await next.count();
    for (let j = 0; j < n; j++) {
      const b = next.nth(j);
      if (await b.isEnabled()) { await b.click(); clicked = true; break; }
    }
    if (!clicked) break;
  }
  await expect(loc.first()).toBeVisible();
  return loc.first();
}
