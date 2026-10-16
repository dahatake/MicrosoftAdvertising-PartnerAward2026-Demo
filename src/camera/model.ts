// カメラワークの組合せ（4 要素）とプリセット、2D/3D の可否、2D の近似、3D のカメラ設定。画面に依存しない純粋な定義。
// 選択肢の並びは「先頭と末尾が 2D でも使える」ことを保つ（2D で使えないものは途中に置く）。

export const SIZES = ['medium', 'wide', 'close', 'extreme'] as const;
export const ANGLES = ['level', 'high', 'low', 'tilt'] as const;
export const MOTIONS = ['still', 'orbit', 'flythrough', 'pan', 'zoom'] as const;
export const CHARACTERS = ['gentle', 'smooth', 'snappy', 'bouncy', 'shaky'] as const;

export type Size = (typeof SIZES)[number];
export type Angle = (typeof ANGLES)[number];
export type Motion = (typeof MOTIONS)[number];
export type Character = (typeof CHARACTERS)[number];

export interface CameraCombo {
  size: Size;
  angle: Angle;
  motion: Motion;
  character: Character;
}
export type CameraPart = keyof CameraCombo;

export const PART_VALUES = { size: SIZES, angle: ANGLES, motion: MOTIONS, character: CHARACTERS } as const;
export const PARTS: readonly CameraPart[] = ['size', 'angle', 'motion', 'character'];

/** かんたん選択の 9 つのプリセット（落ち着き → 派手の順。0 が既定: AC-029） */
export const PRESETS: readonly CameraCombo[] = [
  { size: 'medium', angle: 'level', motion: 'pan', character: 'gentle' }, // じっくり説明
  { size: 'close', angle: 'level', motion: 'orbit', character: 'smooth' }, // 製品をきれいに見せる
  { size: 'wide', angle: 'low', motion: 'flythrough', character: 'smooth' }, // 映画のように
  { size: 'medium', angle: 'level', motion: 'flythrough', character: 'gentle' }, // その場にいる感じ
  { size: 'medium', angle: 'level', motion: 'zoom', character: 'snappy' }, // テンポよく見せる
  { size: 'close', angle: 'low', motion: 'zoom', character: 'bouncy' }, // 広告らしく印象的に
  { size: 'extreme', angle: 'tilt', motion: 'orbit', character: 'bouncy' }, // 非現実的な視点
  { size: 'close', angle: 'tilt', motion: 'zoom', character: 'shaky' }, // 音楽に合わせて激しく
  { size: 'extreme', angle: 'high', motion: 'flythrough', character: 'snappy' }, // 迫力のゲーム風
];
export const DEFAULT_PRESET = 0;

export interface CameraSelection {
  combo: CameraCombo;
  /** プリセットのとおりなら番号、くわしく選択で変えたら null */
  preset: number | null;
}

export const DEFAULT_SELECTION: CameraSelection = { combo: { ...PRESETS[DEFAULT_PRESET] }, preset: DEFAULT_PRESET };

/** 2D で表現できない選択肢（奥行きのある動き・上下の見下ろし/見上げ） */
const ONLY_3D: Record<CameraPart, readonly string[]> = {
  size: [],
  angle: ['high', 'low'],
  motion: ['orbit', 'flythrough'],
  character: [],
};

export function isAvailable(part: CameraPart, value: string, method: '2d' | '3d'): boolean {
  return method === '3d' || !ONLY_3D[part].includes(value);
}

export function comboKey(c: CameraCombo): string {
  return `${c.size}.${c.angle}.${c.motion}.${c.character}`;
}

export function presetOf(c: CameraCombo): number | null {
  const i = PRESETS.findIndex((p) => comboKey(p) === comboKey(c));
  return i < 0 ? null : i;
}

export function isCombo(v: unknown): v is CameraCombo {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return PARTS.every((p) => (PART_VALUES[p] as readonly unknown[]).includes(o[p]));
}

/** 2D で実際に使う組合せ。2D で表現できない要素は、近い表現に置き換える（見た目の近似） */
export function resolveFor2d(c: CameraCombo): CameraCombo {
  return {
    ...c,
    angle: isAvailable('angle', c.angle, '2d') ? c.angle : 'level',
    motion: c.motion === 'orbit' ? 'pan' : c.motion === 'flythrough' ? 'zoom' : c.motion,
  };
}

/** 性格ごとの 1 回の動きの長さ（ミリ秒）と、動きの緩急 */
export const CHARACTER_TIMING: Record<Character, { durationMs: number; easing: string }> = {
  gentle: { durationMs: 4000, easing: 'ease-in-out' },
  smooth: { durationMs: 3000, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
  snappy: { durationMs: 1200, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
  bouncy: { durationMs: 1500, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  shaky: { durationMs: 800, easing: 'steps(6, end)' },
};

/** PARAM-007: 「動きを減らす」設定のときの動きの最大時間（ミリ秒）。0 は静止 */
export const REDUCED_MOTION_MAX_MS = 0;

export function maxDurationMs(c: CameraCombo, reduced: boolean): number {
  if (reduced) return REDUCED_MOTION_MAX_MS;
  return c.motion === 'still' ? 0 : CHARACTER_TIMING[c.character].durationMs;
}

const SIZE_SCALE: Record<Size, number> = { wide: 1, medium: 1.15, close: 1.4, extreme: 1.8 };
const SIZE_DISTANCE: Record<Size, number> = { wide: 12, medium: 9, close: 6, extreme: 3.5 };

/** 2D の近似（Web Animations API 用のキーフレーム）。reduced のときは空（動かさない） */
export function keyframes2d(combo: CameraCombo, reduced: boolean): Keyframe[] {
  if (maxDurationMs(combo, reduced) === 0) return [];
  const c = resolveFor2d(combo);
  const s = SIZE_SCALE[c.size];
  const roll = c.angle === 'tilt' ? 8 : 0;
  const t = (x: number, y: number, k: number) => ({ transform: `translate(${x}%, ${y}%) scale(${k}) rotate(${roll}deg)` });
  switch (c.motion) {
    case 'pan':
      return [t(-6, 0, s), t(6, 0, s)];
    case 'zoom':
      return [t(0, 0, s), t(0, 0, s * 1.25)];
    default:
      return [t(0, 0, s), t(0, 0, s)];
  }
}

export interface Camera3d {
  /** 開始位置 [x, y, z] と、注視点 */
  from: [number, number, number];
  to: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  /** 画面の傾き（ラジアン） */
  roll: number;
  /** 周回（orbit）のとき true */
  orbit: boolean;
  /** 0 のとき動かさない（静止） */
  durationMs: number;
  easing: string;
}

/** 3D の実カメラの設定。位置は距離（大きさ）と仰角（角度）から作り、動きで終了位置を決める */
export function camera3d(combo: CameraCombo, reduced: boolean): Camera3d {
  const d = SIZE_DISTANCE[combo.size];
  const elev = combo.angle === 'high' ? 0.9 : combo.angle === 'low' ? -0.35 : 0.35;
  const y = Math.sin(elev) * d;
  const z = Math.cos(elev) * d;
  const from: [number, number, number] = [0, y, z];
  let to: [number, number, number] = from;
  if (combo.motion === 'pan') to = [d * 0.35, y, z];
  if (combo.motion === 'zoom') to = [0, y * 0.7, z * 0.7];
  if (combo.motion === 'flythrough') to = [0, y * 0.4, z * 0.3];
  return {
    from,
    to,
    lookAt: [0, 0, 0],
    fov: combo.motion === 'zoom' ? 40 : 50,
    roll: combo.angle === 'tilt' ? 0.14 : 0,
    orbit: combo.motion === 'orbit',
    durationMs: maxDurationMs(combo, reduced),
    easing: CHARACTER_TIMING[combo.character].easing,
  };
}
