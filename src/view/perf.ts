// 低性能端末のフォールバック（NFR-PERF-002）。3D 表示中のフレームレートを監視し、
// PARAM-003（30 fps）を PARAM-009（5 秒）連続して下回ったら 2D に切り替えて理由を通知する。
import { useEffect, useSyncExternalStore } from 'react';
import { updateSettings } from '../settings/store';
import { useViewMode } from './useViewMode';

/** PARAM-003: 3D 表示の目標フレームレート（下限） */
export const MIN_FPS = 30;
/** PARAM-009: フレームレート低下の判定時間（秒） */
export const LOW_FPS_SECONDS = 5;

/** 1 秒ごとの窓でフレーム数を数え、下限を下回る窓が seconds 回連続したら true を返す */
export class FpsGuard {
  private windowStart: number | undefined;
  private frames = 0;
  private lowWindows = 0;
  constructor(
    private readonly minFps = MIN_FPS,
    private readonly seconds = LOW_FPS_SECONDS,
  ) {}

  /** フレームごとに時刻（ms）を渡す。連続して下回ったと判定した瞬間に true */
  frame(now: number): boolean {
    if (this.windowStart === undefined) {
      this.windowStart = now;
      this.frames = 0;
      return false;
    }
    this.frames += 1;
    const elapsed = now - this.windowStart;
    if (elapsed < 1000) return false;
    const fps = (this.frames * 1000) / elapsed;
    this.windowStart = now;
    this.frames = 0;
    // 長い空白（タブが背面など）は低下とみなさず、計測をやり直す
    if (elapsed > 2500) {
      this.lowWindows = 0;
      return false;
    }
    this.lowWindows = fps < this.minFps ? this.lowWindows + 1 : 0;
    return this.lowWindows >= this.seconds;
  }

  reset() {
    this.windowStart = undefined;
    this.frames = 0;
    this.lowWindows = 0;
  }
}

// 自動で 2D に切り替えた理由（利用者が 3D を選び直すまで表示する）
let lowPerf = false;
const listeners = new Set<() => void>();
function setLowPerf(v: boolean) {
  if (lowPerf === v) return;
  lowPerf = v;
  listeners.forEach((l) => l());
}
export function useLowPerfNotice(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => lowPerf,
  );
}
/** テスト用 */
export function resetLowPerf() {
  setLowPerf(false);
}

/** 3D 表示中だけフレームレートを監視し、低下が続いたら 2D に切り替えて通知する。選択中の対象は呼び出し側の状態なので保たれる */
export function useFpsFallback() {
  const { method } = useViewMode();
  useEffect(() => {
    if (method !== '3d') return;
    setLowPerf(false);
    if (typeof requestAnimationFrame !== 'function') return;
    const guard = new FpsGuard();
    let id = 0;
    const tick = (now: number) => {
      if (!document.hidden && guard.frame(now)) {
        setLowPerf(true);
        updateSettings({ viewMethod: '2d' });
        return;
      }
      if (document.hidden) guard.reset();
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [method]);
}
