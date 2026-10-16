// カメラワークの選択の保存（localStorage: cameraWork）と購読。AC-031。
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SELECTION,
  PRESETS,
  isCombo,
  presetOf,
  type CameraCombo,
  type CameraPart,
  type CameraSelection,
} from './model';

export const CAMERA_STORAGE_KEY = 'cameraWork';

function read(): CameraSelection {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { combo?: unknown };
      if (isCombo(v.combo)) {
        const { size, angle, motion, character } = v.combo;
        const combo: CameraCombo = { size, angle, motion, character };
        return { combo, preset: presetOf(combo) };
      }
    }
  } catch {
    /* 壊れた保存内容は既定に戻す */
  }
  return { combo: { ...DEFAULT_SELECTION.combo }, preset: DEFAULT_SELECTION.preset };
}

function write(s: CameraSelection) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({ combo: s.combo }));
  } catch {
    /* 保存できない環境では、その場の状態だけで動く */
  }
}

let state: CameraSelection = read();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getCameraSelection(): CameraSelection {
  return state;
}

export function selectPreset(index: number) {
  const p = PRESETS[index];
  if (!p) return;
  state = { combo: { ...p }, preset: index };
  write(state);
  emit();
}

export function setCameraPart<P extends CameraPart>(part: P, value: CameraCombo[P]) {
  const combo = { ...state.combo, [part]: value };
  state = { combo, preset: presetOf(combo) };
  write(state);
  emit();
}

/** テスト用: 保存内容から状態を読み直す */
export function reloadCameraSelection() {
  state = read();
  emit();
}

export function useCameraSelection(): CameraSelection {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getCameraSelection,
  );
}
