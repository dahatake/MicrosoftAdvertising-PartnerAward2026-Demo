// 素材管理（FR-016）: 登録・メタデータの編集・プレビュー・チャネルへの紐付け。
// 素材の展開・アーカイブと状態遷移（FR-019）も、同じ一覧の行から操作する（承認 → 展開 → アーカイブ）。
import { useState } from 'react';
import { Badge, Body1, Button, Caption1, Input, Label, makeStyles, tokens } from '@fluentui/react-components';
import { ChoiceButtons } from '../ui/ChoiceButtons';
import { Paged } from '../ui/Paged';
import { CheckmarkCircle16Filled } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { AssetThumb } from './AssetThumb';
import {
  approveAsset,
  archiveAsset,
  deployAsset,
  isLastAssetState,
  linkChannel,
  registerAsset,
  updateAssetMetadata,
} from './operations';
import { ASSET_FLOW, stateCode, stateKey } from './states';
import { useDataset } from './store';
import type { Asset } from './types';
import { ErrorText, useFailText } from './ui';

/** 素材の種別（シードの素材が使う種別） */
export const ASSET_TYPES = ['画像', '動画', 'バナー', 'テキスト'] as const;

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  fields: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', alignItems: 'start', gap: spacing.s },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.s },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.s,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  info: { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: '160px', flexGrow: 1 },
  ops: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  hint: { color: tokens.colorNeutralForeground2 },
  full: { flexBasis: '100%' },
});

function StateMark({ state }: { state: string }) {
  const t = useT();
  const key = stateKey(state);
  return (
    <Badge appearance="tint" color="informative" data-testid="asset-state" data-state={stateCode(state)}>
      {key ? t(key) : state}
    </Badge>
  );
}

function AssetRow({ asset, onError }: { asset: Asset; onError: (m: string | null) => void }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const failText = useFailText();
  const [linkTo, setLinkTo] = useState('');
  const [deployTo, setDeployTo] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [type, setType] = useState(asset.type);
  const [tags, setTags] = useState(asset.tags.join(','));
  const [projectId, setProjectId] = useState(asset.projectId);
  const [editError, setEditError] = useState<string | null>(null);
  const project = data.projects.find((p) => p.id === asset.projectId);
  const linked = (asset.channelIds ?? []).map((id) => data.channels.find((c) => c.id === id)?.name ?? id);
  const approved = ASSET_FLOW.indexOf(asset.state as (typeof ASSET_FLOW)[number]) >= 1;
  const act = (r: { ok: boolean }) => {
    onError(r.ok ? null : failText(r as never));
  };
  const save = () => {
    const r = updateAssetMetadata(asset.id, { name, type, tags, projectId, imageUrl: asset.imageUrl });
    if (!r.ok) return setEditError(failText(r));
    setEditError(null);
    setEditing(false);
  };
  const types = ASSET_TYPES.includes(asset.type as never) ? ASSET_TYPES : [...ASSET_TYPES, asset.type];
  return (
    <li className={s.row} data-testid="asset-row" data-entity-id={asset.id}>
      <span data-testid="asset-preview">
        <AssetThumb src={asset.imageUrl} alt={asset.name} compact />
      </span>
      <div className={s.info}>
        <Body1 data-testid="asset-name-text">
          <strong>{asset.name}</strong>
        </Body1>
        <Caption1>
          {asset.type}　{asset.tags.join('・')}　{project?.name ?? ''}
        </Caption1>
        <span className={s.ops}>
          <StateMark state={asset.state} />
          {approved && (
            <Badge appearance="outline" color="success" icon={<CheckmarkCircle16Filled />} data-testid="asset-approval" data-state="approved">
              {t('app2.approvedMark')}
            </Badge>
          )}
        </span>
        <Caption1 data-testid="asset-channels">
          {t('app2.linkedChannels')}: {linked.length ? linked.join('、') : t('app2.none')}
        </Caption1>
      </div>
      <div className={s.stack}>
        <span className={s.ops}>
          <ChoiceButtons
            label={t('app2.channel')}
            testId="asset-channel-select"
            value={linkTo}
            onChange={setLinkTo}
            options={data.channels.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button
            size="small"
            data-testid="asset-link-channel"
            onClick={() => {
              act(linkChannel(asset.id, linkTo));
              setLinkTo('');
            }}
          >
            {t('app2.linkChannel')}
          </Button>
        </span>
        <span className={s.ops}>
          <ChoiceButtons
            label={`${t('app2.deploy')}: ${t('app2.channel')}`}
            testId="asset-deploy-channel"
            value={deployTo}
            onChange={setDeployTo}
            options={data.channels.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Button size="small" data-testid="asset-deploy" disabled={isLastAssetState(asset.state)} onClick={() => act(deployAsset(asset.id, deployTo))}>
            {t('app2.deploy')}
          </Button>
        </span>
        <span className={s.ops}>
          <Button size="small" data-testid="asset-approve" disabled={isLastAssetState(asset.state)} onClick={() => act(approveAsset(asset.id))}>
            {t('app2.approve')}
          </Button>
          <Button size="small" data-testid="asset-archive" disabled={isLastAssetState(asset.state)} onClick={() => act(archiveAsset(asset.id))}>
            {t('app2.archive')}
          </Button>
          <Button size="small" data-testid="asset-edit" onClick={() => setEditing((v) => !v)}>
            {t('app2.edit')}
          </Button>
        </span>
      </div>
      {editing && (
        <div className={`${s.fields} ${s.full}`}>
          <Input aria-label={t('app2.col.name')} value={name} onChange={(_, d) => setName(d.value)} input={{ 'data-testid': 'asset-edit-name' } as object} />
          <ChoiceButtons
            label={t('app2.type')}
            testId="asset-edit-type"
            value={type}
            onChange={setType}
            options={types.map((x) => ({ value: x, label: x }))}
          />
          <Input aria-label={t('app2.tags')} value={tags} onChange={(_, d) => setTags(d.value)} input={{ 'data-testid': 'asset-edit-tags' } as object} />
          <ChoiceButtons
            label={t('app2.projects')}
            testId="asset-edit-project"
            value={projectId}
            onChange={setProjectId}
            options={data.projects.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button appearance="primary" onClick={save} data-testid="asset-edit-save">
            {t('app2.save')}
          </Button>
          <ErrorText message={editError} testId="asset-edit-error" />
        </div>
      )}
    </li>
  );
}

/** part: 'form'=登録フォームだけ、'list'=絞り込みと一覧だけ、'all'=両方（既定）。App2 は 1 画面に収めるため 2 つのパネルに分ける */
export function AssetPanel({
  filter: filterProp,
  onFilter,
  part = 'all',
  pageSize = 1000,
}: { filter?: string; onFilter?: (v: string) => void; part?: 'all' | 'form' | 'list'; pageSize?: number } = {}) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const failText = useFailText();
  // 絞り込みは呼び出し側（App2）が持てば、領域を切り替えても保たれる（FR-025 AC-104）
  const [ownFilter, setOwnFilter] = useState('');
  const filter = filterProp ?? ownFilter;
  const setFilter = onFilter ?? setOwnFilter;
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [tags, setTags] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);

  const register = () => {
    const r = registerAsset({ name, type, tags, projectId });
    if (!r.ok) return setError(failText(r)); // 入力済みの内容は残す
    setError(null);
    setName('');
    setType('');
    setTags('');
    setProjectId('');
  };

  const q = filter.trim().toLowerCase();
  const shown = q ? data.assets.filter((a) => [a.name, a.type, ...a.tags].some((x) => x.toLowerCase().includes(q))) : data.assets;

  return (
    <div className={s.stack}>
      {part !== 'form' && <Input aria-label={t('app2.assetFilter')} placeholder={t('app2.assetFilter')} value={filter} onChange={(_, d) => setFilter(d.value)} input={{ 'data-testid': 'asset-filter' } as object} />}
      {part !== 'list' && (<>
      <div className={s.fields} data-testid="asset-form">
        <div className={s.field}>
          <Label htmlFor="asset-name-input">{t('app2.col.name')}</Label>
          <Input id="asset-name-input" value={name} onChange={(_, d) => setName(d.value)} input={{ 'data-testid': 'asset-name' } as object} />
        </div>
        <div className={s.field}>
          <Label>{t('app2.type')}</Label>
          <ChoiceButtons
            label={t('app2.type')}
            testId="asset-type"
            value={type}
            onChange={setType}
            options={ASSET_TYPES.map((x) => ({ value: x, label: x }))}
          />
        </div>
        <div className={s.field}>
          <Label htmlFor="asset-tags-input">{t('app2.tags')}</Label>
          <Input id="asset-tags-input" value={tags} onChange={(_, d) => setTags(d.value)} input={{ 'data-testid': 'asset-tags' } as object} />
        </div>
        <div className={s.field}>
          <Label>{t('app2.projects')}</Label>
          <ChoiceButtons
            label={t('app2.projects')}
            testId="asset-project"
            pageSize={3}
            value={projectId}
            onChange={setProjectId}
            options={data.projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
        <Button appearance="primary" onClick={register} data-testid="asset-register">
          {t('app2.register')}
        </Button>
      </div>
      <ErrorText message={error} testId="asset-error" />
      </>)}
      {part !== 'form' && (<>
      <ErrorText message={opError} testId="asset-op-error" />
      {shown.length === 0 && <Body1 className={s.hint}>{t('app2.none')}</Body1>}
      <Paged items={shown} pageSize={pageSize} testId="asset">{(vis) => (
      <ul className={s.list} data-testid="asset-list" aria-label={t('app2.assets')}>
        {vis.map((a) => (
          <AssetRow key={a.id} asset={a} onError={setOpError} />
        ))}
      </ul>
      )}</Paged>
      </>)}
    </div>
  );
}
