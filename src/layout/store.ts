// レイアウトの保存: 画面ごとに localStorage（キー layout:<screenId>）。変更は即座に保存・通知される。
import { useSyncExternalStore } from 'react';
import { defaultLayout, parseLayout, reconcile, type LayoutDefaults, type LayoutState } from './model';

export const LAYOUT_KEY_PREFIX = 'layout:';

const states = new Map<string, LayoutState>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 画面の現在のレイアウト（保存済みがあれば復元、なければ既定）。同じ内容なら同じ参照を返す */
export function getLayout(screenId: string, ids: readonly string[], defaults?: LayoutDefaults): LayoutState {
  const cur = states.get(screenId) ?? parseLayout(read(LAYOUT_KEY_PREFIX + screenId)) ?? defaultLayout(ids, defaults);
  const next = reconcile(cur, ids, defaults);
  if (states.get(screenId) !== next) states.set(screenId, next);
  return next;
}

export function setLayout(screenId: string, next: LayoutState) {
  states.set(screenId, next);
  try {
    localStorage.setItem(LAYOUT_KEY_PREFIX + screenId, JSON.stringify(next));
  } catch {
    /* 保存できない環境では、その場の状態だけで動く */
  }
  notify();
}

/** 画面のレイアウトを既定に戻す（保存も消す） */
export function resetLayout(screenId: string) {
  states.delete(screenId);
  try {
    localStorage.removeItem(LAYOUT_KEY_PREFIX + screenId);
  } catch {
    /* 同上 */
  }
  notify();
}

export function resetAllLayouts() {
  states.clear();
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LAYOUT_KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* 同上 */
  }
  notify();
}

export function useLayout(screenId: string, ids: readonly string[], defaults?: LayoutDefaults): LayoutState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getLayout(screenId, ids, defaults),
  );
}
