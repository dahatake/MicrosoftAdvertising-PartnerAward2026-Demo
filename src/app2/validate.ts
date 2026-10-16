// データセットの検証（AC-039）: 必須項目の欠け・重複 ID・解決できない参照を一覧にして返す（空なら正しい）。
import { COLLECTIONS, type CollectionKey, type Dataset } from './types';

export interface Issue {
  collection: CollectionKey | 'organization';
  id: string;
  field: string;
  message: string;
}

/** 必須項目（空文字・null・undefined を欠けとみなす。imageUrl は任意） */
const REQUIRED: Record<CollectionKey, readonly string[]> = {
  customers: ['id', 'name', 'industry'],
  campaigns: ['id', 'customerId', 'name', 'product', 'startDate', 'endDate', 'budget', 'status'],
  plans: ['id', 'campaignId', 'title', 'version', 'state'],
  quotes: ['id', 'planId', 'campaignId', 'amount', 'version', 'state'],
  projects: ['id', 'campaignId', 'name', 'progressPercent', 'status', 'budget', 'spent', 'dueDate', 'deliverables'],
  vendors: ['id', 'name', 'category'],
  orders: ['id', 'projectId', 'vendorId', 'amount', 'dueDate', 'state'],
  assets: ['id', 'projectId', 'name', 'type', 'tags', 'state'],
  channels: ['id', 'name'],
  deployments: ['id', 'assetId', 'channelId', 'startDate', 'state'],
  kpis: ['id', 'campaignId', 'metric', 'unit', 'target', 'actual'],
  usages: ['id', 'deploymentId', 'impressions', 'clicks'],
};

/** 参照: [コレクション, 参照の項目, 参照先コレクション] */
export const REFERENCES: ReadonlyArray<readonly [CollectionKey, string, CollectionKey]> = [
  ['campaigns', 'customerId', 'customers'],
  ['plans', 'campaignId', 'campaigns'],
  ['quotes', 'planId', 'plans'],
  ['quotes', 'campaignId', 'campaigns'],
  ['projects', 'campaignId', 'campaigns'],
  ['orders', 'projectId', 'projects'],
  ['orders', 'vendorId', 'vendors'],
  ['assets', 'projectId', 'projects'],
  ['deployments', 'assetId', 'assets'],
  ['deployments', 'channelId', 'channels'],
  ['kpis', 'campaignId', 'campaigns'],
  ['usages', 'deploymentId', 'deployments'],
];

const blank = (v: unknown) => v === undefined || v === null || v === '';

export function validateDataset(data: Dataset): Issue[] {
  const issues: Issue[] = [];
  if (!data.organization || blank(data.organization.id) || blank(data.organization.name)) {
    issues.push({ collection: 'organization', id: '', field: 'name', message: '組織が欠けています' });
  }
  const ids = new Set<string>();
  for (const c of COLLECTIONS) {
    const rows = (data[c] ?? []) as unknown as Array<Record<string, unknown>>;
    if (!Array.isArray(data[c])) {
      issues.push({ collection: c, id: '', field: '', message: 'コレクションがありません' });
      continue;
    }
    for (const row of rows) {
      const id = String(row.id ?? '');
      for (const f of REQUIRED[c]) {
        if (blank(row[f])) issues.push({ collection: c, id, field: f, message: `必須項目 ${f} が欠けています` });
      }
      if (id) {
        if (ids.has(id)) issues.push({ collection: c, id, field: 'id', message: 'ID が重複しています' });
        ids.add(id);
      }
    }
  }
  for (const [c, field, target] of REFERENCES) {
    const targets = new Set(((data[target] ?? []) as Array<{ id: string }>).map((r) => r.id));
    for (const row of (data[c] ?? []) as unknown as Array<Record<string, unknown>>) {
      if (!blank(row[field]) && !targets.has(String(row[field]))) {
        issues.push({ collection: c, id: String(row.id ?? ''), field, message: `${field} が ${target} に存在しません` });
      }
    }
  }
  return issues;
}
