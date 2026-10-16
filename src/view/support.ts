// 3D が使える端末かの判定（AC-024）。使えない端末では表示方法が 2D に固定され、理由が表示される。
import { useSyncExternalStore } from 'react';

let override: boolean | undefined;
let cached: boolean | undefined;
const listeners = new Set<() => void>();

/** WebGL が使えるか（描画に必要な最小の条件） */
export function detect3dSupport(): boolean {
  if (override !== undefined) return override;
  if (cached === undefined) {
    try {
      const c = document.createElement('canvas');
      cached = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      cached = false;
    }
  }
  return cached;
}

/** 低性能端末のフォールバックや、テストから 3D の可否を上書きする。undefined で自動判定に戻す */
export function set3dSupport(value: boolean | undefined) {
  override = value;
  listeners.forEach((l) => l());
}

export function use3dSupport(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    detect3dSupport,
  );
}
