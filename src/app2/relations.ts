// キャンペーンを起点にした関連の抽出（FR-012）。純関数で、2D の関係図と 3D が同じ結果を使う。
import type { Dataset, Entity, EntityKind } from './types';

export interface RelNode {
  id: string;
  kind: EntityKind;
  label: string;
  /** 起点（キャンペーン）からの階層。顧客は -1 */
  depth: number;
}
export interface RelEdge {
  from: string;
  to: string;
}
export interface Relations {
  nodes: RelNode[];
  edges: RelEdge[];
}

/** 画面に出すエンティティの短い名前 */
export function entityLabel(kind: EntityKind, e: Entity): string {
  const r = e as unknown as Record<string, unknown>;
  switch (kind) {
    case 'plan':
      return String(r.title);
    case 'quote':
      return `見積 v${r.version}（${Number(r.amount).toLocaleString('ja-JP')}円）`;
    case 'kpi':
      return String(r.metric);
    case 'usage':
      return `表示 ${Number(r.impressions).toLocaleString('ja-JP')}`;
    case 'deployment':
      return `展開 ${String(r.id)}`;
    case 'order':
      return `発注 ${String(r.id)}（${Number(r.amount).toLocaleString('ja-JP')}円）`;
    default:
      return String(r.name);
  }
}

/** 指定のキャンペーンに関連するエンティティ（ノード）と関連（線）。キャンペーンがなければ空 */
export function buildRelations(data: Dataset, campaignId: string | null | undefined): Relations {
  const camp = data.campaigns.find((c) => c.id === campaignId);
  if (!camp) return { nodes: [], edges: [] };
  const nodes: RelNode[] = [];
  const edges: RelEdge[] = [];
  const add = (kind: EntityKind, e: Entity, depth: number) => nodes.push({ id: (e as { id: string }).id, kind, label: entityLabel(kind, e), depth });
  const link = (from: string, to: string) => edges.push({ from, to });

  const customer = data.customers.find((c) => c.id === camp.customerId);
  if (customer) {
    add('customer', customer, -1);
    link(customer.id, camp.id);
  }
  add('campaign', camp, 0);
  for (const p of data.plans.filter((x) => x.campaignId === camp.id)) {
    add('plan', p, 1);
    link(camp.id, p.id);
    for (const q of data.quotes.filter((x) => x.planId === p.id)) {
      add('quote', q, 2);
      link(p.id, q.id);
    }
  }
  for (const k of data.kpis.filter((x) => x.campaignId === camp.id)) {
    add('kpi', k, 1);
    link(camp.id, k.id);
  }
  const vendorSeen = new Set<string>();
  const channelSeen = new Set<string>();
  for (const pr of data.projects.filter((x) => x.campaignId === camp.id)) {
    add('project', pr, 1);
    link(camp.id, pr.id);
    for (const o of data.orders.filter((x) => x.projectId === pr.id)) {
      add('order', o, 2);
      link(pr.id, o.id);
      const v = data.vendors.find((x) => x.id === o.vendorId);
      if (v) {
        if (!vendorSeen.has(v.id)) {
          vendorSeen.add(v.id);
          add('vendor', v, 3);
        }
        link(o.id, v.id);
      }
    }
    for (const a of data.assets.filter((x) => x.projectId === pr.id)) {
      add('asset', a, 2);
      link(pr.id, a.id);
      for (const d of data.deployments.filter((x) => x.assetId === a.id)) {
        add('deployment', d, 3);
        link(a.id, d.id);
        const ch = data.channels.find((x) => x.id === d.channelId);
        if (ch) {
          if (!channelSeen.has(ch.id)) {
            channelSeen.add(ch.id);
            add('channel', ch, 4);
          }
          link(d.id, ch.id);
        }
        for (const u of data.usages.filter((x) => x.deploymentId === d.id)) {
          add('usage', u, 4);
          link(d.id, u.id);
        }
      }
    }
  }
  return { nodes, edges };
}
