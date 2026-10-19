// App2 のペルソナと既定の情報表現（FR-018、要求定義書 §7）。最後に選んだペルソナを localStorage に保存する。
import { useSyncExternalStore } from 'react';

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

// ペルソナごとの既定のレイアウト（FR-021、§7）は、業務領域（FR-025）ごとに src/app2/areas.ts の AREA_LAYOUT で定める。
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
