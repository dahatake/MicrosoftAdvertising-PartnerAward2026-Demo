// 素材管理（FR-016）: 登録・メタデータの編集・プレビュー・チャネルへの紐付け。
// 素材の展開・アーカイブと状態遷移（FR-019）も、同じ一覧の行から操作する（承認 → 展開 → アーカイブ）。
import { useState } from 'react';
import { Badge, Body1, Button, Caption1, Input, Label, Select, makeStyles, tokens } from '@fluentui/react-components';
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
  fields: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.m },
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
        <AssetThumb src={asset.imageUrl} alt={asset.name} />
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
          <Select
            aria-label={t('app2.channel')}
            value={linkTo}
            onChange={(_, d) => setLinkTo(d.value)}
            select={{ 'data-testid': 'asset-channel-select' } as object}
          >
            <option value="">{t('app2.select')}</option>
            {data.channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <Select
            aria-label={`${t('app2.deploy')}: ${t('app2.channel')}`}
            value={deployTo}
            onChange={(_, d) => setDeployTo(d.value)}
            select={{ 'data-testid': 'asset-deploy-channel' } as object}
          >
            <option value="">{t('app2.select')}</option>
            {data.channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
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
          <Select aria-label={t('app2.type')} value={type} onChange={(_, d) => setType(d.value)} select={{ 'data-testid': 'asset-edit-type' } as object}>
            {types.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Input aria-label={t('app2.tags')} value={tags} onChange={(_, d) => setTags(d.value)} input={{ 'data-testid': 'asset-edit-tags' } as object} />
          <Select aria-label={t('app2.projects')} value={projectId} onChange={(_, d) => setProjectId(d.value)} select={{ 'data-testid': 'asset-edit-project' } as object}>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Button appearance="primary" onClick={save} data-testid="asset-edit-save">
            {t('app2.save')}
          </Button>
          <ErrorText message={editError} testId="asset-edit-error" />
        </div>
      )}
    </li>
  );
}

export function AssetPanel() {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const failText = useFailText();
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

  return (
    <div className={s.stack}>
      <div className={s.fields} data-testid="asset-form">
        <div className={s.field}>
          <Label htmlFor="asset-name-input">{t('app2.col.name')}</Label>
          <Input id="asset-name-input" value={name} onChange={(_, d) => setName(d.value)} input={{ 'data-testid': 'asset-name' } as object} />
        </div>
        <div className={s.field}>
          <Label htmlFor="asset-type-input">{t('app2.type')}</Label>
          <Select id="asset-type-input" value={type} onChange={(_, d) => setType(d.value)} select={{ 'data-testid': 'asset-type' } as object}>
            <option value="">{t('app2.select')}</option>
            {ASSET_TYPES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </div>
        <div className={s.field}>
          <Label htmlFor="asset-tags-input">{t('app2.tags')}</Label>
          <Input id="asset-tags-input" value={tags} onChange={(_, d) => setTags(d.value)} input={{ 'data-testid': 'asset-tags' } as object} />
        </div>
        <div className={s.field}>
          <Label htmlFor="asset-project-input">{t('app2.projects')}</Label>
          <Select id="asset-project-input" value={projectId} onChange={(_, d) => setProjectId(d.value)} select={{ 'data-testid': 'asset-project' } as object}>
            <option value="">{t('app2.select')}</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Button appearance="primary" onClick={register} data-testid="asset-register">
          {t('app2.register')}
        </Button>
      </div>
      <ErrorText message={error} testId="asset-error" />
      <ErrorText message={opError} testId="asset-op-error" />
      {data.assets.length === 0 && <Body1 className={s.hint}>{t('app2.none')}</Body1>}
      <ul className={s.list} data-testid="asset-list" aria-label={t('app2.assets')}>
        {data.assets.map((a) => (
          <AssetRow key={a.id} asset={a} onError={setOpError} />
        ))}
      </ul>
    </div>
  );
}
