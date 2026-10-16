// App2 のデータストア（FR-011）: データセットを localStorage に保存し、変更を購読できる。
// 後続の項目は updateDataset / upsertEntity / removeEntity で書く。版の履歴（FR-014）を足すときは、
// 保存の形 { schema, revision, data } に項目を足し、updateDataset の中（commit）で履歴を積む。
// 画面は useDataset() で読む（変更で再描画される）。
import { useSyncExternalStore } from 'react';
import seedJson from './data/seed.json';
import {
  COLLECTIONS,
  KIND_OF,
  type CollectionKey,
  type Dataset,
  type Entity,
  type EntityKind,
  type VersionRecord,
} from './types';
import { migrateDataset } from './migrate';
import { validateDataset } from './validate';

export const DATA_STORAGE_KEY = 'app2:data';
/** 2: 状態値を要求定義書の語に直した（migrate.ts）。版の履歴（history）を保存に加えた */
export const DATA_SCHEMA = 2;

/** シード（読み取り専用の原本）。保存データが壊れているときや、初期化の戻し先になる */
export const seedDataset: Dataset = seedJson as unknown as Dataset;

interface Stored {
  schema: number;
  revision: number;
  data: Dataset;
  history?: VersionRecord[];
}

/** 版の履歴の初版の日時（シードの企画・見積の初版） */
export const INITIAL_VERSION_AT = '2026-01-01T00:00:00.000Z';

/** データセットの企画・見積から、初版だけの履歴を作る */
export function initialHistory(data: Dataset): VersionRecord[] {
  return [
    ...data.plans.map((p) => ({ entityId: p.id, kind: 'plan' as const, version: p.version, at: INITIAL_VERSION_AT, changes: [], states: [p.state], snapshot: { title: p.title } })),
    ...data.quotes.map((q) => ({ entityId: q.id, kind: 'quote' as const, version: q.version, at: INITIAL_VERSION_AT, changes: [], states: [q.state], snapshot: { amount: q.amount } })),
  ];
}

let state: { revision: number; data: Dataset; history: VersionRecord[] } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(DATA_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored;
    if (!p || (p.schema !== DATA_SCHEMA && p.schema !== 1) || !p.data) return null;
    const data = p.schema === 1 ? migrateDataset(p.data) : p.data;
    if (validateDataset(data).length > 0) return null;
    return { ...p, data, history: p.schema === 1 || !Array.isArray(p.history) ? initialHistory(data) : p.history };
  } catch {
    return null;
  }
}

function persist() {
  if (!state) return;
  try {
    const stored: Stored = { schema: DATA_SCHEMA, revision: state.revision, data: state.data, history: state.history };
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* 保存できない環境では、その場の状態だけで動く */
  }
}

function ensure() {
  if (!state) {
    const s = readStored();
    state = s
      ? { revision: s.revision, data: s.data, history: s.history ?? initialHistory(s.data) }
      : { revision: 0, data: seedDataset, history: initialHistory(seedDataset) };
  }
  return state;
}

/** 企画・見積の版の履歴（古い順）。entityId を渡すとその企画・見積だけ */
export function getHistory(entityId?: string): VersionRecord[] {
  const h = ensure().history;
  return entityId ? h.filter((r) => r.entityId === entityId) : h;
}

/** 現在のデータセット（保存済みがあれば復元、なければ／壊れていればシード）。変更がなければ同じ参照 */
export function getDataset(): Dataset {
  return ensure().data;
}

/** 変更のたびに 1 増える通し番号（版管理や楽観的な更新の検出に使う） */
export function getRevision(): number {
  return ensure().revision;
}

/** データセットを関数で更新して保存し、購読者に知らせる。mutator は新しい Dataset を返す（元を直接書き換えない） */
export function updateDataset(mutator: (current: Dataset) => Dataset, records: VersionRecord[] = []): Dataset {
  const cur = ensure();
  const next = mutator(cur.data);
  if (next === cur.data && records.length === 0) return cur.data;
  state = { revision: cur.revision + 1, data: next, history: records.length ? [...cur.history, ...records] : cur.history };
  persist();
  notify();
  return next;
}

/** エンティティを追加または置き換える（同じ id があれば置き換え） */
export function upsertEntity<K extends CollectionKey>(collection: K, entity: Dataset[K][number]): Dataset {
  return updateDataset((d) => {
    const rows = d[collection] as Array<{ id: string }>;
    const id = (entity as { id: string }).id;
    const i = rows.findIndex((r) => r.id === id);
    const nextRows = i >= 0 ? rows.map((r, k) => (k === i ? entity : r)) : [...rows, entity];
    return { ...d, [collection]: nextRows } as Dataset;
  });
}

/** エンティティを削除する（参照している側の整理は呼び出し側で行う） */
export function removeEntity(collection: CollectionKey, id: string): Dataset {
  return updateDataset((d) => ({ ...d, [collection]: (d[collection] as Array<{ id: string }>).filter((r) => r.id !== id) }) as Dataset);
}

/** シードに戻す（保存も消す） */
export function resetDataset(): Dataset {
  state = { revision: 0, data: seedDataset, history: initialHistory(seedDataset) };
  try {
    localStorage.removeItem(DATA_STORAGE_KEY);
  } catch {
    /* 同上 */
  }
  notify();
  return state.data;
}

/** メモリの状態を捨てて、保存から読み直す（テスト・別タブの変更の取り込み用） */
export function reloadDataset(): Dataset {
  state = null;
  const d = getDataset();
  notify();
  return d;
}

export function subscribeDataset(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useDataset(): Dataset {
  return useSyncExternalStore(subscribeDataset, getDataset);
}

/** 版の履歴を読む（変更で再描画される） */
export function useHistory(): VersionRecord[] {
  return useSyncExternalStore(subscribeDataset, () => ensure().history);
}

/** id からエンティティと種類を探す（ID は全コレクションで一意） */
export function findEntity(data: Dataset, id: string): { kind: EntityKind; collection: CollectionKey; entity: Entity } | null {
  for (const c of COLLECTIONS) {
    const e = (data[c] as Array<{ id: string }>).find((r) => r.id === id);
    if (e) return { kind: KIND_OF[c], collection: c, entity: e as Entity };
  }
  return null;
}
