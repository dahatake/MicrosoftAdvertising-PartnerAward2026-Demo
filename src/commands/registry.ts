// コマンドの登録簿: シェル・各画面・ワークスペースがコマンドを登録し、コマンドの検索（パレット）が一覧する。
import { useSyncExternalStore } from 'react';

export interface Command {
  id: string;
  label: string;
  /** 検索に使う追加の語（言語に依らない英語の語を含める） */
  keywords?: string;
  run: () => void;
}

const owners = new Map<string, readonly Command[]>();
const listeners = new Set<() => void>();
let snapshot: readonly Command[] = [];

function rebuild() {
  snapshot = [...owners.values()].flat();
  listeners.forEach((l) => l());
}

/** owner ごとにコマンドを（置き換えて）登録する。戻り値で登録を外す */
export function registerCommands(owner: string, commands: readonly Command[]): () => void {
  owners.set(owner, commands);
  rebuild();
  return () => {
    if (owners.get(owner) === commands) {
      owners.delete(owner);
      rebuild();
    }
  };
}

export function useCommands(): readonly Command[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
}

/** 全部の語を含むコマンドだけを残す（大文字小文字を区別しない） */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((c) => {
    const hay = `${c.label} ${c.keywords ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
