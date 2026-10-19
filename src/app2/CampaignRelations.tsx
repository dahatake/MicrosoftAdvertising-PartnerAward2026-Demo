// キャンペーンの一覧と、選択したキャンペーンの関係図・ノードの詳細（FR-012）。App2 の画面のパネルとして置く。
import { useState } from 'react';
import { Body1, Button, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { Paged } from '../ui/Paged';
import { spacing } from '../theme/theme';
import { NodeDetail } from './NodeDetail';
import { RelationView } from './RelationView';
import { buildRelations } from './relations';
import { useDataset } from './store';

const useStyles = makeStyles({
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs },
  item: { justifyContent: 'flex-start', textAlign: 'start', minHeight: '32px', width: '100%' },
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  hint: { color: tokens.colorNeutralForeground2 },
});

export function CampaignList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  return (
    <Paged items={data.campaigns} pageSize={4} testId="campaign">{(vis) => (
    <ul className={s.list} data-testid="campaign-list" aria-label={t('app2.campaigns')}>
      {vis.map((c) => (
        <li key={c.id}>
          <Button
            className={s.item}
            appearance={c.id === selectedId ? 'primary' : 'subtle'}
            aria-pressed={c.id === selectedId}
            data-testid="campaign-item"
            data-campaign-id={c.id}
            onClick={() => onSelect(c.id)}
          >
            {c.name}
          </Button>
        </li>
      ))}
    </ul>
    )}</Paged>
  );
}

/** 関係図と詳細。campaignId と selectedId は呼び出し側が持つ */
export function CampaignRelationPanel({
  campaignId,
  selectedId,
  onSelectNode,
}: {
  campaignId: string | null;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const relations = buildRelations(data, campaignId);
  const effectiveSelected = relations.nodes.some((n) => n.id === selectedId) ? selectedId : null;
  if (!campaignId) {
    return <Body1 className={s.hint}>{t('app2.selectCampaign')}</Body1>;
  }
  return (
    <div className={s.stack}>
      <Subtitle2 as="h3">{t('app2.relation')}</Subtitle2>
      <RelationView relations={relations} selectedId={effectiveSelected} onSelect={onSelectNode} />
      <NodeDetail data={data} entityId={effectiveSelected} />
    </div>
  );
}

/** キャンペーンの選択状態を持つ、一覧＋関係図の部品（パネルを分けたい画面は CampaignList / CampaignRelationPanel を使う） */
export function CampaignRelations() {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.m }}>
      <CampaignList
        selectedId={campaignId}
        onSelect={(id) => {
          setCampaignId(id);
          setNodeId(null);
        }}
      />
      <CampaignRelationPanel campaignId={campaignId} selectedId={nodeId} onSelectNode={setNodeId} />
    </div>
  );
}
