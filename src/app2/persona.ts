// App2 のペルソナと既定の情報表現（FR-018、要求定義書 §7）。最後に選んだペルソナを localStorage に保存する。
import { useSyncExternalStore } from 'react';
import type { LayoutDefaults } from '../layout/model';

export type PersonaId = 'P-3' | 'P-4' | 'P-5';
export type Representation = 'table' | 'graph' | 'gantt' | 'relation';

export const PERSONAS: readonly PersonaId[] = ['P-3', 'P-4', 'P-5'];
export const REPRESENTATIONS: readonly Representation[] = ['table', 'graph', 'gantt', 'relation'];

/** ペルソナごとの既定の表現: 広告プランナー=比較グラフ、制作ディレクター=ガント、アカウントマネージャー=時系列グラフ */
export const DEFAULT_REPRESENTATION: Record<PersonaId, Representation> = {
  'P-3': 'graph',
  'P-4': 'gantt',
  'P-5': 'graph',
};

export const PERSONA_STORAGE_KEY = 'app2:persona';

/**
 * ペルソナごとの既定のレイアウト（FR-021、要求定義書 §7）。パネル ID は App2 の画面（src/apps/App2.tsx）のもの:
 * 1 メモ・2 項目・3 キャンペーン・4 関係図・5 プロジェクト・6 what-if・7 表現（グラフ・ガント）・8 企画・見積・9 素材・10 展開・11 発注。
 * メモ（1）はどのペルソナでも表示する。
 */
export const PERSONA_LAYOUT: Record<PersonaId, LayoutDefaults> = {
  // グラフ大・版履歴（企画・見積）・what-if
  'P-3': { order: ['7', '8', '6', '1', '3', '4', '5', '2'], sizes: { '7': 3, '8': 1.5, '6': 1.5 }, hidden: ['9', '10', '11'] },
  // ガント大・発注一覧・素材一覧
  'P-4': { order: ['7', '5', '11', '9', '1', '10', '2', '3', '4'], sizes: { '7': 3, '5': 1.5, '11': 1.5, '9': 1.5 }, hidden: ['6', '8'] },
  // グラフ大・KPI 概要（展開）・関係図
  'P-5': { order: ['7', '10', '4', '1', '3', '2', '5'], sizes: { '7': 3, '10': 1.5, '4': 1.5 }, hidden: ['6', '8', '9', '11'] },
};
export const isPersona = (v: unknown): v is PersonaId => PERSONAS.includes(v as PersonaId);
export const isRepresentation = (v: unknown): v is Representation => REPRESENTATIONS.includes(v as Representation);

function read(): PersonaId {
  try {
    const v = localStorage.getItem(PERSONA_STORAGE_KEY);
    if (isPersona(v)) return v;
  } catch {
    /* 読めない環境では既定 */
  }
  return 'P-3';
}

let persona: PersonaId = read();
const listeners = new Set<() => void>();

export function getPersona(): PersonaId {
  return persona;
}

export function setPersona(p: PersonaId) {
  persona = p;
  try {
    localStorage.setItem(PERSONA_STORAGE_KEY, p);
  } catch {
    /* 保存できない環境では、その場の状態だけで動く */
  }
  listeners.forEach((l) => l());
}

/** テスト用: 保存内容から状態を作り直す */
export function resetPersona() {
  persona = read();
  listeners.forEach((l) => l());
}

export function usePersona(): PersonaId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getPersona,
  );
}
