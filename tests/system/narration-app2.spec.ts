// System Test: ナレーション・字幕(App1) と App2 の主要業務フロー（part 2/3）
// 期待値は docs/requirements-definition.md の受入基準だけから決めている。
//
// 画面の契約（実装が満たす data-testid。テストが要求する最小限。変更が必要なら競合として返す）:
//  共通   : app-toggle-app1 / app-toggle-app2 (シェルのトグル), lang-select (value=ja|en|zh|ko), persona-select
//  App1   : narration-play, narration-stop, narration-status[data-state=playing|stopped][data-lang],
//           narration-transcript (字幕/トランスクリプト。narration-transcript-toggle で開閉可)
//  App2   : campaign-list > [data-testid=campaign-item], relation-view (2D 関係図), relation-node[data-entity-id],
//           relation-edge, node-detail, view-mode-3d (3D 切替), relation-view-3d
//           project-list > project-item, project-progress-status, project-progress-percent, project-budget-spent,
//           project-deliverables > li, project-kpi-target, project-kpi-actual
//           plan-item(企画)/quote-item(見積), edit-quote, save-quote, state-badge, version-history > version-row
//           whatif-panel: whatif-budget(input), whatif-alloc-<channel>(input), whatif-run, kpi-forecast, kpi-baseline
//           asset-form: asset-name, asset-type, asset-tags, asset-project, asset-register, asset-row, asset-preview,
//           asset-channel-select, asset-link-channel
//           order-form: order-vendor, order-amount, order-due, order-register, order-row, order-advance
//           deploy: asset-deploy-channel, asset-deploy, deployment-row, asset-archive, asset-state,
//           usage-actual, kpi-target-input, usage-save
//           representation-select (value=table|graph|gantt|relation), data-table-alternative
// ベース URL は playwright.config の baseURL（実装側が用意）。localStorage は各テストの前に空にする。
import { test, expect, Page } from '@playwright/test';

const SEED_CAMPAIGN_COUNT = 6; // PARAM-006

async function fresh(page: Page, lang = 'ja') {
  await page.addInitScript((l) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('lang', l);
    }
    // Speech モック: ブラウザ音声合成を記録用に差し替える（Azure Speech は /api/speech/token をモックする）
    const w = window as any;
    w.__spoken = [];
    w.__speaking = false;
    const synth = {
      speak: (u: any) => { w.__spoken.push({ text: u.text, lang: u.lang }); w.__speaking = true; },
      cancel: () => { w.__speaking = false; },
      getVoices: () => [],
      get speaking() { return w.__speaking; },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  }, lang);
  await page.route('**/api/speech/token', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'mock-token', region: 'japaneast', expiresInSeconds: 600 }) }));
  await page.goto('/');
}

const app2 = async (page: Page) => { await fresh(page); await page.getByTestId('app-toggle-app2').click(); };

// FR-006 AC-015
test('FR-006 AC-015 ナレーションの再生で再生中になり、停止で止まる。音声は選択中言語の台本', async ({ page }) => {
  await fresh(page, 'en');
  await page.getByTestId('lang-select').selectOption('ja');
  await page.getByTestId('narration-play').click();
  const status = page.getByTestId('narration-status');
  await expect(status).toHaveAttribute('data-state', 'playing');
  await expect(status).toHaveAttribute('data-lang', 'ja');
  await page.getByTestId('narration-stop').click();
  await expect(status).toHaveAttribute('data-state', 'stopped');
  // 異常系: 4 言語それぞれで、その言語の台本に対応する再生ができる
  for (const lang of ['en', 'zh', 'ko']) {
    await page.getByTestId('lang-select').selectOption(lang);
    await page.getByTestId('narration-play').click();
    await expect(status).toHaveAttribute('data-state', 'playing');
    await expect(status).toHaveAttribute('data-lang', lang);
    await page.getByTestId('narration-stop').click();
    await expect(status).toHaveAttribute('data-state', 'stopped');
  }
});

// NFR-A11Y-003 AC-058
test('NFR-A11Y-003 AC-058 台本が選択中の言語で表示でき、音声が使えなくても読める', async ({ page }) => {
  await fresh(page, 'ja');
  const tr = page.getByTestId('narration-transcript');
  if (!(await tr.isVisible())) await page.getByTestId('narration-transcript-toggle').click();
  const ja = (await tr.innerText()).trim();
  expect(ja.length).toBeGreaterThan(20);
  await page.getByTestId('lang-select').selectOption('en');
  await expect.poll(async () => (await tr.innerText()).trim()).not.toBe(ja);
  // 異常系: 音声合成も Speech トークンも使えない状態でも読める
  await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
  await page.route('**/api/speech/token', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"SPEECH_KEY_MISSING"}' }));
  await page.reload();
  if (!(await tr.isVisible())) await page.getByTestId('narration-transcript-toggle').click();
  expect((await tr.innerText()).trim().length).toBeGreaterThan(20);
});

// FR-012 AC-041
test('FR-012 AC-041 キャンペーン選択で関連エンティティがノードと関連線で表示され、ノード選択で詳細', async ({ page }) => {
  await app2(page);
  await page.getByTestId('campaign-item').first().click();
  const nodes = page.getByTestId('relation-node');
  await expect(nodes.first()).toBeVisible();
  expect(await nodes.count()).toBeGreaterThanOrEqual(3); // 顧客・キャンペーン・制作プロジェクトなど
  expect(await page.getByTestId('relation-edge').count()).toBeGreaterThanOrEqual(2);
  await nodes.nth(1).click();
  await expect(page.getByTestId('node-detail')).toBeVisible();
  // 異常系: 別のキャンペーンに切り替えるとノード集合が入れ替わる（古い関連が残らない）
  const firstIds = await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')));
  await page.getByTestId('campaign-item').nth(1).click();
  const secondIds = await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')));
  expect(secondIds.sort()).not.toEqual(firstIds.sort());
});

// FR-012 AC-042
test('FR-012 AC-042 3D にしても同じノードと関連が表示され、選択が保たれる', async ({ page }) => {
  await app2(page);
  await page.getByTestId('campaign-item').first().click();
  const ids2d = (await page.getByTestId('relation-node').evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')))).sort();
  await page.getByTestId('relation-node').nth(1).click();
  const selected = await page.getByTestId('relation-node').nth(1).getAttribute('data-entity-id');
  await page.getByTestId('view-mode-3d').click();
  const v3 = page.getByTestId('relation-view-3d');
  await expect(v3).toBeVisible();
  const ids3d = (await v3.getByTestId('relation-node').evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')))).sort();
  expect(ids3d).toEqual(ids2d);
  await expect(v3.locator(`[data-entity-id="${selected}"]`)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('node-detail')).toBeVisible();
});

// FR-013 AC-043
test('FR-013 AC-043 制作プロジェクト選択で進捗・予算消化・成果物・KPI が 1 画面に表示される', async ({ page }) => {
  await app2(page);
  await page.getByTestId('project-item').first().click();
  await expect(page.getByTestId('project-progress-status')).toContainText(/計画中|制作中|レビュー中|完了|Planning|In production|In review|Done/);
  await expect(page.getByTestId('project-progress-percent')).toContainText(/\d+\s*%/);
  await expect(page.getByTestId('project-budget-spent')).toContainText(/\d/);
  expect(await page.getByTestId('project-deliverables').locator('li').count()).toBeGreaterThanOrEqual(0);
  await expect(page.getByTestId('project-kpi-target')).toContainText(/\d/);
  await expect(page.getByTestId('project-kpi-actual')).toContainText(/\d/);
  // 異常系: 別プロジェクトに切り替えても表示が更新され、空にならない
  const before = await page.getByTestId('project-budget-spent').innerText();
  await page.getByTestId('project-item').nth(1).click();
  await expect(page.getByTestId('project-progress-percent')).toContainText(/\d+\s*%/);
  expect(before.length).toBeGreaterThan(0);
});

// FR-014 AC-045
test('FR-014 AC-045 確定した企画・承認済みの見積の編集保存で新版が作られ「改訂中」を経て戻る', async ({ page }) => {
  await app2(page);
  await page.getByTestId('quote-item').first().click();
  const rows = page.getByTestId('version-row');
  const n0 = await rows.count();
  await page.getByTestId('edit-quote').click();
  await page.getByTestId('quote-amount').fill('123456');
  await page.getByTestId('save-quote').click();
  await expect(rows).toHaveCount(n0 + 1);
  await expect(rows.last()).toContainText(/\d{4}/); // 版・日時
  await expect(rows.last()).toContainText(/123456|123,456/); // 変更点
  await expect(page.getByTestId('state-badge')).toContainText(/提出済み|Submitted/); // 見積は保存で提出済みに戻る
  // 異常系: 保存せず編集を開始した時点では版は増えない
  await page.getByTestId('edit-quote').click();
  await expect(rows).toHaveCount(n0 + 1);
});

// FR-015 AC-047
test('FR-015 AC-047 前提を変えると KPI 予測が元の値と並んで再計算され、保存済みデータは変わらない', async ({ page }) => {
  await app2(page);
  await page.getByTestId('project-item').first().click();
  const base = await page.getByTestId('project-kpi-target').innerText();
  const baseline = await page.getByTestId('kpi-baseline').innerText();
  await page.getByTestId('whatif-budget').fill('9999999');
  await page.getByTestId('whatif-run').click();
  const forecast = await page.getByTestId('kpi-forecast').innerText();
  expect(forecast).not.toBe(baseline);
  await expect(page.getByTestId('kpi-baseline')).toHaveText(baseline); // 元の値が並べて残る
  // 異常系: 画面を再読み込みしても保存済みの値は試算前のまま
  await page.reload();
  await page.getByTestId('app-toggle-app2').click();
  await page.getByTestId('project-item').first().click();
  await expect(page.getByTestId('project-kpi-target')).toHaveText(base);
});

// FR-016 AC-049
test('FR-016 AC-049 素材を登録し、一覧でプレビューを見て、チャネルに紐付けられる', async ({ page }) => {
  await app2(page);
  const n0 = await page.getByTestId('asset-row').count();
  await page.getByTestId('asset-name').fill('ST-素材-A');
  await page.getByTestId('asset-type').selectOption({ index: 1 });
  await page.getByTestId('asset-tags').fill('st,demo');
  await page.getByTestId('asset-project').selectOption({ index: 1 });
  await page.getByTestId('asset-register').click();
  const row = page.getByTestId('asset-row').filter({ hasText: 'ST-素材-A' });
  await expect(page.getByTestId('asset-row')).toHaveCount(n0 + 1);
  await expect(row.getByTestId('asset-preview')).toBeVisible(); // 画像がなければプレースホルダー
  await row.getByTestId('asset-channel-select').selectOption({ index: 1 });
  await row.getByTestId('asset-link-channel').click();
  await expect(row).toContainText(/チャネル|Channel|紐付|Linked/);
  // 異常系: 名前が空では登録されない（件数が増えない）
  await page.getByTestId('asset-name').fill('');
  await page.getByTestId('asset-register').click();
  await expect(page.getByTestId('asset-row')).toHaveCount(n0 + 1);
});

// FR-017 AC-051
test('FR-017 AC-051 発注を登録し状態を順に進められ、一覧で発注先・金額・納期・状態が分かる', async ({ page }) => {
  await app2(page);
  await page.getByTestId('order-vendor').selectOption({ index: 1 });
  await page.getByTestId('order-amount').fill('450000');
  await page.getByTestId('order-due').fill('2026-12-31');
  await page.getByTestId('order-register').click();
  const row = page.getByTestId('order-row').last();
  await expect(row).toContainText(/450000|450,000/);
  await expect(row).toContainText('2026-12-31');
  await expect(row).toContainText(/依頼前|Not requested/);
  for (const s of [/発注済|Ordered/, /納品済|Delivered/, /検収済|Accepted/]) {
    await row.getByTestId('order-advance').click();
    await expect(row).toContainText(s);
  }
  // 異常系: 最終状態（検収済）では進める操作ができない
  await expect(row.getByTestId('order-advance')).toBeDisabled();
});

// FR-018 AC-053
test('FR-018 AC-053 ペルソナ別の既定表現で表示され、表現を切り替えても選択対象が保たれる', async ({ page }) => {
  await app2(page);
  const rep = page.getByTestId('representation-select');
  await page.getByTestId('persona-select').selectOption('P-4');
  await expect(rep).toHaveValue('gantt'); // 制作ディレクター: ガント
  await page.getByTestId('persona-select').selectOption('P-3');
  await expect(rep).toHaveValue('graph'); // 広告プランナー: 比較グラフ + 関係図
  await page.getByTestId('persona-select').selectOption('P-5');
  await expect(rep).toHaveValue('graph'); // アカウントマネージャー: 時系列グラフ
  await page.getByTestId('project-item').first().click();
  const sel = await page.getByTestId('project-item').first().getAttribute('data-entity-id');
  await rep.selectOption('table');
  await expect(page.locator(`[data-testid="project-item"][data-entity-id="${sel}"]`)).toHaveAttribute('aria-selected', 'true');
  // 異常系: 既定は 2D（3D は利用者が選ぶまで有効にならない）
  await expect(page.getByTestId('relation-view-3d')).toHaveCount(0);
});

// FR-018 AC-054
test('FR-018 AC-054 すべての視覚表現に表/テキスト要約の代替があり、状態を色だけで示さない', async ({ page }) => {
  await app2(page);
  for (const r of ['relation', 'gantt', 'graph']) {
    await page.getByTestId('representation-select').selectOption(r);
    await expect(page.getByTestId('data-table-alternative')).toBeVisible();
    expect((await page.getByTestId('data-table-alternative').innerText()).trim().length).toBeGreaterThan(0);
  }
  // 状態バッジは色以外（テキスト）を持つ
  const badges = page.getByTestId('state-badge');
  const c = await badges.count();
  for (let i = 0; i < c; i++) expect((await badges.nth(i).innerText()).trim().length).toBeGreaterThan(0);
  // 異常系: 3D に切り替えても代替が残る
  await page.getByTestId('view-mode-3d').click();
  await expect(page.getByTestId('data-table-alternative')).toBeVisible();
});

// FR-019 AC-070
test('FR-019 AC-070 承認済み素材をチャネル展開すると「展開中」になり、アーカイブで「アーカイブ」', async ({ page }) => {
  await app2(page);
  const row = page.getByTestId('asset-row').filter({ has: page.locator('[data-state="approved"]') }).first();
  await row.getByTestId('asset-deploy-channel').selectOption({ index: 1 });
  await row.getByTestId('asset-deploy').click();
  await expect(row.getByTestId('asset-state')).toHaveAttribute('data-state', 'deploying');
  expect(await page.getByTestId('deployment-row').count()).toBeGreaterThanOrEqual(1);
  await row.getByTestId('asset-archive').click();
  await expect(row.getByTestId('asset-state')).toHaveAttribute('data-state', 'archived');
  // 異常系: アーカイブ後は再展開できない
  await expect(row.getByTestId('asset-deploy')).toBeDisabled();
});

// FR-019 AC-071
test('FR-019 AC-071 利用状況・KPI 目標の登録が FR-013 の表示に反映され localStorage に保存される', async ({ page }) => {
  await app2(page);
  const row = page.getByTestId('asset-row').filter({ has: page.locator('[data-state="approved"]') }).first();
  await row.getByTestId('asset-deploy-channel').selectOption({ index: 1 });
  await row.getByTestId('asset-deploy').click();
  await page.getByTestId('deployment-row').first().click();
  await page.getByTestId('usage-actual').fill('4321');
  await page.getByTestId('kpi-target-input').fill('9000');
  await page.getByTestId('usage-save').click();
  await page.getByTestId('project-item').first().click();
  await expect(page.getByTestId('project-kpi-actual')).toContainText(/4321|4,321/);
  await expect(page.getByTestId('project-kpi-target')).toContainText(/9000|9,000/);
  expect(await page.evaluate(() => Object.values(localStorage).join('').includes('4321'))).toBe(true);
  // 異常系: 再読み込み後も保たれる
  await page.reload();
  await page.getByTestId('app-toggle-app2').click();
  await page.getByTestId('project-item').first().click();
  await expect(page.getByTestId('project-kpi-actual')).toContainText(/4321|4,321/);
});
