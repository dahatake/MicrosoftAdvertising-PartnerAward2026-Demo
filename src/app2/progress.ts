// 制作プロジェクトの進捗・予算の表示用ロジック（FR-013）。純関数。
import type { MessageKey } from '../i18n';
import type { Dataset, Kpi, Project } from './types';

/** データの状態値 → 状態の文言キー。状態値は要求定義書の語（計画中・制作中・レビュー中・完了）をそのまま保存する */
const STATUS_KEYS: Record<string, MessageKey> = {
  計画中: 'app2.status.planning',
  制作中: 'app2.status.production',
  レビュー中: 'app2.status.review',
  完了: 'app2.status.done',
};

export function projectStatusKey(status: string): MessageKey | null {
  return STATUS_KEYS[status] ?? null;
}

/** 予算を超えて消化している（AC-044） */
export function isOverBudget(p: Pick<Project, 'budget' | 'spent'>): boolean {
  return p.spent > p.budget;
}

/** 消化率（%）。予算 0 のときは、消化があれば 100 超として扱う */
export function spentPercent(p: Pick<Project, 'budget' | 'spent'>): number {
  if (p.budget <= 0) return p.spent > 0 ? 100 : 0;
  return Math.round((p.spent / p.budget) * 100);
}

/** 制作プロジェクトに紐づく KPI（所属キャンペーンの KPI） */
export function kpisOfProject(data: Dataset, projectId: string | null): Kpi[] {
  const p = data.projects.find((x) => x.id === projectId);
  return p ? data.kpis.filter((k) => k.campaignId === p.campaignId) : [];
}

export const formatYen = (n: number) => `${n.toLocaleString('ja-JP')}円`;
