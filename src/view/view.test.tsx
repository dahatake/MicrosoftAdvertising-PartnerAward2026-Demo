import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { DualView } from './DualView';
import { layout3d, resolveKinds } from './kinds';
import { ViewModeSwitch } from './ViewModeSwitch';
import { set3dSupport } from './support';
import { resetSettings, updateSettings } from '../settings/store';

const kinds = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
];
const items = [
  { id: 'i1', label: 'one', kind: 'a', group: 'G1' },
  { id: 'i2', label: 'two', kind: 'b', group: 'G1' },
  { id: 'i3', label: 'three', kind: 'a', group: 'G2' },
];
const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
const ids = (c: HTMLElement) => [...c.querySelectorAll('[data-item-id]')].map((e) => e.getAttribute('data-item-id')).sort();

beforeEach(() => {
  localStorage.clear();
  resetSettings(['en']);
});
afterEach(() => {
  cleanup();
  set3dSupport(undefined);
});

// FR-008 AC-024 既定は 2D
describe('FR-008 AC-024 既定の表示方法', () => {
  it('何も選ばない間は 2D で、3D の領域は出ない', () => {
    set3dSupport(true);
    const { container } = wrap(<DualView items={items} kinds={kinds} />);
    expect(container.querySelector('[data-view-method="2d"]')).not.toBeNull();
    expect(screen.queryByTestId('dual-view-3d')).toBeNull();
  });
  it('3D が使えない端末では 3D を選んでも 2D に固定され、選べず、理由が表示される', () => {
    set3dSupport(false);
    updateSettings({ viewMethod: '3d' });
    const { container } = wrap(
      <>
        <ViewModeSwitch />
        <DualView items={items} kinds={kinds} />
      </>,
    );
    expect(container.querySelector('[data-view-method="2d"]')).not.toBeNull();
    expect((screen.getByTestId('view-mode-3d') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId('view-mode-reason')).toBeTruthy();
  });
});

// FR-008 AC-023 同じ ID 集合・選択が保たれる / AC-025 色・形・ラベル・凡例が一致
describe('FR-008 AC-023 AC-025 2D と 3D で同じ情報', () => {
  it('2D と 3D で項目 ID の集合・選択・ラベル・種類の記号が同じで、凡例がどちらにもある', async () => {
    set3dSupport(true);
    const { container } = wrap(<DualView items={items} kinds={kinds} selectedId="i2" />);
    const snap = () => ({
      ids: ids(container),
      selected: container.querySelector('[data-item-id][aria-selected=true]')?.getAttribute('data-item-id'),
      labels: [...container.querySelectorAll('[data-item-id]')].map((e) => e.textContent),
      glyphs: [...container.querySelectorAll('[data-item-id] [aria-hidden]')].map((e) => (e as HTMLElement).style.cssText),
      legend: [...container.querySelectorAll('[data-legend-kind]')].map((e) => e.textContent),
    });
    const two = snap();
    expect(within(container).getByTestId('view-legend')).toBeTruthy();
    updateSettings({ viewMethod: '3d' });
    await act(async () => {});
    expect(container.querySelector('[data-view-method="3d"]')).not.toBeNull();
    expect(screen.getByTestId('dual-view-3d')).toBeTruthy();
    expect(snap()).toEqual(two);
    expect(two.selected).toBe('i2');
    expect(two.legend).toEqual(['Alpha', 'Beta']);
  });
  it('3D の配置はグループを列に、項目を奥行きに並べ、全項目に位置がある', () => {
    const p = layout3d(items);
    expect(p.map((x) => x.id)).toEqual(['i1', 'i2', 'i3']);
    expect(p[0].position[0]).toBe(p[1].position[0]);
    expect(p[0].position[0]).not.toBe(p[2].position[0]);
    expect(p[0].position[2]).not.toBe(p[1].position[2]);
  });
  it('種類の色・形は並び順で決まり、重複しない', () => {
    const r = resolveKinds(kinds);
    expect(r[0].color).not.toBe(r[1].color);
    expect(r[0].shape).not.toBe(r[1].shape);
  });
  it('項目をクリックすると onSelect が呼ばれる', () => {
    let got = '';
    const { container } = wrap(<DualView items={items} kinds={kinds} onSelect={(i) => (got = i)} />);
    fireEvent.click(container.querySelector('[data-item-id="i3"]')!);
    expect(got).toBe('i3');
  });
});
