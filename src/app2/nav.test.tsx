// FR-024 AC-100 / FR-025 AC-102 AC-103 AC-104 AC-105 AC-106 AC-107 の単体・結合テスト
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { App2 } from '../apps/App2';
import { AREAS, areaFromHash, areaLabelKey, areaTipKey } from './areas';
import { Paged } from '../ui/Paged';
import { LANGUAGES, translate } from '../i18n';
import { resetAllLayouts } from '../layout/store';
import { resetSettings } from '../settings/store';
import { resetDataset } from './store';
import { resetPersona } from './persona';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  window.location.hash = '';
  localStorage.clear();
  resetAllLayouts();
  resetSettings(['ja']);
  resetDataset();
  resetPersona();
});
afterEach(cleanup);

// FR-025 AC-102 並び順（関係 → 企画 → 見積 → 制作 → 発注 → 素材 → 展開 → 利用状況 → KPI 試算）
describe('FR-025 AC-102 左メニューの順序', () => {
  it('垂直メニュー（nav）に 9 項目が業務ワークフロー順に並ぶ', () => {
    wrap(<App2 />);
    const nav = screen.getByTestId('side-nav');
    expect(nav.tagName).toBe('NAV');
    const ids = within(nav).getAllByRole('button').map((b) => b.getAttribute('data-testid'));
    expect(ids).toEqual(['relation', 'plan', 'quote', 'production', 'order', 'asset', 'deploy', 'usage', 'kpi'].map((k) => `nav-item-${k}`));
    expect([...AREAS]).toEqual(['relation', 'plan', 'quote', 'production', 'order', 'asset', 'deploy', 'usage', 'kpi']);
  });
});

// FR-025 AC-103 AC-105 AC-106 アイコン・ラベル・説明（4 言語、PARAM-017 = 20 文字以内）
describe('FR-025 AC-103 AC-105 AC-106 アイコン・ラベル・説明', () => {
  it('各項目にアイコン（svg）と文字ラベルがあり、項目ごとに別のアイコン', () => {
    wrap(<App2 />);
    const sigs = new Set<string>();
    for (const a of AREAS) {
      const item = screen.getByTestId(`nav-item-${a}`);
      const svg = item.querySelector('svg');
      expect(svg, a).not.toBeNull();
      sigs.add(svg!.innerHTML);
      expect(item.textContent!.replace('▶', '').trim().length).toBeGreaterThan(0);
    }
    expect(sigs.size).toBe(AREAS.length);
  });
  it('ラベルとツールチップの説明が 4 言語にあり、ja は 20 文字以内（PARAM-017）', () => {
    for (const lang of LANGUAGES) {
      for (const a of AREAS) {
        expect(translate(lang, areaLabelKey(a)).length, `${lang} label ${a}`).toBeGreaterThan(0);
        expect(translate(lang, areaTipKey(a)).length, `${lang} tip ${a}`).toBeGreaterThan(0);
      }
    }
    for (const a of AREAS) expect(translate('ja', areaTipKey(a)).length).toBeLessThanOrEqual(20);
  });
  it('キーボードのフォーカスで説明（ツールチップ）が出て、項目の説明として取得できる', async () => {
    wrap(<App2 />);
    const item = screen.getByTestId('nav-item-plan');
    item.focus();
    fireEvent.focus(item);
    expect(item.getAttribute('aria-describedby')).toBeTruthy();
    expect(item.tagName).toBe('BUTTON'); // Tab で移動し Enter/Space で選べる
  });
});

// FR-025 AC-104 切替・現在位置・状態の保持・不正な指定
describe('FR-025 AC-104 切替', () => {
  it('項目を選ぶと領域の画面が切り替わり、aria-current と ▶ で現在位置が示される', () => {
    wrap(<App2 />);
    expect(screen.getByTestId('area-root-relation')).toBeTruthy();
    fireEvent.click(screen.getByTestId('nav-item-order'));
    expect(screen.queryByTestId('area-root-relation')).toBeNull();
    expect(screen.getByTestId('area-root-order')).toBeTruthy();
    expect(screen.getByTestId('nav-item-order').getAttribute('aria-current')).toBe('page');
    expect(screen.getByTestId('nav-item-order').querySelector('[data-testid="nav-current-mark"]')).not.toBeNull();
    for (const a of AREAS.filter((a) => a !== 'order')) expect(screen.getByTestId(`nav-item-${a}`).getAttribute('aria-current')).toBeNull();
    expect(window.location.hash).toBe('#/app2/order');
  });
  it('領域を切り替えても、素材の絞り込み・メモの入力内容・選択中のキャンペーンが失われない', () => {
    wrap(<App2 />);
    fireEvent.click(screen.getAllByTestId('campaign-item')[1]);
    fireEvent.change(screen.getByTestId('panel-input'), { target: { value: 'メモ保持' } });
    fireEvent.click(screen.getByTestId('nav-item-asset'));
    fireEvent.change(screen.getByTestId('asset-filter'), { target: { value: '保持確認' } });
    fireEvent.click(screen.getByTestId('nav-item-relation'));
    expect((screen.getByTestId('panel-input') as HTMLInputElement).value).toBe('メモ保持');
    expect(screen.getAllByTestId('campaign-item')[1].getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('nav-item-asset'));
    expect((screen.getByTestId('asset-filter') as HTMLInputElement).value).toBe('保持確認');
  });
  it('異常系: 不正なハッシュは既定の領域（関係）になり、領域の画面は 1 つだけ', () => {
    expect(areaFromHash('#/app2/__no_such_area__')).toBe('relation');
    expect(areaFromHash('')).toBe('relation');
    expect(areaFromHash('#/app2/kpi')).toBe('kpi');
    window.location.hash = '#/app2/__no_such_area__';
    wrap(<App2 />);
    expect(document.querySelectorAll('[data-testid^="area-root-"]')).toHaveLength(1);
    expect(screen.getByTestId('side-nav')).toBeTruthy();
  });
});

// FR-024 AC-100 ページ送りと表示範囲
describe('FR-024 AC-100 ページ送り', () => {
  it('1 画面に収まらない一覧は、ページ送りで全件に到達でき、表示範囲（a–b / n）が示される', () => {
    const items = Array.from({ length: 7 }, (_, i) => `項目${i + 1}`);
    wrap(<Paged items={items} pageSize={3} testId="t">{(vis) => <ul>{vis.map((x) => <li key={x}>{x}</li>)}</ul>}</Paged>);
    expect(screen.getByTestId('t-range').textContent).toBe('1–3 / 7');
    const seen: string[] = screen.getAllByRole('listitem').map((l) => l.textContent!);
    fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
    expect(screen.getByTestId('t-range').textContent).toBe('4–6 / 7');
    seen.push(...screen.getAllByRole('listitem').map((l) => l.textContent!));
    fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
    expect(screen.getByTestId('t-range').textContent).toBe('7–7 / 7');
    seen.push(...screen.getAllByRole('listitem').map((l) => l.textContent!));
    expect(seen).toEqual(items);
  });
  it('App2 の素材・発注の一覧は 1 画面に収める件数でページ送りになる（素材は 1 件ずつ）', () => {
    wrap(<App2 />);
    fireEvent.click(screen.getByTestId('nav-item-asset'));
    expect(screen.getAllByTestId('asset-row')).toHaveLength(1);
    expect(screen.getByTestId('asset-range').textContent).toMatch(/^1–1 \/ \d+$/);
    fireEvent.click(screen.getByTestId('nav-item-order'));
    expect(screen.getAllByTestId('order-row').length).toBeLessThanOrEqual(3);
    expect(screen.getByTestId('order-range').textContent).toMatch(/^1–3 \/ \d+$/);
  });
});

// FR-025 AC-107 業務領域ごとのパネル構成
describe('FR-025 AC-107 業務領域ごとのパネル', () => {
  it('素材の領域は 一覧・登録・実広告素材 の 3 パネル', () => {
    wrap(<App2 />);
    fireEvent.click(screen.getByTestId('nav-item-asset'));
    expect(screen.getAllByTestId(/^layout-panel-/).map((e) => e.getAttribute('data-testid'))).toEqual(['layout-panel-a', 'layout-panel-f', 'layout-panel-x']);
    expect(screen.getAllByTestId('asset-real-item').length).toBeGreaterThanOrEqual(2);
  });
});
