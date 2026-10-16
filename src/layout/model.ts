// ワークスペースのレイアウトの状態と操作（純関数）。移動・サイズ変更・方向・タブ化・表示/非表示・最大化。
export type Direction = 'row' | 'column';

export interface LayoutState {
  direction: Direction;
  /** パネルの並び順（先頭が最初） */
  order: string[];
  hidden: string[];
  /** 幅（または高さ）の比の重み */
  sizes: Record<string, number>;
  /** タブにまとめたパネル（同じタブの組になる） */
  tabbed: string[];
  activeTab: string | null;
  maximized: string | null;
}

export const MIN_SIZE = 0.5;
export const MAX_SIZE = 4;

export interface LayoutDefaults {
  direction?: Direction;
  sizes?: Record<string, number>;
  hidden?: string[];
  tabbed?: string[];
}

export function defaultLayout(ids: readonly string[], d: LayoutDefaults = {}): LayoutState {
  return {
    direction: d.direction ?? 'row',
    order: [...ids],
    hidden: (d.hidden ?? []).filter((i) => ids.includes(i)),
    sizes: Object.fromEntries(ids.map((i) => [i, d.sizes?.[i] ?? 1])),
    tabbed: (d.tabbed ?? []).filter((i) => ids.includes(i)),
    activeTab: null,
    maximized: null,
  };
}

/** 保存された状態を現在のパネル ID に合わせる（消えたパネルを除き、増えたパネルを末尾に足す）。変化がなければ同じ参照を返す */
export function reconcile(state: LayoutState, ids: readonly string[], d: LayoutDefaults = {}): LayoutState {
  const known = state.order.filter((i) => ids.includes(i));
  const added = ids.filter((i) => !state.order.includes(i));
  const same =
    added.length === 0 &&
    known.length === state.order.length &&
    state.hidden.every((i) => ids.includes(i)) &&
    state.tabbed.every((i) => ids.includes(i)) &&
    (state.maximized === null || ids.includes(state.maximized));
  if (same) return state;
  return {
    ...state,
    order: [...known, ...added],
    hidden: state.hidden.filter((i) => ids.includes(i)),
    tabbed: state.tabbed.filter((i) => ids.includes(i)),
    sizes: { ...Object.fromEntries(added.map((i) => [i, d.sizes?.[i] ?? 1])), ...state.sizes },
    maximized: state.maximized && ids.includes(state.maximized) ? state.maximized : null,
  };
}

export function moveBy(s: LayoutState, id: string, delta: number): LayoutState {
  const from = s.order.indexOf(id);
  if (from < 0) return s;
  const to = Math.max(0, Math.min(s.order.length - 1, from + delta));
  if (to === from) return s;
  const order = [...s.order];
  order.splice(from, 1);
  order.splice(to, 0, id);
  return { ...s, order };
}

/** ドラッグで id を target の位置へ移す */
export function moveTo(s: LayoutState, id: string, target: string): LayoutState {
  const to = s.order.indexOf(target);
  const from = s.order.indexOf(id);
  if (to < 0 || from < 0 || to === from) return s;
  return moveBy(s, id, to - from);
}

export function resizeBy(s: LayoutState, id: string, delta: number): LayoutState {
  if (!(id in s.sizes)) return s;
  const size = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round((s.sizes[id] + delta) * 100) / 100));
  if (size === s.sizes[id]) return s;
  return { ...s, sizes: { ...s.sizes, [id]: size } };
}

export function setDirection(s: LayoutState, direction: Direction): LayoutState {
  return s.direction === direction ? s : { ...s, direction };
}

export function toggleHidden(s: LayoutState, id: string): LayoutState {
  const hidden = s.hidden.includes(id) ? s.hidden.filter((i) => i !== id) : [...s.hidden, id];
  return { ...s, hidden, maximized: s.maximized === id && hidden.includes(id) ? null : s.maximized };
}

export function toggleTabbed(s: LayoutState, id: string): LayoutState {
  const tabbed = s.tabbed.includes(id) ? s.tabbed.filter((i) => i !== id) : [...s.tabbed, id];
  return { ...s, tabbed, activeTab: tabbed.includes(id) ? id : s.activeTab };
}

export function setActiveTab(s: LayoutState, id: string): LayoutState {
  return s.activeTab === id ? s : { ...s, activeTab: id };
}

export function toggleMaximized(s: LayoutState, id: string): LayoutState {
  return { ...s, maximized: s.maximized === id ? null : id };
}

/** タブの組のうち、いま表示されているパネル（非表示のパネルは除く） */
export function tabGroup(s: LayoutState): string[] {
  return s.order.filter((i) => s.tabbed.includes(i) && !s.hidden.includes(i));
}

export function activeTabOf(s: LayoutState): string | null {
  const g = tabGroup(s);
  if (g.length < 2) return null;
  return s.activeTab && g.includes(s.activeTab) ? s.activeTab : g[0];
}

/** パネルが画面に出ているか（非表示・最大化中の他のパネル・非アクティブなタブは出ない） */
export function isShown(s: LayoutState, id: string): boolean {
  if (s.hidden.includes(id)) return false;
  if (s.maximized && s.maximized !== id) return false;
  const active = activeTabOf(s);
  if (active && s.tabbed.includes(id) && id !== active) return false;
  return true;
}

export function parseLayout(raw: string | null): LayoutState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<LayoutState>;
    if (!Array.isArray(v.order) || !Array.isArray(v.hidden) || typeof v.sizes !== 'object' || v.sizes === null) return null;
    return {
      direction: v.direction === 'column' ? 'column' : 'row',
      order: v.order.filter((x): x is string => typeof x === 'string'),
      hidden: v.hidden.filter((x): x is string => typeof x === 'string'),
      sizes: v.sizes as Record<string, number>,
      tabbed: Array.isArray(v.tabbed) ? v.tabbed.filter((x): x is string => typeof x === 'string') : [],
      activeTab: typeof v.activeTab === 'string' ? v.activeTab : null,
      maximized: typeof v.maximized === 'string' ? v.maximized : null,
    };
  } catch {
    return null;
  }
}
