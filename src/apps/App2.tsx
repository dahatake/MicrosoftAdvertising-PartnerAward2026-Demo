import { useState } from 'react';
import { Body1, Input, Title2, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { useBrandStyles } from '../theme/BrandButton';
import { brandCardStyle, brandTokens, spacing } from '../theme/theme';
import { Workspace } from '../layout';
import { DualView } from '../view';
import {
  CampaignList,
  CampaignRelationPanel,
  AssetPanel,
  DeploymentPanel,
  OrderPanel,
  PlanQuotePanel,
  DEFAULT_REPRESENTATION,
  PersonaBar,
  PERSONA_LAYOUT,
  ProjectDetail,
  ProjectList,
  RepresentationPanel,
  WhatIfPanel,
  setPersona,
  useDataset,
  usePersona,
  type PersonaId,
  type Representation,
} from '../app2';
import { CameraSettings } from '../camera';

// 後続の項目（App2）が、パネルの中身を実際の画面に置き換える。ここは共通の Workspace・DualView の使い方の最小の例。
const KINDS = [
  { id: 'k1', label: 'A' },
  { id: 'k2', label: 'B' },
];
const ITEMS = [
  { id: 'i1', label: 'A-1', kind: 'k1', group: 'G1' },
  { id: 'i2', label: 'B-1', kind: 'k2', group: 'G1' },
  { id: 'i3', label: 'A-2', kind: 'k1', group: 'G2' },
];

// NFR-UX-004 AC-093: App2 は業務画面として、情報密度と操作性を保ったままブランドの形を使う。
// - ページの面: ライトのテーマは PARAM-021（brandTokens.surfacePage）、ダークはテーマの面。
// - ページの見出し帯: 暗い面（PARAM-022）に光のグラデーション（PARAM-023）を重ねた帯（useBrandStyles().glowBand。テーマによらない）。
//   全幅のヒーローにしない（高さは見出しと 1 行の説明の分だけ）。装飾の出現アニメーション（入場の動き）を付けない。
// - パネル: Workspace の各パネル（共通部品の section）を、App2 の中でだけ角丸 PARAM-024（brandCardStyle）・影のカードにする。
const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m, minWidth: 0 },
  band: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    padding: `${spacing.m} ${spacing.l}`,
    borderRadius: brandTokens.radiusCard,
    // 業務画面の見出し帯: 高さは中身の分だけ（ヒーローにしない）
    minHeight: 0,
  },
  heading: { margin: 0, color: brandTokens.foregroundOnDark },
  lead: { margin: 0, color: brandTokens.foregroundOnDarkMuted },
  // 共通の Workspace のパネルを、App2 の中でだけブランドのカードの形にする（属性の選択子は Workspace の data-testid の契約）
  workspace: {
    '& [data-testid^="layout-panel-"]': {
      borderRadius: brandCardStyle.borderRadius,
      boxShadow: brandCardStyle.boxShadow,
      backgroundColor: tokens.colorNeutralBackground1,
    },
  },
});

export function App2() {
  const t = useT();
  const s = useStyles();
  const b = useBrandStyles();
  const [selected, setSelected] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const persona = usePersona();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [representation, setRepresentation] = useState<Representation>(DEFAULT_REPRESENTATION[persona]);
  const data = useDataset();
  // ペルソナを選ぶと、そのペルソナの既定の表現になる。選択中の対象（キャンペーン・プロジェクト）は保つ
  const onPersona = (p: PersonaId) => {
    setPersona(p);
    setRepresentation(DEFAULT_REPRESENTATION[p]);
  };
  const projectCampaign = data.projects.find((p) => p.id === projectId)?.campaignId ?? null;
  return (
    <section data-testid="app-root-app2" aria-labelledby="app2-heading" className={mergeClasses(s.root, b.pageSurface)}>
      <div data-testid="app2-heading-band" className={mergeClasses(b.glowBand, s.band)}>
        <Title2 as="h2" id="app2-heading" className={s.heading}>
          {t('app2.heading')}
        </Title2>
        <p className={s.lead}>
          <Body1>{t('app2.lead')}</Body1>
        </p>
      </div>
      <PersonaBar persona={persona} representation={representation} onPersona={onPersona} onRepresentation={setRepresentation} />
      <CameraSettings />
      <div className={s.workspace}>
        <Workspace
          screenId="app2"
          persona={persona}
          personaDefaults={PERSONA_LAYOUT}
          panels={[
            {
              id: '1',
              title: t('app2.memo'),
              content: <Input aria-label={t('app2.memo')} input={{ 'data-testid': 'panel-input' } as object} />,
            },
            {
              id: '2',
              title: t('view.items'),
              content: <DualView items={ITEMS} kinds={KINDS} selectedId={selected} onSelect={setSelected} />,
            },
            {
              id: '3',
              title: t('app2.campaigns'),
              content: (
                <CampaignList
                  selectedId={campaignId}
                  onSelect={(id) => {
                    setCampaignId(id);
                    setNodeId(null);
                  }}
                />
              ),
            },
            {
              id: '4',
              title: t('app2.relation'),
              content: <CampaignRelationPanel campaignId={campaignId} selectedId={nodeId} onSelectNode={setNodeId} />,
            },
            {
              id: '5',
              title: t('app2.projects'),
              content: (
                <>
                  <ProjectList selectedId={projectId} onSelect={setProjectId} />
                  <ProjectDetail projectId={projectId} />
                </>
              ),
            },
            { id: '6', title: t('app2.whatif'), content: <WhatIfPanel projectId={projectId} /> },
            {
              id: '7',
              title: t('app2.representation'),
              content: <RepresentationPanel representation={representation} campaignId={campaignId ?? projectCampaign} />,
            },
            { id: '8', title: t('app2.planquote'), content: <PlanQuotePanel /> },
            { id: '9', title: t('app2.assets'), content: <AssetPanel /> },
            { id: '10', title: t('app2.deployments'), content: <DeploymentPanel /> },
            { id: '11', title: t('app2.orders'), content: <OrderPanel projectId={projectId} /> },
          ]}
        />
      </div>
    </section>
  );
}
