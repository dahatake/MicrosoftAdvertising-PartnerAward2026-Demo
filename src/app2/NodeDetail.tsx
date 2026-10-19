// 選択したノード（エンティティ）の詳細（FR-012 AC-041）。素材は画像の仮置きも表示する（AC-040）。
import { Body1, Caption1, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { brandTokens, spacing } from '../theme/theme';
import { AssetThumb } from './AssetThumb';
import { kindLabelKey } from './kinds';
import { entityLabel } from './relations';
import { findEntity } from './store';
import type { Asset, Dataset } from './types';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s,
    padding: spacing.m,
    // NFR-UX-004 AC-093: カード（一覧の行・詳細）の角丸は PARAM-024 の範囲
    borderRadius: brandTokens.radiusCard,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  list: { display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: spacing.m, rowGap: spacing.xs, margin: 0 },
  term: { color: tokens.colorNeutralForeground2 },
  desc: { margin: 0, overflowWrap: 'anywhere' },
});

const show = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '-' : String(v));

export function NodeDetail({ data, entityId }: { data: Dataset; entityId: string | null | undefined }) {
  const s = useStyles();
  const t = useT();
  const found = entityId ? findEntity(data, entityId) : null;
  if (!found) {
    return (
      <div className={s.root} data-testid="node-detail-empty">
        <Caption1>{t('app2.selectNode')}</Caption1>
      </div>
    );
  }
  const rec = found.entity as unknown as Record<string, unknown>;
  return (
    <section className={s.root} aria-label={t('app2.detail')} data-testid="node-detail" data-entity-id={String(rec.id)}>
      <Caption1>{t(kindLabelKey(found.kind))}</Caption1>
      <Subtitle2 as="h3">{entityLabel(found.kind, found.entity)}</Subtitle2>
      {found.kind === 'asset' && <AssetThumb src={(found.entity as Asset).imageUrl} alt={(found.entity as Asset).name} />}
      <dl className={s.list}>
        {Object.entries(rec)
          .filter(([k]) => k !== 'imageUrl')
          .map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt className={s.term}>
                <Caption1>{k}</Caption1>
              </dt>
              <dd className={s.desc}>
                <Body1>{show(v)}</Body1>
              </dd>
            </div>
          ))}
      </dl>
    </section>
  );
}
