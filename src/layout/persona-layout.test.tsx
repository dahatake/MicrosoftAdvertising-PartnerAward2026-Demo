import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { App1 } from '../apps/App1';
import { App2 } from '../apps/App2';
import { PERSONA_LAYOUT, resetPersona } from '../app2';
import { APP1_PERSONA_LAYOUT } from '../app1/persona-layout';
import { resetAllLayouts, LAYOUT_KEY_PREFIX } from './store';
import { resetSettings } from '../settings/store';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
const root = () => screen.getByTestId('layout-root');
const order = () => root().getAttribute('data-layout-order')!.split(',');
const persona = () => root().getAttribute('data-layout-persona');
const pickApp2 = (p: string) => fireEvent.change(screen.getByTestId('persona-select'), { target: { value: p } });
const menu = (id: string, name: RegExp) => {
  fireEvent.click(screen.getByTestId(`layout-menu-${id}`));
  fireEvent.click(screen.getByRole('menuitem', { name }));
};

beforeEach(() => {
  localStorage.clear();
  resetAllLayouts();
  resetSettings(['ja']);
  resetPersona();
});
afterEach(() => cleanup());

// FR-021 AC-080 ペルソナごとの既定のレイアウト（配置・表示/非表示・順序）
describe('FR-021 AC-080 ペルソナ別の既定のレイアウト', () => {
  it('App2: P-3〜P-5 で順序・表示/非表示が §7 の既定になり、互いに異なる', () => {
    wrap(<App2 />);
    const seen = new Set<string>();
    for (const p of ['P-3', 'P-4', 'P-5'] as const) {
      pickApp2(p);
      expect(persona()).toBe(p);
      const d = PERSONA_LAYOUT[p];
      const hidden = d.hidden ?? [];
      const expected = d.order!.filter((i) => !hidden.includes(i));
      expect(order().slice(0, expected.length)).toEqual(expected);
      for (const h of hidden) expect(order()).not.toContain(h);
      expect(order()).toContain('1');
      expect(order()[0]).toBe('7');
      seen.add(order().join(','));
    }
    expect(seen.size).toBe(3);
  });
  it('P-3 は企画・見積と what-if、P-4 は発注と素材、P-5 は展開（KPI）と関係図が前に並ぶ', () => {
    wrap(<App2 />);
    expect(order().slice(0, 3)).toEqual(['7', '8', '6']);
    pickApp2('P-4');
    expect(order().slice(0, 4)).toEqual(['7', '5', '11', '9']);
    pickApp2('P-5');
    expect(order().slice(0, 3)).toEqual(['7', '10', '4']);
  });
  it('App1: P-1 と P-2 で順序が異なる（P-1 は製品ビュー先頭、P-2 は説明先頭）', () => {
    wrap(<App1 />);
    expect(persona()).toBe('P-1');
    expect(order()[0]).toBe('visual');
    expect(order().slice(0, 2)).toEqual(APP1_PERSONA_LAYOUT['P-1'].order!.slice(0, 2));
    fireEvent.click(screen.getByTestId('persona-select-p2'));
    expect(persona()).toBe('P-2');
    expect(order()[0]).toBe('scenes');
    expect(screen.getByTestId('layout-panel-visual').style.flex).toMatch(/^1 1 /);
    expect(screen.getByTestId('layout-panel-scenes').style.flex).toMatch(/^3 1 /);
    expect(screen.getByTestId('architecture-2d')).toBeTruthy();
  });
});

// FR-021 AC-081 保存単位はペルソナ×画面。別のペルソナに切り替えて戻すと復元され、既定に戻すは現在のペルソナの既定
describe('FR-021 AC-081 ペルソナ×画面の保存と既定に戻す', () => {
  it('App2: P-3 で変更 → P-4 は既定のまま → P-3 に戻ると変更が復元される', () => {
    wrap(<App2 />);
    const def3 = order();
    menu('7', /後ろへ移動/);
    const changed = order();
    expect(changed).not.toEqual(def3);
    expect(Object.keys(localStorage).filter((k) => k.startsWith(LAYOUT_KEY_PREFIX))).toEqual([`${LAYOUT_KEY_PREFIX}app2:P-3`]);
    pickApp2('P-4');
    expect(order()[0]).toBe('7');
    expect(order().slice(0, 4)).toEqual(['7', '5', '11', '9']);
    pickApp2('P-3');
    expect(order()).toEqual(changed);
  });
  it('「既定に戻す」は現在のペルソナだけを既定に戻し、他のペルソナの変更は残る', () => {
    wrap(<App2 />);
    menu('7', /後ろへ移動/);
    const p3Changed = order();
    pickApp2('P-4');
    const p4Default = order();
    menu('7', /後ろへ移動/);
    expect(order()).not.toEqual(p4Default);
    fireEvent.click(screen.getByTestId('layout-reset'));
    expect(order()).toEqual(p4Default);
    pickApp2('P-3');
    expect(order()).toEqual(p3Changed);
    fireEvent.click(screen.getByTestId('layout-reset'));
    expect(order().slice(0, 3)).toEqual(['7', '8', '6']);
  });
  it('再読込（再描画）でも復元される。App1 も P-1 と P-2 で別々に保存される', () => {
    const { unmount } = wrap(<App1 />);
    menu('visual', /後ろへ移動/);
    const changed = order();
    expect(changed[0]).not.toBe('visual');
    unmount();
    const saved = localStorage.getItem(`${LAYOUT_KEY_PREFIX}app1:P-1`)!;
    resetAllLayouts(); // メモリ上の状態を捨て、localStorage からの復元を確かめる
    localStorage.setItem(`${LAYOUT_KEY_PREFIX}app1:P-1`, saved);
    wrap(<App1 />);
    expect(order()).toEqual(changed);
    fireEvent.click(screen.getByTestId('persona-select-p2'));
    expect(order()[0]).toBe('scenes');
    expect(Object.keys(localStorage).filter((k) => k.startsWith(LAYOUT_KEY_PREFIX))).toEqual([`${LAYOUT_KEY_PREFIX}app1:P-1`]);
  });
});

// FR-021 AC-082 ペルソナを切り替えても選択・入力・データの集合は保たれる
describe('FR-021 AC-082 ペルソナ切替で状態を保つ', () => {
  it('App2: 選択中のキャンペーン・入力中の内容・データの集合が変わらない', () => {
    wrap(<App2 />);
    const ids = () => screen.getAllByTestId('campaign-item').map((e) => e.getAttribute('data-campaign-id'));
    const before = ids();
    expect(before.length).toBeGreaterThan(0);
    fireEvent.change(screen.getByTestId('panel-input'), { target: { value: '入力中' } });
    fireEvent.click(screen.getAllByTestId('campaign-item')[1]);
    for (const p of ['P-4', 'P-5', 'P-3']) {
      pickApp2(p);
      expect((screen.getByTestId('panel-input') as HTMLInputElement).value).toBe('入力中');
      expect(screen.getAllByTestId('campaign-item')[1].getAttribute('aria-pressed')).toBe('true');
      expect(ids()).toEqual(before);
    }
  });
  it('App1: 切り替えても全パネルがマウントされ、場面の件数は対応するペルソナのもの', () => {
    wrap(<App1 />);
    const panels = () => screen.getAllByTestId(/^layout-panel-/).length;
    const n = panels();
    fireEvent.click(screen.getByTestId('persona-select-p2'));
    expect(panels()).toBe(n);
    expect(screen.getAllByTestId('scene-list')[0].children.length).toBeGreaterThan(0);
  });
});

// FR-021 AC-083 既定のレイアウトの後も、メニュー（ドラッグなし）で変更でき、狭い画面でも欠けない
describe('FR-021 AC-083 メニューでの変更と狭い画面', () => {
  it('各ペルソナの既定のあとも、メニューで表示/非表示・移動・サイズ変更ができる', () => {
    wrap(<App2 />);
    for (const p of ['P-4', 'P-5']) {
      pickApp2(p);
      const first = order()[0];
      menu(first, /非表示/);
      expect(order()).not.toContain(first);
      expect(screen.getByTestId('layout-show-menu')).toBeTruthy();
      fireEvent.click(screen.getByTestId('layout-reset'));
      expect(order()[0]).toBe(first);
    }
    pickApp2('P-3');
    const before = screen.getByTestId('layout-panel-7').style.flex;
    menu('7', /パネルを狭く/);
    expect(screen.getByTestId('layout-panel-7').style.flex).not.toBe(before);
  });
  it('表示されないパネルの内容も欠けずにマウントされ、非表示のものは「非表示のパネル」から戻せる', () => {
    wrap(<App2 />);
    pickApp2('P-5');
    for (const id of PERSONA_LAYOUT['P-5'].hidden!) {
      expect(screen.getByTestId(`layout-panel-${id}`).style.display).toBe('none');
    }
    fireEvent.click(screen.getByTestId('layout-show-menu'));
    fireEvent.click(screen.getAllByRole('menuitem')[0]);
    expect(order().length).toBe(11 - PERSONA_LAYOUT['P-5'].hidden!.length + 1);
  });
});
