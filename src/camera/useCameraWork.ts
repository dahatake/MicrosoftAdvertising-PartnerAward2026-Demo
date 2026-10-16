// useCameraWork(): 画面（2D/3D）がカメラワークを使うための共通フック。
// 2D はキーフレーム（ズーム・パン・傾き）の近似、3D は実カメラの設定（camera3d）を返す。
import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { useViewMode } from '../view/useViewMode';
import { CAMERA_LABELS, nowText } from './labels';
import { useSettings } from '../settings/store';
import {
  camera3d,
  keyframes2d,
  maxDurationMs,
  comboKey,
  resolveFor2d,
  CHARACTER_TIMING,
  type Camera3d,
  type CameraCombo,
  type CameraPart,
} from './model';
import { selectPreset, setCameraPart, useCameraSelection } from './store';

const QUERY = '(prefers-reduced-motion: reduce)';

/** OS の「動きを減らす」設定（変更にも追従） */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia?.(QUERY);
      m?.addEventListener?.('change', cb);
      return () => m?.removeEventListener?.('change', cb);
    },
    () => !!window.matchMedia?.(QUERY).matches,
    () => false,
  );
}

export interface CameraWork {
  /** 利用者が選んだ 4 要素 */
  combo: CameraCombo;
  /** 内部の組合せの文字列（size.angle.motion.character） */
  key: string;
  /** プリセットの番号（くわしく選択で変えたら null） */
  preset: number | null;
  /** 現在の表示方法（3D が使えない端末では 2d） */
  method: '2d' | '3d';
  reducedMotion: boolean;
  /** 動きの最大時間（ミリ秒）。「動きを減らす」のときは PARAM-007 の 0 */
  maxDurationMs: number;
  /** 「いま: …」の一文 */
  now: string;
  /** 2D で実際に使う組合せ（2D で表現できない要素は近い表現に置換済み） */
  effective: CameraCombo;
  /** 2D 用のキーフレームと時間・緩急（reduced のとき keyframes は空） */
  animation2d: { keyframes: Keyframe[]; options: KeyframeAnimationOptions };
  /** 3D 用の実カメラの設定（durationMs=0 は静止） */
  camera3d: Camera3d;
  selectPreset: (index: number) => void;
  setPart: <P extends CameraPart>(part: P, value: CameraCombo[P]) => void;
}

export function useCameraWork(): CameraWork {
  const { combo, preset } = useCameraSelection();
  const { method } = useViewMode();
  const { lang } = useSettings();
  const reducedMotion = usePrefersReducedMotion();
  const timing = CHARACTER_TIMING[combo.character];
  return {
    combo,
    key: comboKey(combo),
    preset,
    method,
    reducedMotion,
    maxDurationMs: maxDurationMs(combo, reducedMotion),
    now: nowText(CAMERA_LABELS[lang], preset, combo),
    effective: method === '2d' ? resolveFor2d(combo) : combo,
    animation2d: {
      keyframes: keyframes2d(combo, reducedMotion),
      options: { duration: timing.durationMs, easing: timing.easing, iterations: Infinity, direction: 'alternate' },
    },
    camera3d: camera3d(combo, reducedMotion),
    selectPreset,
    setPart: setCameraPart,
  };
}

/** 2D の要素にカメラワークの近似（ズーム・パン・傾き）をかける。reduced のときは何もしない（静止） */
export function useCameraAnimation2d(ref: RefObject<HTMLElement | null>, combo: CameraCombo, reduced: boolean) {
  const key = comboKey(combo);
  const anim = useRef<Animation | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    const frames = keyframes2d(combo, reduced);
    const base = frames.length ? frames[0] : { transform: 'none' };
    // 静止のときも大きさ・傾きは反映する（動かさずに見た目だけ示す）
    Object.assign(el.style, { transform: String(base.transform ?? 'none') });
    if (!frames.length) return;
    const timing = CHARACTER_TIMING[combo.character];
    anim.current = el.animate(frames, { duration: timing.durationMs, easing: timing.easing, iterations: Infinity, direction: 'alternate' });
    return () => anim.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, key, reduced]);
}
