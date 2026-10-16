import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { CameraSettings } from './CameraSettings';
import { CAMERA_LABELS, TECH_NAMES } from './labels';
import { CAMERA_STORAGE_KEY, getCameraSelection, reloadCameraSelection, selectPreset, setCameraPart } from './store';
import { DEFAULT_PRESET, PART_VALUES, PARTS, PRESETS, camera3d, comboKey, isAvailable, maxDurationMs, presetOf, resolveFor2d } from './model';
import { LANGUAGES } from '../i18n';
import { resetSettings, updateSettings } from '../settings/store';
import { set3dSupport } from '../view/support';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  reloadCameraSelection();
});
afterEach(() => {
  cleanup();
  set3dSupport(undefined);
});

// FR-009 AC-029 既定はじっくり説明
describe('FR-009 AC-029 既定', () => {
  it('既定はプリセット 0（じっくり説明）', () => {
    expect(DEFAULT_PRESET).toBe(0);
    expect(getCameraSelection().preset).toBe(0);
    expect(CAMERA_LABELS.ja.presets[0]).toBe('じっくり説明');
    wrap(<CameraSettings />);
    expect(screen.getByTestId('camera-now').textContent).toBe('いま: じっくり説明');
    expect(screen.getByTestId('camera-preset-0').getAttribute('aria-checked')).toBe('true');
  });
});

// FR-009 AC-026 9 つのプリセットと即時反映
describe('FR-009 AC-026 かんたん選択', () => {
  it('9 つのプリセットとミニプレビューがあり、選ぶと「いま: …」が更新される', () => {
    wrap(<CameraSettings />);
    expect(PRESETS).toHaveLength(9);
    expect(screen.getAllByTestId('camera-mini-preview')).toHaveLength(9);
    fireEvent.click(screen.getByTestId('camera-preset-8'));
    expect(screen.getByTestId('camera-now').textContent).toBe('いま: 迫力のゲーム風');
    expect(screen.getByTestId('camera-combo').getAttribute('data-value')).toBe(comboKey(PRESETS[8]));
  });
  it('スライダーでもプリセットを選べる', () => {
    wrap(<CameraSettings />);
    fireEvent.change(screen.getByTestId('camera-simple-slider'), { target: { value: '4' } });
    expect(getCameraSelection().preset).toBe(4);
  });
});

// FR-009 AC-027 くわしく選択
describe('FR-009 AC-027 くわしく選択', () => {
  it('4 要素を個別に変えると組合せと「いま: …」が更新され、プリセットから外れる', () => {
    wrap(<CameraSettings />);
    const before = screen.getByTestId('camera-combo').getAttribute('data-value');
    fireEvent.change(screen.getByTestId('camera-detail-size'), { target: { value: 'extreme' } });
    expect(screen.getByTestId('camera-combo').getAttribute('data-value')).not.toBe(before);
    expect(getCameraSelection().preset).toBeNull();
    expect(screen.getByTestId('camera-now').textContent).toContain('ぐっと寄り');
    for (const p of PARTS) expect(PART_VALUES[p].length).toBeGreaterThan(1);
  });
});

// FR-009 AC-028 2D で不可能な組合せのグレーアウトと理由
describe('FR-009 AC-028 2D の制約', () => {
  it('2D では上下の角度・奥行きの動きが無効（グレーアウト）で、理由が出る。3D では選べる', () => {
    set3dSupport(true);
    wrap(<CameraSettings />);
    const opt = (part: string, v: string) =>
      [...screen.getByTestId(`camera-detail-${part}`).querySelectorAll('option')].find((o) => o.value === v)!;
    expect(opt('angle', 'high').disabled).toBe(true);
    expect(opt('motion', 'orbit').disabled).toBe(true);
    expect(opt('angle', 'high').textContent).toContain(CAMERA_LABELS.ja.only3d);
    expect(screen.getByTestId('camera-2d-note').textContent).toBe(CAMERA_LABELS.ja.unavailable);
    expect(opt('angle', 'level').disabled).toBe(false);
    act(() => updateSettings({ viewMethod: '3d' }));
    expect(opt('angle', 'high').disabled).toBe(false);
    expect(screen.queryByTestId('camera-2d-note')).toBeNull();
  });
  it('2D の近似: 3D 専用の要素は近い表現に置換される', () => {
    const e = resolveFor2d({ size: 'close', angle: 'high', motion: 'orbit', character: 'smooth' });
    expect(isAvailable('angle', e.angle, '2d') && isAvailable('motion', e.motion, '2d')).toBe(true);
  });
});

// FR-009 AC-030 動きを減らす
describe('FR-009 AC-030 動きを減らす', () => {
  it('最大時間は PARAM-007 の 0、3D のカメラも静止', () => {
    for (const p of PRESETS) {
      expect(maxDurationMs(p, true)).toBe(0);
      expect(camera3d(p, true).durationMs).toBe(0);
    }
    expect(maxDurationMs(PRESETS[7], false)).toBeGreaterThan(0);
  });
});

// FR-009 AC-031 localStorage に保存・復元
describe('FR-009 AC-031 保存と復元', () => {
  it('選択は localStorage に保存され、読み直しで復元される', () => {
    selectPreset(6);
    setCameraPart('character', 'shaky');
    expect(JSON.parse(localStorage.getItem(CAMERA_STORAGE_KEY)!).combo.character).toBe('shaky');
    const saved = getCameraSelection().combo;
    selectPreset(0);
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({ combo: saved }));
    reloadCameraSelection();
    expect(getCameraSelection().combo).toEqual(saved);
    expect(presetOf(saved)).toBeNull();
  });
  it('壊れた保存内容は既定に戻る', () => {
    localStorage.setItem(CAMERA_STORAGE_KEY, '{bad');
    reloadCameraSelection();
    expect(getCameraSelection().preset).toBe(0);
  });
});

// FR-009 AC-032 平易な文言（4 言語）
describe('FR-009 AC-032 文言', () => {
  it('4 言語とも全プリセット・全選択肢の文言があり、画面の文言に専門名が出ない', () => {
    const tech = Object.values(TECH_NAMES).flatMap((m) => Object.values(m));
    for (const lang of LANGUAGES) {
      const l = CAMERA_LABELS[lang];
      expect(l.presets).toHaveLength(9);
      for (const p of PARTS) for (const v of PART_VALUES[p]) expect((l[p] as Record<string, string>)[v]).toBeTruthy();
      const all = [l.title, l.simple, l.detail, ...l.presets, ...Object.values(l.partNames), ...Object.values(l.size), ...Object.values(l.angle), ...Object.values(l.motion), ...Object.values(l.character)];
      for (const text of all) for (const t of tech) expect(text).not.toBe(t);
      if (lang !== 'en') for (const text of all) expect(text).not.toMatch(/Shot Size|Close-up|Dutch|Fly-through/i);
    }
  });
  it('専門名は選択肢のツールチップ（title）にだけ出る', () => {
    wrap(<CameraSettings />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Shot Size');
    expect(text).not.toContain('Close-up');
    expect(screen.getByTestId('camera-detail-size').querySelector('option[value="close"]')!.getAttribute('title')).toBe('Close-up');
  });
});
