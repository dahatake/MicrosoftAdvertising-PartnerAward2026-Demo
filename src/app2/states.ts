// 状態の語と遷移の検証（FR-014・FR-016・FR-017・FR-019）。状態値は要求定義書の語をそのまま保存する。
import type { MessageKey } from '../i18n';

/** 企画: 下書き→確定→改訂中→確定 */
export const PLAN_STATES = { draft: '下書き', confirmed: '確定', revising: '改訂中' } as const;
/** 見積: 下書き→提出済み→承認済み→改訂中→提出済み */
export const QUOTE_STATES = { draft: '下書き', submitted: '提出済み', approved: '承認済み', revising: '改訂中' } as const;
/** 素材: 登録済→承認済→展開中→アーカイブ（この順にしか進めない） */
export const ASSET_FLOW = ['登録済', '承認済', '展開中', 'アーカイブ'] as const;
/** 発注: 依頼前→発注済→納品済→検収済（この順にしか進めない） */
export const ORDER_FLOW = ['依頼前', '発注済', '納品済', '検収済'] as const;
/** 展開の状態 */
export const DEPLOYMENT_STATES = { active: '展開中', ended: '終了' } as const;

/** 状態値 → 状態の文言キー（色だけでなく文言で示す）。ここにない値は値そのものを表示する */
const STATE_KEYS: Record<string, MessageKey> = {
  計画中: 'app2.status.planning',
  制作中: 'app2.status.production',
  レビュー中: 'app2.status.review',
  完了: 'app2.status.done',
  下書き: 'app2.state.draft',
  確定: 'app2.state.confirmed',
  改訂中: 'app2.state.revising',
  提出済み: 'app2.state.submitted',
  承認済み: 'app2.state.approved',
  承認済: 'app2.state.approved',
  登録済: 'app2.state.registered',
  展開中: 'app2.state.deploying',
  アーカイブ: 'app2.state.archived',
  終了: 'app2.state.ended',
  依頼前: 'app2.state.notRequested',
  発注済: 'app2.state.ordered',
  納品済: 'app2.state.delivered',
  検収済: 'app2.state.accepted',
};

export const stateKey = (state: string): MessageKey | null => STATE_KEYS[state] ?? null;

/** 状態値 → 機械可読のコード（data-state に使う。言語に依らない） */
const STATE_CODES: Record<string, string> = {
  下書き: 'draft',
  確定: 'confirmed',
  改訂中: 'revising',
  提出済み: 'submitted',
  承認済み: 'approved',
  承認済: 'approved',
  登録済: 'registered',
  展開中: 'deploying',
  アーカイブ: 'archived',
  終了: 'ended',
  依頼前: 'notRequested',
  発注済: 'ordered',
  納品済: 'delivered',
  検収済: 'accepted',
};
export const stateCode = (state: string): string => STATE_CODES[state] ?? state;

/** 遷移を拒否する理由（画面では errorKey で文言にする） */
export type FailCode =
  | 'required'
  | 'amount'
  | 'date'
  | 'backward'
  | 'skip'
  | 'same'
  | 'unknown'
  | 'noKpi'
  | 'notFound'
  | 'nochange'
  | 'number'
  | 'notRevisable'
  | 'revising';
export type Fail = { ok: false; code: FailCode; field?: string; state?: string; allowed?: PlanQuoteOp[] };
/** 企画・見積の操作（FR-020）。confirm=確定、submit=提出、approve=承認、save=保存（改訂中からの復帰）、edit=変更 */
export type PlanQuoteOp = 'confirm' | 'submit' | 'approve' | 'save' | 'edit';
export type Ok<T = undefined> = { ok: true; value: T };
export type Result<T = undefined> = Ok<T> | Fail;

export const ok = <T = undefined>(value?: T): Ok<T> => ({ ok: true, value: value as T });
export const fail = (code: FailCode, field?: string): Fail => ({ ok: false, code, field });

export const errorKey = (code: FailCode): MessageKey => `app2.err.${code}` as MessageKey;

/** 順序つきの状態遷移の検証: 次の状態へ 1 つ進めるものだけを許す。逆戻り・飛び越し・同じ状態は拒否する */
export function checkTransition(flow: readonly string[], from: string, to: string): Result {
  const a = flow.indexOf(from);
  const b = flow.indexOf(to);
  if (a < 0 || b < 0) return fail('unknown');
  if (b === a) return fail('same');
  if (b < a) return fail('backward');
  if (b > a + 1) return fail('skip');
  return ok();
}
