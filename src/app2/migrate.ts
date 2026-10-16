// 保存データの移行（localStorage 版）。状態値を要求定義書の語に直す（schema 1 → 2）。
// 旧: 企画 承認済み/承認待ち、見積 承認待ち、制作プロジェクト 未着手/進行中、発注 発注済み/納品済み/検収済み、素材 登録済み/アーカイブ済み
import type { Dataset } from './types';

const MAP = {
  plans: { 承認済み: '確定', 承認待ち: '下書き' },
  quotes: { 承認待ち: '提出済み' },
  orders: { 発注済み: '発注済', 納品済み: '納品済', 検収済み: '検収済' },
  assets: { 登録済み: '登録済', アーカイブ済み: 'アーカイブ' },
} as const;
const STATUS_MAP: Record<string, string> = { 未着手: '計画中', 進行中: '制作中' };

const map = (m: Record<string, string>, v: string) => m[v] ?? v;

/** schema 1 のデータを現行の状態値に直す。元は書き換えない */
export function migrateDataset(d: Dataset): Dataset {
  const next: Dataset = {
    ...d,
    plans: d.plans.map((r) => ({ ...r, state: map(MAP.plans, r.state) })),
    quotes: d.quotes.map((r) => ({ ...r, state: map(MAP.quotes, r.state) })),
    orders: d.orders.map((r) => ({ ...r, state: map(MAP.orders, r.state) })),
    assets: d.assets.map((r) => ({ ...r, state: map(MAP.assets, r.state) })),
    projects: d.projects.map((r) => ({ ...r, status: map(STATUS_MAP, r.status) })),
  };
  return next;
}
