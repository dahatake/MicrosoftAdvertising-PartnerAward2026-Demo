import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import {
  DATA_STORAGE_KEY,
  AssetThumb,
  CampaignRelations,
  RelationView,
  buildRelations,
  getDataset,
  getRevision,
  reloadDataset,
  removeEntity,
  resetDataset,
  seedDataset,
  upsertEntity,
  validateDataset,
  type Dataset,
} from './index';
import { resetSettings, updateSettings } from '../settings/store';
import { set3dSupport } from '../view';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(() => {
  cleanup();
  set3dSupport(undefined);
});

// FR-011 AC-039 シードの規模（PARAM-006）・参照の解決・必須項目
describe('FR-011 AC-039 シード JSON', () => {
  it('PARAM-006 の規模（顧客 3、キャンペーン 6、制作プロジェクト 12、発注 10、素材 30）', () => {
    const d = seedDataset;
    expect([d.customers.length, d.campaigns.length, d.projects.length, d.orders.length, d.assets.length]).toEqual([3, 6, 12, 10, 30]);
    expect(d.organization.name).toBe('Microsoft Advertizing Tokyo - 畠山支店');
    expect(d.campaigns.every((c) => c.product === 'Surface Ultra')).toBe(true);
  });
  it('すべての参照が解決でき、必須項目が欠けていない', () => {
    expect(validateDataset(seedDataset)).toEqual([]);
  });
  it('発注 → 制作プロジェクト → キャンペーン → 顧客がたどれる', () => {
    const d = seedDataset;
    for (const o of d.orders) {
      const p = d.projects.find((x) => x.id === o.projectId)!;
      const c = d.campaigns.find((x) => x.id === p.campaignId)!;
      expect(d.customers.some((x) => x.id === c.customerId)).toBe(true);
    }
  });
  it('異常系: 参照切れ・必須欠け・重複 ID を検出する', () => {
    const bad: Dataset = structuredClone(seedDataset);
    bad.orders[0].projectId = 'prj-none';
    bad.campaigns[0].name = '';
    bad.channels.push({ ...bad.channels[0] });
    const fields = validateDataset(bad).map((i) => `${i.collection}.${i.field}`);
    expect(fields).toEqual(expect.arrayContaining(['orders.projectId', 'campaigns.name', 'channels.id']));
  });
});

describe('FR-011 データストア', () => {
  it('初回はシード、更新は localStorage に保存され、読み直しても残る。版の通し番号が増える', () => {
    expect(getDataset()).toBe(seedDataset);
    expect(getRevision()).toBe(0);
    upsertEntity('customers', { ...seedDataset.customers[0], name: '変更後' });
    expect(getRevision()).toBe(1);
    expect(localStorage.getItem(DATA_STORAGE_KEY)).toContain('変更後');
    expect(reloadDataset().customers[0].name).toBe('変更後');
    expect(getRevision()).toBe(1);
    expect(seedDataset.customers[0].name).not.toBe('変更後');
  });
  it('追加・削除・シードに戻す', () => {
    upsertEntity('channels', { id: 'chn-9', name: '新チャネル' });
    expect(getDataset().channels).toHaveLength(5);
    removeEntity('channels', 'chn-9');
    expect(getDataset().channels).toHaveLength(4);
    resetDataset();
    expect(localStorage.getItem(DATA_STORAGE_KEY)).toBeNull();
  });
  it('異常系: 保存データが壊れている・参照が壊れているときはシードに戻る', () => {
    localStorage.setItem(DATA_STORAGE_KEY, '{broken');
    expect(reloadDataset()).toBe(seedDataset);
    const bad = structuredClone(seedDataset);
    bad.orders[0].vendorId = 'vnd-none';
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify({ schema: 1, revision: 5, data: bad }));
    expect(reloadDataset()).toBe(seedDataset);
  });
});

// FR-011 AC-040 素材の画像がないときは仮置きを表示し、壊れた画像を出さない
describe('FR-011 AC-040 素材のプレースホルダー', () => {
  it('画像の場所がない素材は仮置きを表示し、img を出さない', () => {
    wrap(<AssetThumb src={seedDataset.assets[0].imageUrl} alt="素材" />);
    expect(screen.getByTestId('asset-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('asset-image')).toBeNull();
  });
  it('異常系: 画像の読み込みに失敗したら仮置きに切り替わる', () => {
    wrap(<AssetThumb src="/missing.png" alt="素材" />);
    fireEvent.error(screen.getByTestId('asset-image'));
    expect(screen.getByTestId('asset-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('asset-image')).toBeNull();
  });
});

// FR-012 AC-041 関連のノードと関連線
describe('FR-012 AC-041 関係図', () => {
  it('キャンペーンの関連（顧客・企画・見積・制作プロジェクト・発注・素材・展開・KPI・利用状況）が抽出され、線の端点がすべてノード', () => {
    const r = buildRelations(seedDataset, 'cmp-1');
    const kinds = new Set(r.nodes.map((n) => n.kind));
    for (const k of ['customer', 'campaign', 'plan', 'quote', 'project', 'order', 'vendor', 'asset', 'deployment', 'channel', 'kpi', 'usage']) {
      expect(kinds.has(k as never), k).toBe(true);
    }
    const ids = new Set(r.nodes.map((n) => n.id));
    expect(r.edges.every((e) => ids.has(e.from) && ids.has(e.to))).toBe(true);
    expect(new Set(r.nodes.map((n) => n.id)).size).toBe(r.nodes.length);
  });
  it('異常系: 別のキャンペーンでは別のノード集合になり、未選択・存在しない ID は空', () => {
    const a = buildRelations(seedDataset, 'cmp-1').nodes.map((n) => n.id).sort();
    const b = buildRelations(seedDataset, 'cmp-2').nodes.map((n) => n.id).sort();
    expect(a).not.toEqual(b);
    expect(buildRelations(seedDataset, null).nodes).toEqual([]);
    expect(buildRelations(seedDataset, 'cmp-x').nodes).toEqual([]);
  });
  it('キャンペーンを選ぶとノードと関連線が表示され、ノードを選ぶと詳細が表示される', () => {
    wrap(<CampaignRelations />);
    fireEvent.click(screen.getAllByTestId('campaign-item')[0]);
    expect(screen.getAllByTestId('relation-node').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByTestId('relation-edge').length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getAllByTestId('relation-node')[1]);
    expect(screen.getByTestId('node-detail')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('campaign-item')[1]);
    expect(screen.queryByTestId('node-detail')).toBeNull();
  });
});

// FR-012 AC-042 3D でも同じノードと選択
describe('FR-012 AC-042 3D 切替', () => {
  it('3D にしても同じノード集合・選択が保たれ、3D 用の領域が加わる', async () => {
    set3dSupport(true);
    const rel = buildRelations(seedDataset, 'cmp-1');
    const ids = () => screen.getAllByTestId('relation-node').map((e) => e.getAttribute('data-entity-id')).sort();
    const sel = rel.nodes[1].id;
    wrap(<RelationView relations={rel} selectedId={sel} />);
    const ids2d = ids();
    expect(screen.getByTestId('relation-view')).toBeTruthy();
    await act(async () => updateSettings({ viewMethod: '3d' }));
    expect(screen.getByTestId('relation-view-3d')).toBeTruthy();
    expect(ids()).toEqual(ids2d);
    expect(document.querySelector(`[data-testid="relation-node"][data-entity-id="${sel}"]`)?.getAttribute('aria-checked')).toBe('true');
  });
});
