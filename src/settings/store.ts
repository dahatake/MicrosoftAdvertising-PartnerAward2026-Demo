// 設定ストア: 言語・表示方法・アプリを 1 か所で持ち、localStorage に保存する（アプリ切替でも保たれる）。
// 設定を増やすときは Settings に項目を足し、initialSettings に追加する。
import { useSyncExternalStore } from 'react';
import { detectLang, isLang, type Lang } from '../i18n';

export type AppId = 'app1' | 'app2';
export type ViewMethod = '2d' | '3d';

export interface Settings {
  lang: Lang;
  viewMethod: ViewMethod;
  app: AppId;
}

export const STORAGE_KEYS = { lang: 'lang', viewMethod: 'viewMethod' } as const;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 保存できない環境では、その場の状態だけで動く */
  }
}

/** 保存された言語を優先し、無ければブラウザの言語（AC-003/004/006） */
export function initialSettings(languages: readonly string[] | undefined = navigator.languages): Settings {
  const saved = readStorage(STORAGE_KEYS.lang);
  const view = readStorage(STORAGE_KEYS.viewMethod);
  return {
    lang: isLang(saved) ? saved : detectLang(languages),
    viewMethod: view === '3d' ? '3d' : '2d',
    app: 'app1',
  };
}

let state: Settings = initialSettings();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return state;
}

export function updateSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  if (patch.lang) writeStorage(STORAGE_KEYS.lang, state.lang);
  if (patch.viewMethod) writeStorage(STORAGE_KEYS.viewMethod, state.viewMethod);
  listeners.forEach((l) => l());
}

/** テスト用: 保存内容から状態を作り直す */
export function resetSettings(languages?: readonly string[]) {
  state = initialSettings(languages);
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSettings,
  );
}
