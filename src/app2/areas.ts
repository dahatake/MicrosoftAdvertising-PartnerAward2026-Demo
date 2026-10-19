// App2 の業務領域（FR-025）: 左メニューの項目、キー、ペルソナごとの既定のパネル構成（FR-021・AC-107。要求定義書 §7 を領域ごとに割り当て）。
// メニューの順序は、全体の関係 → 業務ワークフロー（企画→見積→制作→発注→素材→展開→利用状況）→ KPI 試算。
import type { LayoutDefaults } from '../layout/model';
import type { MessageKey } from '../i18n';
import type { PersonaId } from './persona';

export const AREAS = ['relation', 'plan', 'quote', 'production', 'order', 'asset', 'deploy', 'usage', 'kpi'] as const;
export type AreaKey = (typeof AREAS)[number];
export const DEFAULT_AREA: AreaKey = 'relation';

export const isArea = (v: unknown): v is AreaKey => (AREAS as readonly string[]).includes(v as string);

export const areaLabelKey = (a: AreaKey) => `nav.${a}` as MessageKey;
export const areaTipKey = (a: AreaKey) => `nav.tip.${a}` as MessageKey;

/** 画面のアドレス（ハッシュ）: #/app2/<領域> */
export const AREA_HASH_PREFIX = '#/app2/';
export function areaFromHash(hash: string): AreaKey {
  if (!hash.startsWith(AREA_HASH_PREFIX)) return DEFAULT_AREA;
  const k = decodeURIComponent(hash.slice(AREA_HASH_PREFIX.length));
  return isArea(k) ? k : DEFAULT_AREA;
}

/**
 * 領域ごとのパネル ID（Workspace のパネル）。1 つの領域の画面には、この中から 1 画面に収まる数だけを表示する。
 * m=メモ、c=キャンペーン、r=関係図、p=制作プロジェクト、w=what-if、g=表現（表・グラフ・ガント・関係）、
 * pl=企画、q=見積、a=素材一覧、f=素材の登録、x=実広告素材、o=発注、d=展開、u=利用状況
 */
export const AREA_PANELS: Record<AreaKey, readonly string[]> = {
  relation: ['c', 'r', 'm'],
  plan: ['pl', 'm'],
  quote: ['q', 'm'],
  production: ['p', 'g', 'm'],
  order: ['o', 'm'],
  asset: ['a', 'f', 'x'],
  deploy: ['d', 'm'],
  usage: ['u', 'm'],
  kpi: ['w', 'g', 'm'],
};

type AreaLayouts = Record<AreaKey, LayoutDefaults>;

/** P-3 広告プランナー: 企画・見積・関係・KPI 試算を広く。メモは小さく */
const P3: AreaLayouts = {
  relation: { order: ['r', 'c', 'm'], sizes: { r: 3, c: 1, m: 0.5 } },
  plan: { order: ['pl', 'm'], sizes: { pl: 3, m: 0.5 } },
  quote: { order: ['q', 'm'], sizes: { q: 3, m: 0.5 } },
  production: { order: ['g', 'p', 'm'], sizes: { g: 3, p: 1.5, m: 0.5 } },
  order: { order: ['o', 'm'], sizes: { o: 3, m: 0.5 } },
  asset: { order: ['a', 'f', 'x'], sizes: { a: 2, f: 1.2, x: 1.8 } },
  deploy: { order: ['d', 'm'], sizes: { d: 3, m: 0.5 } },
  usage: { order: ['u', 'm'], sizes: { u: 3, m: 0.5 } },
  kpi: { order: ['w', 'g', 'm'], sizes: { w: 2, g: 3, m: 0.5 } },
};

/** P-4 制作ディレクター: 制作（ガント）・発注・素材を広く。関係図は一覧を先に */
const P4: AreaLayouts = {
  relation: { order: ['c', 'r', 'm'], sizes: { c: 1, r: 2, m: 0.5 } },
  plan: { order: ['m', 'pl'], sizes: { pl: 3, m: 0.5 } },
  quote: { order: ['m', 'q'], sizes: { q: 3, m: 0.5 } },
  production: { order: ['p', 'g', 'm'], sizes: { p: 1.5, g: 3, m: 0.5 } },
  order: { order: ['o', 'm'], sizes: { o: 4, m: 0.5 } },
  asset: { order: ['f', 'a', 'x'], sizes: { a: 2, f: 1.2, x: 1.8 } },
  deploy: { order: ['m', 'd'], sizes: { d: 3, m: 0.5 } },
  usage: { order: ['m', 'u'], sizes: { u: 3, m: 0.5 } },
  kpi: { order: ['g', 'w', 'm'], sizes: { g: 3, w: 2, m: 0.5 } },
};

/** P-5 アカウントマネージャー: 展開・利用状況・KPI を広く。メモは非表示 */
const P5: AreaLayouts = {
  relation: { order: ['r', 'c', 'm'], sizes: { r: 3, c: 1, m: 0.5 }, hidden: ['m'] },
  plan: { order: ['pl', 'm'], sizes: { pl: 2, m: 1 }, hidden: ['m'] },
  quote: { order: ['q', 'm'], sizes: { q: 2, m: 1 }, hidden: ['m'] },
  production: { order: ['g', 'p', 'm'], sizes: { g: 3, p: 1.5, m: 0.5 }, hidden: ['m'] },
  order: { order: ['o', 'm'], sizes: { o: 2, m: 1 }, hidden: ['m'] },
  asset: { order: ['x', 'a', 'f'], sizes: { a: 2, x: 1.8, f: 1.2 } },
  deploy: { order: ['d', 'm'], sizes: { d: 4, m: 0.5 }, hidden: ['m'] },
  usage: { order: ['u', 'm'], sizes: { u: 4, m: 0.5 }, hidden: ['m'] },
  kpi: { order: ['g', 'w', 'm'], sizes: { g: 3, w: 1.5, m: 0.5 }, hidden: ['m'] },
};

export const AREA_LAYOUT: Record<PersonaId, AreaLayouts> = { 'P-3': P3, 'P-4': P4, 'P-5': P5 };
