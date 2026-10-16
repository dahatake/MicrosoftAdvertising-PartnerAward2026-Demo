// App2 のデータモデル（FR-011）。エンティティの種類・属性・参照関係をここで決める。
// 参照: 発注 → 制作プロジェクト → キャンペーン → 顧客、素材 → 制作プロジェクト、展開 → 素材・チャネル、利用状況 → 展開。

export interface Organization {
  id: string;
  name: string;
}
export interface Customer {
  id: string;
  name: string;
  industry: string;
}
export interface Campaign {
  id: string;
  customerId: string;
  name: string;
  product: string;
  startDate: string;
  endDate: string;
  /** 予算（円） */
  budget: number;
  status: string;
}
export interface Plan {
  id: string;
  campaignId: string;
  title: string;
  version: number;
  state: string;
}
export interface Quote {
  id: string;
  planId: string;
  campaignId: string;
  /** 金額（円） */
  amount: number;
  version: number;
  state: string;
}
export interface Project {
  id: string;
  campaignId: string;
  name: string;
  progressPercent: number;
  status: string;
  /** 予算（円）と消化額（円） */
  budget: number;
  spent: number;
  dueDate: string;
  deliverables: string[];
}
export interface Vendor {
  id: string;
  name: string;
  category: string;
}
export interface Order {
  id: string;
  projectId: string;
  vendorId: string;
  amount: number;
  dueDate: string;
  state: string;
}
export interface Asset {
  id: string;
  projectId: string;
  name: string;
  type: string;
  tags: string[];
  /** 画像・動画の場所。無いときは仮置き（AssetThumb が表示する） */
  imageUrl: string | null;
  state: string;
}
export interface Channel {
  id: string;
  name: string;
}
export interface Deployment {
  id: string;
  assetId: string;
  channelId: string;
  startDate: string;
  state: string;
}
export interface Kpi {
  id: string;
  campaignId: string;
  metric: string;
  unit: string;
  target: number;
  actual: number;
}
export interface Usage {
  id: string;
  deploymentId: string;
  impressions: number;
  clicks: number;
}

/** データセット全体（シード JSON と localStorage 保存の形） */
export interface Dataset {
  organization: Organization;
  customers: Customer[];
  campaigns: Campaign[];
  plans: Plan[];
  quotes: Quote[];
  projects: Project[];
  vendors: Vendor[];
  orders: Order[];
  assets: Asset[];
  channels: Channel[];
  deployments: Deployment[];
  kpis: Kpi[];
  usages: Usage[];
}

/** コレクション（配列）になっているエンティティの種類 */
export type CollectionKey = Exclude<keyof Dataset, 'organization'>;
export const COLLECTIONS: readonly CollectionKey[] = [
  'customers',
  'campaigns',
  'plans',
  'quotes',
  'projects',
  'vendors',
  'orders',
  'assets',
  'channels',
  'deployments',
  'kpis',
  'usages',
];

/** エンティティの種類（関係図・詳細の kind）。コレクション名の単数形 */
export type EntityKind =
  | 'customer'
  | 'campaign'
  | 'plan'
  | 'quote'
  | 'project'
  | 'vendor'
  | 'order'
  | 'asset'
  | 'channel'
  | 'deployment'
  | 'kpi'
  | 'usage';

export const KIND_OF: Record<CollectionKey, EntityKind> = {
  customers: 'customer',
  campaigns: 'campaign',
  plans: 'plan',
  quotes: 'quote',
  projects: 'project',
  vendors: 'vendor',
  orders: 'order',
  assets: 'asset',
  channels: 'channel',
  deployments: 'deployment',
  kpis: 'kpi',
  usages: 'usage',
};

export type Entity = Dataset[CollectionKey][number];
