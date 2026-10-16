import type { MessageKey } from '../i18n';
import type { EntityKind } from './types';

/** 関係図・凡例での種類の並び（色と形はこの順で決まり、2D/3D で共通） */
export const KIND_ORDER: readonly EntityKind[] = [
  'customer',
  'campaign',
  'plan',
  'quote',
  'project',
  'vendor',
  'order',
  'asset',
  'channel',
  'deployment',
  'kpi',
  'usage',
];

export const kindLabelKey = (k: EntityKind): MessageKey => `app2.kind.${k}` as MessageKey;
