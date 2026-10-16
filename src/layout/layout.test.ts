import { beforeEach, describe, expect, it } from 'vitest';
import {
  activeTabOf,
  defaultLayout,
  isShown,
  moveBy,
  moveTo,
  parseLayout,
  reconcile,
  resizeBy,
  setDirection,
  toggleHidden,
  toggleMaximized,
  toggleTabbed,
} from './model';
import { getLayout, resetLayout, setLayout } from './store';
import { filterCommands } from '../commands/registry';

const ids = ['1', '2', '3'];
beforeEach(() => {
  localStorage.clear();
  resetLayout('t');
});

// FR-010 AC-033 移動・分割（方向）・サイズ変更・タブ化・非表示・最大化
describe('FR-010 AC-033 レイアウトの操作', () => {
  it('移動・ドラッグ移動', () => {
    const s = defaultLayout(ids);
    expect(moveBy(s, '1', 1).order).toEqual(['2', '1', '3']);
    expect(moveBy(s, '1', -1)).toBe(s);
    expect(moveTo(s, '3', '1').order).toEqual(['3', '1', '2']);
  });
  it('サイズ変更は範囲内に収まる', () => {
    let s = defaultLayout(ids);
    s = resizeBy(s, '1', 0.5);
    expect(s.sizes['1']).toBe(1.5);
    expect(resizeBy(s, '1', 100).sizes['1']).toBe(4);
    expect(resizeBy(s, '1', -100).sizes['1']).toBe(0.5);
  });
  it('並べる方向・非表示・最大化・タブ化', () => {
    let s = defaultLayout(ids);
    expect(setDirection(s, 'column').direction).toBe('column');
    s = toggleHidden(s, '1');
    expect(isShown(s, '1')).toBe(false);
    s = toggleHidden(s, '1');
    expect(isShown(s, '1')).toBe(true);
    s = toggleMaximized(s, '2');
    expect(isShown(s, '1')).toBe(false);
    expect(isShown(s, '2')).toBe(true);
    s = toggleMaximized(s, '2');
    s = toggleTabbed(toggleTabbed(s, '1'), '2');
    expect(activeTabOf(s)).toBe('2');
    expect(isShown(s, '1')).toBe(false);
    expect(isShown(s, '3')).toBe(true);
  });
});

// FR-010 AC-034 保存・復元・既定に戻す
describe('FR-010 AC-034 保存と復元', () => {
  it('変更は localStorage（layout を含むキー）に保存され、再訪で復元され、既定に戻せる', () => {
    setLayout('t', toggleHidden(getLayout('t', ids), '1'));
    expect(Object.keys(localStorage).some((k) => /layout/i.test(k))).toBe(true);
    expect(parseLayout(localStorage.getItem('layout:t'))?.hidden).toEqual(['1']);
    expect(getLayout('t', ids).hidden).toEqual(['1']);
    resetLayout('t');
    expect(getLayout('t', ids).hidden).toEqual([]);
    expect(localStorage.getItem('layout:t')).toBeNull();
  });
  it('パネルが増減しても保存を現在のパネルに合わせる', () => {
    const s = reconcile(defaultLayout(['1', '2']), ['2', '3']);
    expect(s.order).toEqual(['2', '3']);
    expect(s.sizes['3']).toBe(1);
  });
  it('壊れた保存内容は無視する', () => {
    expect(parseLayout('{oops')).toBeNull();
  });
});

// FR-010 AC-038 コマンドの検索
describe('FR-010 AC-038 コマンドの絞り込み', () => {
  const cmds = [
    { id: 'a', label: 'Layout: reset', keywords: 'layout', run: () => {} },
    { id: 'b', label: 'Switch app: App2', keywords: 'app', run: () => {} },
  ];
  it('語がすべて含まれるものだけを残す（大文字小文字は無視）', () => {
    expect(filterCommands(cmds, 'LAYOUT').map((c) => c.id)).toEqual(['a']);
    expect(filterCommands(cmds, 'app2').map((c) => c.id)).toEqual(['b']);
    expect(filterCommands(cmds, '')).toHaveLength(2);
  });
});
