// NFR-A11Y-001 / NFR-A11Y-002 / NFR-UX-001 の単体・結合テスト
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { DualView } from '../view/DualView';
import { set3dSupport } from '../view/support';
import { resetSettings, updateSettings } from '../settings/store';
import { Shell } from './Shell';
import { dictionaries } from '../i18n';

const css = readFileSync('src/theme/global.css', 'utf8');
const wrap = (ui: React.ReactNode, dark = false) =>
  render(<FluentProvider theme={dark ? webDarkTheme : webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['en']);
});
afterEach(() => {
  cleanup();
  set3dSupport(undefined);
});

// NFR-A11Y-001 AC-055 シェルから、カメラワーク・レイアウト・素材登録・言語・アプリ切替に到達できる（名前つきのボタン）
describe('NFR-A11Y-001 AC-055 シェルの共通操作', () => {
  it('カメラワーク・レイアウト・素材登録のボタンが名前つきで出る', () => {
    wrap(<Shell />);
    expect(screen.getByRole('button', { name: /camera/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /layout/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /register|asset/i })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: /language/i })).toBeTruthy();
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
  it('素材登録のボタンで開いたダイアログは、閉じるボタンで閉じられる', async () => {
    wrap(<Shell />);
    fireEvent.click(screen.getByRole('button', { name: /register asset/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('新しい文言が 4 言語にある', () => {
    for (const d of Object.values(dictionaries)) {
      for (const k of ['shell.camera', 'shell.layout', 'shell.registerAsset', 'shell.close', 'narration.playLabel'] as const) {
        expect(d[k]).toBeTruthy();
      }
    }
  });
});

// NFR-A11Y-001 AC-056 3D・図は、アクセシブルな名前と、同じ情報の一覧（テキスト）を持つ
describe('NFR-A11Y-001 AC-056 3D の名前と代替', () => {
  it('3D の領域に名前があり、同じ項目がテキストの一覧にも出る', () => {
    set3dSupport(true);
    updateSettings({ viewMethod: '3d' });
    const items = [
      { id: 'i1', label: 'one', kind: 'a' },
      { id: 'i2', label: 'two', kind: 'a' },
    ];
    const { container } = wrap(<DualView items={items} kinds={[{ id: 'a', label: 'Alpha' }]} />);
    const canvas = container.querySelector('[role="img"]');
    expect(canvas?.getAttribute('aria-label')).toBeTruthy();
    const list = screen.getAllByRole('radiogroup')[0];
    expect(within(list).getAllByRole('radio').length).toBe(2);
    expect(screen.getByText('one')).toBeTruthy();
  });
});

// NFR-A11Y-002 AC-057 動きを減らす設定では、動きの時間を 0 にする
describe('NFR-A11Y-002 AC-057 reduced-motion', () => {
  it('prefers-reduced-motion: reduce で、アニメーション・遷移の時間を 0 にする規則がある', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('animation-duration: 0s !important');
    expect(block).toContain('transition-duration: 0s !important');
    expect(block).toContain('animation-name: none !important');
  });
});

// NFR-UX-001 AC-064 320px・400% でも横スクロールを強いない。ダーク・ライトの両方で文字が読める（Fluent のトークン）
describe('NFR-UX-001 AC-064 リフローとテーマ', () => {
  it('横スクロールを出さず、長い語を折り返す規則がある', () => {
    expect(css).toContain('overflow-x: hidden');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toMatch(/canvas[\s\S]*max-width: 100%/);
  });
  it('ダークでもライトでも、シェルが同じ情報を出す', () => {
    const light = wrap(<Shell />).container.textContent;
    cleanup();
    const dark = wrap(<Shell />, true).container.textContent;
    expect(dark).toBe(light);
  });
});
