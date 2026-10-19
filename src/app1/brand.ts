// 製品（Surface Ultra の仮置きモデル）の色・素材・照明（NFR-UX-004 AC-094）。
// UI の色は Fluent のトークンと brandTokens（src/theme/theme.ts）を使う。ここの値は、トークンを使えない所
// （three.js の素材と照明、製品の 2D 図の金属の面）に限る。
// 製品色は Surface の製品色の考え方（落ち着いた金属色）に沿う:
//   - Dune（#F9F7F1）は SRC-009（Surface のページの CSS 変数 --color-ms-dune-light-2）で確かめた値。
//   - Platinum・Black・Sapphire は [ASSUMPTION]（製品の色の呼び名による仮置き。値は SRC-009 で未確認。要求定義書 §10.3）。
//     ブランドキット（SRC-010）で値が示されたら、ここの base などを置き換える。
import { BRAND } from '../theme/theme';

export type ProductFinishId = 'dune' | 'platinum' | 'black' | 'sapphire';

export interface ProductFinish {
  id: ProductFinishId;
  /** 製品の色の呼び名（目視の記録に書く名前） */
  name: string;
  /** 金属の地の色（天板・本体・画面の背面） */
  base: string;
  /** 光が当たった面の色（2D 図の金属のグラデーションの明るい側） */
  highlight: string;
  /** 影の面の色（2D 図の金属のグラデーションの暗い側） */
  shade: string;
  /** キーボードのキー面（金属でない、つや消し） */
  keys: string;
  /** 輪郭の色（面取りのハイライト・縁取り。暗い面 PARAM-022 とのコントラスト比 3:1 以上） */
  edge: string;
  /** three.js の素材: 金属らしさ（0〜1） */
  metalness: number;
  /** three.js の素材: 表面の粗さ（0〜1。小さいほど映り込みが鋭い） */
  roughness: number;
  /** 値を SRC-009 で確かめたか（false は [ASSUMPTION] の仮置き） */
  confirmed: boolean;
}

export const PRODUCT_FINISHES: Record<ProductFinishId, ProductFinish> = {
  dune: {
    id: 'dune',
    name: 'Dune',
    base: '#F9F7F1',
    highlight: '#FFFEFA',
    shade: '#C9C1B0',
    keys: '#E2DCCD',
    edge: '#FFFDF6',
    metalness: 0.85,
    roughness: 0.34,
    confirmed: true,
  },
  platinum: {
    id: 'platinum',
    name: 'Platinum',
    base: '#D9DCDF',
    highlight: '#F4F5F7',
    shade: '#9EA3A9',
    keys: '#C4C8CD',
    edge: '#F4F6F8',
    metalness: 0.9,
    roughness: 0.3,
    confirmed: false,
  },
  black: {
    id: 'black',
    name: 'Black',
    base: '#3A3C40',
    highlight: '#6E737A',
    shade: '#1E1F22',
    keys: '#232428',
    edge: '#9AA1AA',
    metalness: 0.8,
    roughness: 0.42,
    confirmed: false,
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire',
    base: '#2E3B57',
    highlight: '#5A6C8F',
    shade: '#1A2338',
    keys: '#222C43',
    edge: '#A9B9D6',
    metalness: 0.85,
    roughness: 0.38,
    confirmed: false,
  },
};

/** 既定の製品色（SRC-009 で値を確かめた Dune。製品の色を選ぶ仕組みはないため、表示はこの 1 色） */
export const DEFAULT_FINISH: ProductFinishId = 'dune';

/** 画面（ガラス）と光の色。ブランドの光のグラデーション（PARAM-023）と暗い面（PARAM-022）から取る */
export const PRODUCT_GLASS = {
  /** 画面の地（深い紺のガラス。暗い面 PARAM-022 の 2 色のグラデーション） */
  base: BRAND.surfaceDark[1],
  baseEnd: BRAND.surfaceDark[0],
  /** 画面の周りの細い黒の縁（ベゼル） */
  bezel: '#04070D',
  /** 画面の中の光のグラデーション（PARAM-023 の 3 色） */
  glow: BRAND.glow,
  /** ガラスのつや（クリアコート） */
  clearcoat: 1,
  clearcoatRoughness: 0.06,
} as const;

/**
 * 3D の照明。キー（正面上）・フィル（光の青）・リム（背後の 2 灯）で、暗い面の上でも製品の外形が背景に埋もれない。
 * 環境光は、外部のファイルを読まない手続き的な環境マップ（three の RoomEnvironment）で金属に映り込みを与える。
 */
export const PRODUCT_LIGHTING = {
  environmentIntensity: 0.7,
  ambient: { color: '#FFFFFF', intensity: 0.25 },
  key: { color: '#FFFFFF', intensity: 2.8, position: [3, 5, 4] as const },
  fill: { color: BRAND.glow[1], intensity: 0.6, position: [-4, 2, 3] as const },
  rim: [
    { color: BRAND.glow[2], intensity: 2.4, position: [-3.5, 2.5, -4] as const },
    { color: BRAND.glow[1], intensity: 1.8, position: [3.5, 1.5, -4] as const },
  ],
} as const;

// ---------- 色の計算（WCAG 2.x の相対輝度とコントラスト比） ----------
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** 彩度の目安（RGB の最大と最小の差 / 255）。原色・蛍光色は大きく、落ち着いた金属色は小さい */
export function chroma(hex: string): number {
  const c = rgb(hex);
  return (Math.max(...c) - Math.min(...c)) / 255;
}
/** 6 桁の 16 進に不透明度（0〜1）を足した 8 桁の 16 進 */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `${hex.slice(0, 7)}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}

/**
 * 製品の 2D 図（CSS）の金属の面: 光の当たる左上から影の右下への 3 段のグラデーション。
 * 2D でも 3D と同じ製品色に見えるようにする。
 */
export function metalGradient(f: ProductFinish, angle = 145): string {
  return `linear-gradient(${angle}deg, ${f.highlight} 0%, ${f.base} 45%, ${f.shade} 100%)`;
}

/**
 * 互換のための製品・舞台の色（App1 のヒーローなど既存の参照先が使う）。製品の色は既定の製品色から、
 * 舞台・光はブランドの暗い面（PARAM-022）と光（PARAM-023）から取る。
 */
const defaultFinish = PRODUCT_FINISHES[DEFAULT_FINISH];
export const SURFACE_COLORS = {
  bg: BRAND.surfaceDark[0],
  body: defaultFinish.base,
  keys: defaultFinish.keys,
  pad: defaultFinish.highlight,
  screen: '#0A2A5E',
  screenGlow: BRAND.glow[0],
  accent: BRAND.glow[1],
  accent2: BRAND.glow[2],
  floor: BRAND.surfaceDark[1],
} as const;
