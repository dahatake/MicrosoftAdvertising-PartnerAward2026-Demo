// KPI の what-if 試算（FR-015）。シードの係数だけを使う単純で決定的なモデルで、外部の予測は使わず、データも書き換えない（AC-047/048）。
//   予測値 = 目標 × (試算の予算 ÷ 元の予算)^弾力性 × (試算の配分効率 ÷ 元の配分効率)
//   配分効率 = Σ(配分 × チャネル係数) ÷ Σ配分
import type { Channel, Kpi } from './types';

/** 予算の弾力性（予算が 2 倍でも KPI は 2 倍にならない）。シードの係数 */
export const BUDGET_ELASTICITY = 0.6;

/** チャネルごとの効率係数（シード）。未登録のチャネルは 1 */
export const CHANNEL_COEFFICIENTS: Record<string, number> = {
  'chn-1': 1.2,
  'chn-2': 1.0,
  'chn-3': 0.9,
  'chn-4': 1.1,
};

export interface Assumptions {
  /** 予算（円） */
  budget: number;
  /** チャネル ID → 配分（%、相対値でよい） */
  alloc: Record<string, number>;
}

/** 元の前提: キャンペーンの予算と、全チャネルへの均等配分 */
export function baselineAssumptions(budget: number, channels: readonly Channel[]): Assumptions {
  const alloc: Record<string, number> = {};
  const share = channels.length > 0 ? Math.round(100 / channels.length) : 0;
  for (const c of channels) alloc[c.id] = share;
  return { budget, alloc };
}

function efficiency(alloc: Record<string, number>): number {
  let sum = 0;
  let weighted = 0;
  for (const [id, raw] of Object.entries(alloc)) {
    const v = Number.isFinite(raw) && raw > 0 ? raw : 0;
    sum += v;
    weighted += v * (CHANNEL_COEFFICIENTS[id] ?? 1);
  }
  return sum > 0 ? weighted / sum : 0;
}

/** 1 つの KPI の予測値（整数）。同じ入力からは常に同じ値 */
export function forecastKpi(kpi: Pick<Kpi, 'target'>, assumed: Assumptions, base: Assumptions): number {
  const budgetRatio = base.budget > 0 ? Math.max(assumed.budget, 0) / base.budget : 1;
  const baseEff = efficiency(base.alloc);
  const effRatio = baseEff > 0 ? efficiency(assumed.alloc) / baseEff : 1;
  return Math.round(kpi.target * Math.pow(budgetRatio, BUDGET_ELASTICITY) * effRatio);
}

export interface ForecastRow {
  kpiId: string;
  metric: string;
  unit: string;
  baseline: number;
  forecast: number;
}

export function simulate(kpis: readonly Kpi[], assumed: Assumptions, base: Assumptions): ForecastRow[] {
  return kpis.map((k) => ({
    kpiId: k.id,
    metric: k.metric,
    unit: k.unit,
    baseline: k.target,
    forecast: forecastKpi(k, assumed, base),
  }));
}
