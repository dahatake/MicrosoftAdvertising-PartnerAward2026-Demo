import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import {
  AssetPanel,
  DATA_STORAGE_KEY,
  DeploymentPanel,
  OrderPanel,
  PlanQuotePanel,
  advanceOrder,
  approveAsset,
  archiveAsset,
  beginRevision,
  cancelRevision,
  deployAsset,
  getDataset,
  getHistory,
  linkChannel,
  migrateDataset,
  registerAsset,
  registerOrder,
  reloadDataset,
  resetDataset,
  restoreVersion,
  saveRevision,
  saveUsage,
  seedDataset,
  setOrderState,
  transitionAsset,
  updateAssetMetadata,
  validateDataset,
  type Dataset,
} from './index';
import { resetSettings } from '../settings/store';
import { choose } from '../ui/choose';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(() => cleanup());

const NOW = new Date('2026-10-16T08:00:00Z');

// FR-014 AC-045 変更して保存すると新しい版・「改訂中」を経て戻る
describe('FR-014 AC-045 企画・見積の変更と版', () => {
  it('承認済みの見積を変更して保存すると新しい版ができ、改訂中を経て提出済みに戻る。履歴に版・日時・変更点が残る', () => {
    const q = seedDataset.quotes.find((x) => x.state === '承認済み')!;
    expect(getHistory(q.id)).toHaveLength(1);
    expect(beginRevision('quote', q.id).ok).toBe(true);
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('改訂中');
    const r = saveRevision('quote', q.id, { amount: 123456 }, NOW);
    expect(r.ok).toBe(true);
    const after = getDataset().quotes.find((x) => x.id === q.id)!;
    expect(after.state).toBe('提出済み');
    expect(after.version).toBe(q.version + 1);
    expect(after.amount).toBe(123456);
    const rows = getHistory(q.id);
    expect(rows).toHaveLength(2);
    expect(rows[1].at).toBe(NOW.toISOString());
    expect(rows[1].states).toEqual(['承認済み', '改訂中', '提出済み']);
    expect(rows[1].changes).toEqual([{ field: 'amount', from: q.amount, to: 123456 }]);
  });

  it('確定した企画は、保存で確定に戻る（変更を始めずに保存しても改訂中を経る）。下書きは下書きのまま', () => {
    const plan = seedDataset.plans.find((p) => p.state === '確定')!;
    expect(saveRevision('plan', plan.id, { title: '新しい題名' }, NOW).ok).toBe(true);
    const p = getDataset().plans.find((x) => x.id === plan.id)!;
    expect(p.state).toBe('確定');
    expect(getHistory(plan.id)[1].states).toEqual(['確定', '改訂中', '確定']);
    const draft = seedDataset.plans.find((x) => x.state === '下書き')!;
    expect(beginRevision('plan', draft.id).ok).toBe(true);
    expect(getDataset().plans.find((x) => x.id === draft.id)!.state).toBe('下書き');
    expect(saveRevision('plan', draft.id, { title: '下書きの変更' }, NOW).ok).toBe(true);
    expect(getDataset().plans.find((x) => x.id === draft.id)!.state).toBe('下書き');
  });

  it('異常系: 変更を始めただけでは版は増えず、取り消すと元の状態に戻る。変更なし・不正な金額は拒否される', () => {
    const q = seedDataset.quotes.find((x) => x.state === '承認済み')!;
    beginRevision('quote', q.id);
    expect(getHistory(q.id)).toHaveLength(1);
    cancelRevision('quote', q.id);
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('承認済み');
    expect(saveRevision('quote', q.id, { amount: q.amount }, NOW)).toMatchObject({ ok: false, code: 'nochange' });
    expect(saveRevision('quote', q.id, { amount: -5 }, NOW)).toMatchObject({ ok: false, code: 'amount' });
    expect(saveRevision('plan', 'pln-none', { title: 'x' }, NOW)).toMatchObject({ ok: false, code: 'notFound' });
    expect(getHistory(q.id)).toHaveLength(1);
  });

  it('画面: 編集 → 保存で履歴の行が 1 つ増え、状態が提出済みに戻る', () => {
    wrap(<PlanQuotePanel />);
    const quote = seedDataset.quotes.find((x) => x.state === '承認済み')!;
    fireEvent.click(document.querySelector(`[data-testid="quote-item"][data-entity-id="${quote.id}"]`)!);
    const n0 = screen.getAllByTestId('version-row').length;
    fireEvent.click(screen.getByTestId('edit-quote'));
    expect(screen.getByTestId('state-badge').textContent).toBe('改訂中');
    fireEvent.change(screen.getByTestId('quote-amount'), { target: { value: '123456' } });
    fireEvent.click(screen.getByTestId('save-quote'));
    const rows = screen.getAllByTestId('version-row');
    expect(rows).toHaveLength(n0 + 1);
    expect(rows[rows.length - 1].textContent).toContain('123,456');
    expect(screen.getByTestId('state-badge').textContent).toBe('提出済み');
  });
});

// FR-014 AC-046 旧版に戻す
describe('FR-014 AC-046 旧版に戻す', () => {
  it('旧版の内容が新しい版として保存され、履歴は失われない', () => {
    const q = seedDataset.quotes.find((x) => x.state === '承認済み')!;
    saveRevision('quote', q.id, { amount: 111 }, NOW);
    saveRevision('quote', q.id, { amount: 222 }, NOW);
    const before = getHistory(q.id).length;
    expect(restoreVersion('quote', q.id, q.version, NOW).ok).toBe(true);
    const rows = getHistory(q.id);
    expect(rows).toHaveLength(before + 1);
    expect(rows[rows.length - 1]).toMatchObject({ restoredFrom: q.version, snapshot: { amount: q.amount } });
    expect(getDataset().quotes.find((x) => x.id === q.id)!.amount).toBe(q.amount);
    // 古い版の行は残っている
    expect(rows.map((r) => r.version)).toEqual(expect.arrayContaining([q.version, q.version + 1, q.version + 2]));
  });

  it('異常系: 存在しない版、現在と同じ内容への戻しは拒否される。履歴は保存され再読み込みで復元される', () => {
    const q = seedDataset.quotes[0];
    expect(restoreVersion('quote', q.id, 99, NOW)).toMatchObject({ ok: false, code: 'notFound' });
    expect(restoreVersion('quote', q.id, q.version, NOW)).toMatchObject({ ok: false, code: 'nochange' });
    saveRevision('quote', q.id, { amount: 777 }, NOW);
    reloadDataset();
    expect(getHistory(q.id)).toHaveLength(2);
  });
});

// FR-016 AC-049 / AC-050
describe('FR-016 素材管理', () => {
  const projectId = () => seedDataset.projects[0].id;
  // FR-016 AC-049
  it('AC-049 素材（名前・種別・タグ・制作プロジェクト）を登録でき、チャネルに紐付けられ、メタデータを編集できる', () => {
    const r = registerAsset({ name: 'テスト素材', type: '画像', tags: 'a, b、c', projectId: projectId() });
    expect(r.ok).toBe(true);
    const a = (r as { value: { id: string } }).value;
    expect(getDataset().assets.find((x) => x.id === a.id)).toMatchObject({ name: 'テスト素材', tags: ['a', 'b', 'c'], state: '登録済' });
    expect(linkChannel(a.id, seedDataset.channels[0].id).ok).toBe(true);
    expect(linkChannel(a.id, seedDataset.channels[0].id).ok).toBe(true); // 重複して紐付かない
    expect(getDataset().assets.find((x) => x.id === a.id)!.channelIds).toEqual([seedDataset.channels[0].id]);
    expect(updateAssetMetadata(a.id, { name: '改名', type: '動画', tags: 'x', projectId: projectId() }).ok).toBe(true);
    expect(getDataset().assets.find((x) => x.id === a.id)).toMatchObject({ name: '改名', type: '動画', tags: ['x'] });
    expect(validateDataset(getDataset())).toEqual([]);
  });

  it('AC-049 画面: 登録するとプレビューつきの行が増え、チャネルに紐付けられる', () => {
    wrap(<AssetPanel />);
    const n0 = screen.getAllByTestId('asset-row').length;
    fireEvent.change(screen.getByTestId('asset-name'), { target: { value: 'ST-素材-A' } });
    choose(screen.getByTestId('asset-type'), '画像');
    choose(screen.getByTestId('asset-project'), projectId());
    fireEvent.click(screen.getByTestId('asset-register'));
    const rows = screen.getAllByTestId('asset-row');
    expect(rows).toHaveLength(n0 + 1);
    const row = rows.find((r) => r.textContent!.includes('ST-素材-A'))!;
    expect(within(row).getByTestId('asset-preview')).toBeTruthy();
    choose(within(row).getByTestId('asset-channel-select'), seedDataset.channels[0].id);
    fireEvent.click(within(row).getByTestId('asset-link-channel'));
    expect(within(row).getByTestId('asset-channels').textContent).toContain(seedDataset.channels[0].name);
  });

  // FR-016 AC-050
  it('AC-050 必須のメタデータが欠けると、原因と次の行動を示すエラーになり、入力済みの内容は失われない', () => {
    const before = getDataset().assets.length;
    expect(registerAsset({ name: '', type: '画像', tags: '', projectId: projectId() })).toMatchObject({ ok: false, code: 'required', field: 'name' });
    expect(registerAsset({ name: 'x', type: '', tags: '', projectId: projectId() })).toMatchObject({ ok: false, field: 'type' });
    expect(registerAsset({ name: 'x', type: '画像', tags: '', projectId: 'nope' })).toMatchObject({ ok: false, field: 'project' });
    expect(getDataset().assets).toHaveLength(before);
    wrap(<AssetPanel />);
    fireEvent.change(screen.getByTestId('asset-name'), { target: { value: '入力済み' } });
    fireEvent.click(screen.getByTestId('asset-register'));
    const err = screen.getByTestId('asset-error').textContent!;
    expect(err).toContain('種別');
    expect(err).toContain('もう一度');
    expect((screen.getByTestId('asset-name') as HTMLInputElement).value).toBe('入力済み');
    expect(getDataset().assets).toHaveLength(before);
  });
});

// FR-017 AC-051 / AC-052
describe('FR-017 外部発注の管理', () => {
  const base = () => ({ projectId: seedDataset.projects[0].id, vendorId: seedDataset.vendors[0].id, amount: 450000, dueDate: '2026-12-31' });
  // FR-017 AC-051
  it('AC-051 発注を登録し、依頼前から検収済みまで順に進められる', () => {
    const r = registerOrder(base());
    expect(r.ok).toBe(true);
    const id = (r as { value: { id: string } }).value.id;
    expect(getDataset().orders.find((o) => o.id === id)).toMatchObject({ state: '依頼前', amount: 450000, dueDate: '2026-12-31' });
    for (const s of ['発注済', '納品済', '検収済']) {
      expect(advanceOrder(id).ok).toBe(true);
      expect(getDataset().orders.find((o) => o.id === id)!.state).toBe(s);
    }
    expect(advanceOrder(id).ok).toBe(false); // 最終状態
  });

  it('AC-051 画面: 登録した行に発注先・金額・納期・状態が出て、最終状態では進める操作が無効', () => {
    wrap(<OrderPanel />);
    choose(screen.getByTestId('order-vendor'), seedDataset.vendors[0].id);
    fireEvent.change(screen.getByTestId('order-amount'), { target: { value: '450000' } });
    fireEvent.change(screen.getByTestId('order-due'), { target: { value: '2026-12-31' } });
    fireEvent.click(screen.getByTestId('order-register'));
    const rows = screen.getAllByTestId('order-row');
    const row = rows[rows.length - 1];
    for (const word of [seedDataset.vendors[0].name, '450,000', '2026-12-31', '依頼前']) expect(row.textContent).toContain(word);
    for (let i = 0; i < 3; i++) fireEvent.click(within(row).getByTestId('order-advance'));
    expect(row.textContent).toContain('検収済');
    expect((within(row).getByTestId('order-advance') as HTMLButtonElement).disabled).toBe(true);
  });

  it('AC-051 異常系: 必須の欠け・不正な金額と納期は拒否され、入力は残る', () => {
    const n = getDataset().orders.length;
    expect(registerOrder({ ...base(), vendorId: '' })).toMatchObject({ ok: false, field: 'vendor' });
    expect(registerOrder({ ...base(), amount: 0 })).toMatchObject({ ok: false, code: 'amount' });
    expect(registerOrder({ ...base(), dueDate: '2026/12/31' })).toMatchObject({ ok: false, code: 'date' });
    expect(registerOrder({ ...base(), dueDate: '2026-02-30' })).toMatchObject({ ok: false, code: 'date' });
    expect(getDataset().orders).toHaveLength(n);
    wrap(<OrderPanel />);
    fireEvent.change(screen.getByTestId('order-amount'), { target: { value: '5000' } });
    fireEvent.click(screen.getByTestId('order-register'));
    expect(screen.getByTestId('order-error').textContent).toContain('発注先');
    expect((screen.getByTestId('order-amount') as HTMLInputElement).value).toBe('5000');
  });

  // FR-017 AC-052
  it('AC-052 状態の逆戻り・飛び越しは拒否され、理由が出る。データは変わらない', () => {
    const id = (registerOrder(base()) as { value: { id: string } }).value.id;
    expect(setOrderState(id, '納品済')).toMatchObject({ ok: false, code: 'skip' });
    expect(setOrderState(id, '依頼前')).toMatchObject({ ok: false, code: 'same' });
    setOrderState(id, '発注済');
    expect(setOrderState(id, '依頼前')).toMatchObject({ ok: false, code: 'backward' });
    expect(getDataset().orders.find((o) => o.id === id)!.state).toBe('発注済');
  });
});

// FR-019 AC-070 / AC-071 / AC-072
describe('FR-019 素材の展開と KPI・利用状況', () => {
  const approvedAsset = () => seedDataset.assets.find((a) => a.state === '承認済')!;
  const ch = () => seedDataset.channels[0].id;
  // FR-019 AC-070
  it('AC-070 承認済みの素材を展開すると「展開中」になり、展開が作られる。アーカイブで「アーカイブ」になる', () => {
    const a = approvedAsset();
    const n = getDataset().deployments.length;
    const r = deployAsset(a.id, ch(), NOW);
    expect(r.ok).toBe(true);
    expect(getDataset().assets.find((x) => x.id === a.id)!.state).toBe('展開中');
    expect(getDataset().deployments).toHaveLength(n + 1);
    expect(getDataset().deployments.at(-1)).toMatchObject({ assetId: a.id, channelId: ch(), state: '展開中' });
    expect(archiveAsset(a.id).ok).toBe(true);
    expect(getDataset().assets.find((x) => x.id === a.id)!.state).toBe('アーカイブ');
    expect(getDataset().deployments.filter((d) => d.assetId === a.id).every((d) => d.state === '終了')).toBe(true);
  });

  it('AC-070 画面: 展開・アーカイブで状態の表示が変わり、アーカイブ後は再展開できない', () => {
    wrap(<AssetPanel />);
    const a = approvedAsset();
    const row = () => document.querySelector(`[data-testid="asset-row"][data-entity-id="${a.id}"]`) as HTMLElement;
    choose(within(row()).getByTestId('asset-deploy-channel'), ch());
    fireEvent.click(within(row()).getByTestId('asset-deploy'));
    expect(within(row()).getByTestId('asset-state').getAttribute('data-state')).toBe('deploying');
    fireEvent.click(within(row()).getByTestId('asset-archive'));
    expect(within(row()).getByTestId('asset-state').getAttribute('data-state')).toBe('archived');
    expect((within(row()).getByTestId('asset-deploy') as HTMLButtonElement).disabled).toBe(true);
  });

  // FR-019 AC-071
  it('AC-071 利用状況と KPI の目標値を登録・更新すると KPI に反映され、localStorage に保存される', () => {
    const dep = seedDataset.deployments[0];
    const asset = seedDataset.assets.find((x) => x.id === dep.assetId)!;
    const campaignId = seedDataset.projects.find((p) => p.id === asset.projectId)!.campaignId;
    const kpi = seedDataset.kpis.find((k) => k.campaignId === campaignId)!;
    expect(saveUsage({ deploymentId: dep.id, actual: 4321, target: 9000 }).ok).toBe(true);
    const k = getDataset().kpis.find((x) => x.id === kpi.id)!;
    expect([k.actual, k.target]).toEqual([4321, 9000]);
    expect(getDataset().usages.find((u) => u.deploymentId === dep.id)!.actual).toBe(4321);
    expect(localStorage.getItem(DATA_STORAGE_KEY)).toContain('4321');
    reloadDataset();
    expect(getDataset().kpis.find((x) => x.id === kpi.id)!.actual).toBe(4321);
    // 更新（上書き）できる。片方だけの更新もできる
    expect(saveUsage({ deploymentId: dep.id, target: 9500 }).ok).toBe(true);
    expect(getDataset().kpis.find((x) => x.id === kpi.id)).toMatchObject({ actual: 4321, target: 9500 });
  });

  it('AC-071 異常系: 空・不正な値・KPI のない展開は拒否される', () => {
    const dep = seedDataset.deployments[0];
    expect(saveUsage({ deploymentId: dep.id })).toMatchObject({ ok: false, code: 'required' });
    expect(saveUsage({ deploymentId: dep.id, actual: -1 })).toMatchObject({ ok: false, code: 'number' });
    expect(saveUsage({ deploymentId: dep.id, actual: 'abc' })).toMatchObject({ ok: false, code: 'number' });
    expect(saveUsage({ deploymentId: 'dpl-none', actual: 1 })).toMatchObject({ ok: false, code: 'notFound' });
    updateDatasetNoKpis();
    expect(saveUsage({ deploymentId: dep.id, actual: 1 })).toMatchObject({ ok: false, code: 'noKpi' });
  });

  it('AC-071 画面: 展開を選んで登録すると展開の行に利用状況が出る', () => {
    wrap(<DeploymentPanel />);
    fireEvent.click(screen.getAllByTestId('deployment-row')[0]);
    fireEvent.change(screen.getByTestId('usage-actual'), { target: { value: '4321' } });
    fireEvent.change(screen.getByTestId('kpi-target-input'), { target: { value: '9000' } });
    fireEvent.click(screen.getByTestId('usage-save'));
    expect(screen.getAllByTestId('deployment-row')[0].textContent).toContain('4,321');
  });

  // FR-019 AC-072
  it('AC-072 素材の状態の逆戻り・飛び越しは拒否され、理由が出る', () => {
    const reg = registerAsset({ name: 'x', type: '画像', tags: '', projectId: seedDataset.projects[0].id }) as { value: { id: string } };
    const id = reg.value.id;
    expect(deployAsset(id, ch())).toMatchObject({ ok: false, code: 'skip' }); // 登録済→展開中
    expect(archiveAsset(id)).toMatchObject({ ok: false, code: 'skip' });
    expect(approveAsset(id).ok).toBe(true);
    expect(transitionAsset(id, '登録済')).toMatchObject({ ok: false, code: 'backward' });
    deployAsset(id, ch());
    archiveAsset(id);
    expect(deployAsset(id, ch())).toMatchObject({ ok: false, code: 'backward' }); // アーカイブ→展開中
    expect(approveAsset(id)).toMatchObject({ ok: false, code: 'backward' });
    expect(getDataset().assets.find((x) => x.id === id)!.state).toBe('アーカイブ');
  });
});

function updateDatasetNoKpis() {
  const d = getDataset();
  // KPI を持たない状態を、保存経由で作る
  localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ schema: 2, revision: 1, data: { ...d, kpis: [] } }));
  reloadDataset();
}

// シード状態値の語と、localStorage 版の移行
describe('状態値の移行（schema 1 → 2）', () => {
  it('シードの状態値は要求定義書の語（計画中/制作中…、登録済/承認済/展開中/アーカイブ、依頼前/発注済/納品済/検収済）', () => {
    const d = seedDataset;
    expect(new Set(d.projects.map((p) => p.status))).toEqual(new Set(['計画中', '制作中', '完了']));
    expect(d.assets.every((a) => ['登録済', '承認済', '展開中', 'アーカイブ'].includes(a.state))).toBe(true);
    expect(d.orders.every((o) => ['依頼前', '発注済', '納品済', '検収済'].includes(o.state))).toBe(true);
    expect(d.plans.every((p) => ['下書き', '確定', '改訂中'].includes(p.state))).toBe(true);
    expect(d.quotes.every((q) => ['下書き', '提出済み', '承認済み', '改訂中'].includes(q.state))).toBe(true);
  });

  it('旧い保存データ（schema 1）は読み込み時に新しい語へ直る。履歴は初版から始まる', () => {
    const old: Dataset = structuredClone(seedDataset);
    old.projects[0].status = '進行中';
    old.projects[1].status = '未着手';
    old.orders[0].state = '発注済み';
    old.assets[0].state = 'アーカイブ済み';
    old.assets[1].state = '登録済み';
    old.plans[0].state = '承認済み';
    old.quotes[0].state = '承認待ち';
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ schema: 1, revision: 5, data: old }));
    const d = reloadDataset();
    expect(d.projects[0].status).toBe('制作中');
    expect(d.projects[1].status).toBe('計画中');
    expect(d.orders[0].state).toBe('発注済');
    expect(d.assets[0].state).toBe('アーカイブ');
    expect(d.assets[1].state).toBe('登録済');
    expect(d.plans[0].state).toBe('確定');
    expect(d.quotes[0].state).toBe('提出済み');
    expect(getHistory(d.quotes[0].id)).toHaveLength(1);
    expect(migrateDataset(old)).not.toBe(old);
  });
});
