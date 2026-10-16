// App2 の業務操作（FR-014・FR-016・FR-017・FR-019）。状態遷移の検証つきでデータセットを更新する。
// どの関数も、拒否したときはデータを変えずに { ok:false, code } を返す（画面は errorKey(code) で理由を出す）。
import { getDataset, getHistory, updateDataset } from './store';
import {
  ASSET_FLOW,
  DEPLOYMENT_STATES,
  ORDER_FLOW,
  PLAN_STATES,
  QUOTE_STATES,
  checkTransition,
  fail,
  ok,
  type Result,
} from './states';
import type { Asset, Dataset, Deployment, Order, VersionRecord } from './types';

/** 既存の ID の最大の連番 + 1 で、同じ接頭辞の新しい ID を作る（例: ast-31） */
export function nextId(prefix: string, rows: ReadonlyArray<{ id: string }>): string {
  let max = 0;
  for (const r of rows) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(r.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(2, '0')}`;
}

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ───────── FR-014 企画・見積の変更と版の履歴 ─────────

export type RevisableKind = 'plan' | 'quote';
export interface RevisionContent {
  title?: string;
  amount?: number;
}

const DRAFT = '下書き';
const REVISING = '改訂中';
const settledState = (kind: RevisableKind) => (kind === 'plan' ? PLAN_STATES.confirmed : QUOTE_STATES.submitted);

function findRevisable(data: Dataset, kind: RevisableKind, id: string) {
  return kind === 'plan' ? data.plans.find((p) => p.id === id) : data.quotes.find((q) => q.id === id);
}

function patchRevisable(d: Dataset, kind: RevisableKind, id: string, patch: Record<string, unknown>): Dataset {
  return kind === 'plan'
    ? { ...d, plans: d.plans.map((p) => (p.id === id ? { ...p, ...patch } : p)) }
    : { ...d, quotes: d.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) };
}

/** 変更を始める: 確定した企画・承認済みの見積などは「改訂中」になる。下書きはそのまま（下書きは改訂中を経ない） */
export function beginRevision(kind: RevisableKind, id: string): Result {
  const e = findRevisable(getDataset(), kind, id);
  if (!e) return fail('notFound');
  if (e.state === DRAFT || e.state === REVISING) return ok();
  updateDataset((d) => patchRevisable(d, kind, id, { state: REVISING, prevState: e.state }));
  return ok();
}

/** 変更を取り消す: 「改訂中」を始める前の状態に戻す。版は増えない */
export function cancelRevision(kind: RevisableKind, id: string): Result {
  const e = findRevisable(getDataset(), kind, id);
  if (!e) return fail('notFound');
  if (e.state !== REVISING) return ok();
  const back = e.prevState ?? settledState(kind);
  updateDataset((d) => patchRevisable(d, kind, id, { state: back, prevState: undefined }));
  return ok();
}

function latestVersion(kind: RevisableKind, id: string, current: number): number {
  return getHistory(id).reduce((m, r) => Math.max(m, r.version), current);
}

function commitRevision(
  kind: RevisableKind,
  id: string,
  content: RevisionContent,
  now: Date,
  restoredFrom?: number,
): Result<VersionRecord> {
  const d0 = getDataset();
  const e = findRevisable(d0, kind, id);
  if (!e) return fail('notFound');
  const changes: VersionRecord['changes'] = [];
  if (kind === 'plan' && content.title !== undefined) {
    if (blank(content.title)) return fail('required', 'title');
    const cur = (e as { title: string }).title;
    if (content.title !== cur) changes.push({ field: 'title', from: cur, to: content.title });
  }
  if (kind === 'quote' && content.amount !== undefined) {
    if (!Number.isFinite(content.amount) || content.amount <= 0) return fail('amount', 'amount');
    const cur = (e as { amount: number }).amount;
    if (content.amount !== cur) changes.push({ field: 'amount', from: cur, to: content.amount });
  }
  if (changes.length === 0) return fail('nochange');
  const from = e.state === REVISING ? (e.prevState ?? settledState(kind)) : e.state;
  const to = from === DRAFT ? DRAFT : settledState(kind);
  const states = from === DRAFT ? [DRAFT] : [from, REVISING, to];
  const version = latestVersion(kind, id, e.version) + 1;
  const record: VersionRecord = {
    entityId: id,
    kind,
    version,
    at: now.toISOString(),
    changes,
    ...(restoredFrom !== undefined ? { restoredFrom } : {}),
    states,
    snapshot: kind === 'plan' ? { title: content.title ?? (e as { title: string }).title } : { amount: content.amount ?? (e as { amount: number }).amount },
  };
  const patch: Record<string, unknown> = { version, state: to, prevState: undefined };
  for (const c of changes) patch[c.field] = c.to;
  updateDataset((d) => patchRevisable(d, kind, id, patch), [record]);
  return ok(record);
}

/** 変更を保存する: 新しい版が作られ、状態は「改訂中」を経て企画は「確定」・見積は「提出済み」に戻る（下書きは下書きのまま） */
export function saveRevision(kind: RevisableKind, id: string, content: RevisionContent, now: Date = new Date()): Result<VersionRecord> {
  return commitRevision(kind, id, content, now);
}

/** 旧版に戻す: その版の内容が新しい版として保存される。履歴は失われない */
export function restoreVersion(kind: RevisableKind, id: string, version: number, now: Date = new Date()): Result<VersionRecord> {
  const rec = getHistory(id).find((r) => r.version === version);
  if (!rec) return fail('notFound');
  return commitRevision(kind, id, rec.snapshot, now, version);
}

// ───────── FR-016 素材管理 ─────────

export interface AssetInput {
  name: string;
  type: string;
  tags: string | string[];
  projectId: string;
  imageUrl?: string | null;
}

export const parseTags = (tags: string | string[]): string[] =>
  (Array.isArray(tags) ? tags : tags.split(/[,、，\s]+/)).map((t) => t.trim()).filter(Boolean);

function checkAssetInput(d: Dataset, i: AssetInput): Result {
  if (blank(i.name)) return fail('required', 'name');
  if (blank(i.type)) return fail('required', 'type');
  if (blank(i.projectId) || !d.projects.some((p) => p.id === i.projectId)) return fail('required', 'project');
  return ok();
}

/** 素材を登録する（状態は「登録済」）。名前・種別・制作プロジェクトが必須。欠けていれば拒否し、データは変えない */
export function registerAsset(input: AssetInput): Result<Asset> {
  const d = getDataset();
  const bad = checkAssetInput(d, input);
  if (!bad.ok) return bad;
  const asset: Asset = {
    id: nextId('ast', d.assets),
    projectId: input.projectId,
    name: input.name.trim(),
    type: input.type,
    tags: parseTags(input.tags),
    imageUrl: input.imageUrl ? input.imageUrl : null,
    state: ASSET_FLOW[0],
    channelIds: [],
  };
  updateDataset((cur) => ({ ...cur, assets: [...cur.assets, asset] }));
  return ok(asset);
}

/** 素材のメタデータ（名前・種別・タグ・制作プロジェクト・画像の場所）を更新する */
export function updateAssetMetadata(id: string, input: AssetInput): Result<Asset> {
  const d = getDataset();
  const a = d.assets.find((x) => x.id === id);
  if (!a) return fail('notFound');
  const bad = checkAssetInput(d, input);
  if (!bad.ok) return bad;
  const next: Asset = { ...a, name: input.name.trim(), type: input.type, tags: parseTags(input.tags), projectId: input.projectId, imageUrl: input.imageUrl ? input.imageUrl : null };
  updateDataset((cur) => ({ ...cur, assets: cur.assets.map((x) => (x.id === id ? next : x)) }));
  return ok(next);
}

/** 素材をチャネルに紐付ける（すでに紐付いていれば何もしない） */
export function linkChannel(assetId: string, channelId: string): Result {
  const d = getDataset();
  const a = d.assets.find((x) => x.id === assetId);
  if (!a) return fail('notFound');
  if (blank(channelId)) return fail('required', 'channel');
  if (!d.channels.some((c) => c.id === channelId)) return fail('notFound');
  const cur = a.channelIds ?? [];
  if (cur.includes(channelId)) return ok();
  updateDataset((x) => ({ ...x, assets: x.assets.map((s) => (s.id === assetId ? { ...s, channelIds: [...cur, channelId] } : s)) }));
  return ok();
}

export function unlinkChannel(assetId: string, channelId: string): Result {
  const a = getDataset().assets.find((x) => x.id === assetId);
  if (!a) return fail('notFound');
  updateDataset((x) => ({ ...x, assets: x.assets.map((s) => (s.id === assetId ? { ...s, channelIds: (s.channelIds ?? []).filter((c) => c !== channelId) } : s)) }));
  return ok();
}

// ───────── FR-019 素材の展開と KPI・利用状況 ─────────

/** 素材の状態を 1 つ進める（登録済→承認済→展開中→アーカイブ）。逆戻り・飛び越しは拒否する */
export function transitionAsset(id: string, to: (typeof ASSET_FLOW)[number]): Result {
  const a = getDataset().assets.find((x) => x.id === id);
  if (!a) return fail('notFound');
  const r = checkTransition(ASSET_FLOW, a.state, to);
  if (!r.ok) return r;
  updateDataset((d) => ({ ...d, assets: d.assets.map((x) => (x.id === id ? { ...x, state: to } : x)) }));
  return ok();
}

export const approveAsset = (id: string): Result => transitionAsset(id, '承認済');

/** 承認済み（または展開中）の素材を、チャネルを選んで展開する。素材は「展開中」になり、展開（素材・チャネル・日付）が作られる */
export function deployAsset(assetId: string, channelId: string, now: Date = new Date()): Result<Deployment> {
  const d = getDataset();
  const a = d.assets.find((x) => x.id === assetId);
  if (!a) return fail('notFound');
  if (blank(channelId)) return fail('required', 'channel');
  if (!d.channels.some((c) => c.id === channelId)) return fail('notFound');
  if (a.state !== '展開中') {
    const r = checkTransition(ASSET_FLOW, a.state, '展開中');
    if (!r.ok) return r;
  }
  const dep: Deployment = { id: nextId('dpl', d.deployments), assetId, channelId, startDate: isoDay(now), state: DEPLOYMENT_STATES.active };
  updateDataset((cur) => ({
    ...cur,
    assets: cur.assets.map((x) => (x.id === assetId ? { ...x, state: '展開中' } : x)),
    deployments: [...cur.deployments, dep],
  }));
  return ok(dep);
}

/** 展開中の素材をアーカイブする。その素材の展開は「終了」になる */
export function archiveAsset(id: string): Result {
  const a = getDataset().assets.find((x) => x.id === id);
  if (!a) return fail('notFound');
  const r = checkTransition(ASSET_FLOW, a.state, 'アーカイブ');
  if (!r.ok) return r;
  updateDataset((d) => ({
    ...d,
    assets: d.assets.map((x) => (x.id === id ? { ...x, state: 'アーカイブ' } : x)),
    deployments: d.deployments.map((x) => (x.assetId === id && x.state === DEPLOYMENT_STATES.active ? { ...x, state: DEPLOYMENT_STATES.ended } : x)),
  }));
  return ok();
}

/** 展開の制作プロジェクトのキャンペーンに紐づく KPI */
export function kpisOfDeployment(d: Dataset, deploymentId: string | null) {
  const dep = d.deployments.find((x) => x.id === deploymentId);
  const asset = dep && d.assets.find((x) => x.id === dep.assetId);
  const project = asset && d.projects.find((x) => x.id === asset.projectId);
  return project ? d.kpis.filter((k) => k.campaignId === project.campaignId) : [];
}

export interface UsageInput {
  deploymentId: string;
  /** 対象の KPI。省略すると展開のキャンペーンの最初の KPI */
  kpiId?: string;
  /** 利用状況の値（KPI の現在値になる）。空なら更新しない */
  actual?: number | string | null;
  /** KPI の目標値。空なら更新しない */
  target?: number | string | null;
}

const num = (v: number | string | null | undefined): number | null | 'bad' => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 'bad';
};

/** 展開の利用状況（実績値）と KPI の目標値を登録・更新する。KPI の表示（FR-013）と関係図に反映され、保存される */
export function saveUsage(input: UsageInput): Result {
  const d = getDataset();
  const dep = d.deployments.find((x) => x.id === input.deploymentId);
  if (!dep) return fail('notFound');
  const actual = num(input.actual);
  const target = num(input.target);
  if (actual === 'bad') return fail('number', 'usage');
  if (target === 'bad') return fail('number', 'kpiTarget');
  if (actual === null && target === null) return fail('required', 'usage');
  const kpis = kpisOfDeployment(d, dep.id);
  const kpi = input.kpiId ? kpis.find((k) => k.id === input.kpiId) : kpis[0];
  if (!kpi) return fail('noKpi');
  updateDataset((cur) => {
    const existing = cur.usages.find((u) => u.deploymentId === dep.id);
    const usages =
      actual === null
        ? cur.usages
        : existing
          ? cur.usages.map((u) => (u === existing ? { ...u, actual } : u))
          : [...cur.usages, { id: nextId('use', cur.usages), deploymentId: dep.id, impressions: 0, clicks: 0, actual }];
    return {
      ...cur,
      usages,
      kpis: cur.kpis.map((k) => (k.id === kpi.id ? { ...k, ...(target !== null ? { target } : {}), ...(actual !== null ? { actual } : {}) } : k)),
    };
  });
  return ok();
}

// ───────── FR-017 外部発注の管理 ─────────

export interface OrderInput {
  projectId: string;
  vendorId: string;
  amount: number | string;
  dueDate: string;
}

const validDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return dt.getFullYear() === Number(m[1]) && dt.getMonth() === Number(m[2]) - 1 && dt.getDate() === Number(m[3]);
};

/** 発注を登録する（状態は「依頼前」）。発注先・制作プロジェクト・金額（0 より大きい）・納期（年-月-日）が必須 */
export function registerOrder(input: OrderInput): Result<Order> {
  const d = getDataset();
  if (blank(input.vendorId) || !d.vendors.some((v) => v.id === input.vendorId)) return fail('required', 'vendor');
  if (blank(input.projectId) || !d.projects.some((p) => p.id === input.projectId)) return fail('required', 'project');
  if (blank(input.amount)) return fail('required', 'amount');
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail('amount', 'amount');
  if (blank(input.dueDate)) return fail('required', 'due');
  if (!validDate(input.dueDate)) return fail('date', 'due');
  const order: Order = { id: nextId('ord', d.orders), projectId: input.projectId, vendorId: input.vendorId, amount, dueDate: input.dueDate, state: ORDER_FLOW[0] };
  updateDataset((cur) => ({ ...cur, orders: [...cur.orders, order] }));
  return ok(order);
}

/** 発注の状態を変える（依頼前→発注済→納品済→検収済）。逆戻り・飛び越しは拒否する */
export function setOrderState(id: string, to: (typeof ORDER_FLOW)[number]): Result {
  const o = getDataset().orders.find((x) => x.id === id);
  if (!o) return fail('notFound');
  const r = checkTransition(ORDER_FLOW, o.state, to);
  if (!r.ok) return r;
  updateDataset((d) => ({ ...d, orders: d.orders.map((x) => (x.id === id ? { ...x, state: to } : x)) }));
  return ok();
}

/** 発注の状態を 1 つ進める。最終状態（検収済）では拒否する */
export function advanceOrder(id: string): Result {
  const o = getDataset().orders.find((x) => x.id === id);
  if (!o) return fail('notFound');
  const i = ORDER_FLOW.indexOf(o.state as (typeof ORDER_FLOW)[number]);
  if (i < 0) return fail('unknown');
  if (i === ORDER_FLOW.length - 1) return fail('same');
  return setOrderState(id, ORDER_FLOW[i + 1]);
}

/** 最終状態か（それ以上進められない） */
export const isLastOrderState = (state: string) => state === ORDER_FLOW[ORDER_FLOW.length - 1];
export const isLastAssetState = (state: string) => state === ASSET_FLOW[ASSET_FLOW.length - 1];
