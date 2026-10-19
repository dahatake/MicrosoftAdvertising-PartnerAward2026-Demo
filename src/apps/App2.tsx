// App2（広告素材管理）の画面: 左のメニュー（業務ワークフロー順。FR-025）と、選んだ業務領域の画面 1 つ（1 画面収容。FR-024）。
// 業務領域ごとにパネルを割り当て、ペルソナ（FR-018・FR-021）に応じた既定のレイアウトで Workspace に並べる（Q-006 A）。
// 選択中の対象・絞り込み・入力中の内容は、領域を切り替えても失われないよう、ここで持つ。
import { useEffect, useState, type ReactNode } from 'react';
import { Caption1, Input, Subtitle1, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { useBrandStyles } from '../theme/BrandButton';
import { brandCardStyle, brandTokens, spacing } from '../theme/theme';
import { Workspace, type WorkspacePanel } from '../layout';
import {
  AREA_HASH_PREFIX,
  AREA_LAYOUT,
  AREA_PANELS,
  areaFromHash,
  areaLabelKey,
  type AreaKey,
  CampaignList,
  CampaignRelationPanel,
  AssetPanel,
  DeploymentPanel,
  OrderPanel,
  PlanQuotePanel,
  DEFAULT_REPRESENTATION,
  PersonaBar,
  ProjectDetail,
  ProjectList,
  RealAssets,
  RepresentationPanel,
  SideNav,
  WhatIfPanel,
  setPersona,
  useDataset,
  usePersona,
  type PersonaId,
  type Representation,
} from '../app2';
import { CameraSettings } from '../camera';

/** 領域のペルソナ別の既定のレイアウト */
const layoutsOf = (area: AreaKey) => Object.fromEntries((Object.keys(AREA_LAYOUT) as PersonaId[]).map((p) => [p, AREA_LAYOUT[p][area]]));

// NFR-UX-004 AC-093: App2 は業務画面として、情報密度と操作性を保ったままブランドの形を使う。
// - ページの面: ライトのテーマは PARAM-021（brandTokens.surfacePage）、ダークはテーマの面。
// - ページの見出し帯: 暗い面（PARAM-022）に光のグラデーション（PARAM-023）を重ねた帯（useBrandStyles().glowBand。テーマによらない）。
//   全幅のヒーローにしない（高さは見出しと説明の分だけ）。1 画面収容（FR-024 AC-098）のため、左の列（メニューの上）に置く。
//   装飾の出現アニメーション（入場の動き）を付けない。
// - パネル: Workspace の各パネル（共通部品の section）を、App2 の中でだけ角丸 PARAM-024（brandCardStyle）・影のカードにする。
const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 },
  band: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    padding: `${spacing.s} ${spacing.m}`,
    borderRadius: brandTokens.radiusCard,
    // 業務画面の見出し帯: 高さは中身の分だけ（ヒーローにしない）
    minHeight: 0,
  },
  heading: { margin: 0, color: brandTokens.foregroundOnDark },
  lead: { margin: 0, minWidth: 0, color: brandTokens.foregroundOnDarkMuted },
  // 狭い画面（幅 640px 以下）では、左の列を業務領域の画面の上に積み、横に詰め込まない（横スクロールを強いない）
  side: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s,
    width: '176px',
    flexShrink: 0,
    minWidth: 0,
    '@media (max-width: 640px)': { width: '100%' },
  },
  body: {
    display: 'flex',
    gap: spacing.m,
    alignItems: 'flex-start',
    minWidth: 0,
    '@media (max-width: 640px)': { flexDirection: 'column', alignItems: 'stretch' },
  },
  main: { display: 'flex', flexDirection: 'column', gap: spacing.xs, flexGrow: 1, minWidth: 0 },
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
  const s = useStyles();
  const t = useT();
  const b = useBrandStyles();
  const persona = usePersona();
  const data = useDataset();
  const [area, setAreaState] = useState<AreaKey>(() => areaFromHash(window.location.hash));
  const [memo, setMemo] = useState('');
  const [assetFilter, setAssetFilter] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [representation, setRepresentation] = useState<Representation>(DEFAULT_REPRESENTATION[persona]);

  // メニューの選択はアドレス（ハッシュ）と同期する。不正な指定は既定の領域に戻す（エラー画面にしない）
  useEffect(() => {
    const onHash = () => setAreaState(areaFromHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const setArea = (a: AreaKey) => {
    setAreaState(a);
    if (window.location.hash !== `${AREA_HASH_PREFIX}${a}`) window.location.hash = `${AREA_HASH_PREFIX}${a}`;
  };

  // ペルソナを選ぶと、そのペルソナの既定の表現になる。選択中の対象（キャンペーン・プロジェクト）は保つ
  const onPersona = (p: PersonaId) => {
    setPersona(p);
    setRepresentation(DEFAULT_REPRESENTATION[p]);
  };
  const projectCampaign = data.projects.find((p) => p.id === projectId)?.campaignId ?? null;

  const content: Record<string, { title: string; node: ReactNode }> = {
    m: {
      title: t('app2.memo'),
      node: <Input aria-label={t('app2.memo')} style={{ width: '100%', minWidth: 0 }} value={memo} onChange={(_, d) => setMemo(d.value)} input={{ 'data-testid': 'panel-input' } as object} />,
    },
    c: {
      title: t('app2.campaigns'),
      node: (
        <CampaignList
          selectedId={campaignId}
          onSelect={(id) => {
            setCampaignId(id);
            setNodeId(null);
          }}
        />
      ),
    },
    r: { title: t('app2.relation'), node: <CampaignRelationPanel campaignId={campaignId} selectedId={nodeId} onSelectNode={setNodeId} /> },
    p: {
      title: t('app2.projects'),
      node: (
        <>
          <ProjectList selectedId={projectId} onSelect={setProjectId} />
          <ProjectDetail projectId={projectId} />
        </>
      ),
    },
    g: { title: t('app2.representation'), node: <RepresentationPanel representation={representation} campaignId={campaignId ?? projectCampaign} /> },
    w: { title: t('app2.whatif'), node: <WhatIfPanel projectId={projectId} /> },
    pl: { title: t('app2.plans'), node: <PlanQuotePanel kind="plan" /> },
    q: { title: t('app2.quotes'), node: <PlanQuotePanel kind="quote" /> },
    a: { title: t('app2.assets'), node: <AssetPanel part="list" pageSize={1} filter={assetFilter} onFilter={setAssetFilter} /> },
    f: { title: t('app2.register'), node: <AssetPanel part="form" /> },
    x: { title: t('app2.real.title'), node: <RealAssets /> },
    o: { title: t('app2.orders'), node: <OrderPanel projectId={projectId} pageSize={3} /> },
    d: { title: t('app2.deployments'), node: <DeploymentPanel mode="deploy" /> },
    u: { title: t('app2.usage'), node: <DeploymentPanel mode="usage" /> },
  };
  const panels: WorkspacePanel[] = AREA_PANELS[area].map((id) => ({ id, title: content[id].title, content: content[id].node }));

  return (
    <section data-testid="app-root-app2" aria-labelledby="app2-heading" className={mergeClasses(s.root, b.pageSurface)}>
      <div className={s.body}>
        {/* 左の列: ページの見出し帯と、業務ワークフロー順のメニュー（FR-025）。見出し帯をこの列に置き、
            業務領域の画面の高さを減らさない（FR-024 AC-098 の 1 画面収容） */}
        <div className={s.side}>
          <div data-testid="app2-heading-band" className={mergeClasses(b.glowBand, s.band)}>
            <Subtitle1 as="h2" id="app2-heading" className={s.heading}>
              {t('app2.heading')}
            </Subtitle1>
            <p className={s.lead}>
              <Caption1>{t('app2.lead')}</Caption1>
            </p>
          </div>
          <SideNav current={area} onSelect={setArea} />
        </div>
        <div className={s.main}>
          <PersonaBar persona={persona} representation={representation} onPersona={onPersona} onRepresentation={setRepresentation} />
          <CameraSettings />
          <div data-testid={`area-root-${area}`} data-area={area} role="region" aria-label={t(areaLabelKey(area))} className={s.workspace}>
            <Workspace key={area} screenId={`app2-${area}`} persona={persona} personaDefaults={layoutsOf(area)} panels={panels} dense />
          </div>
        </div>
      </div>
    </section>
  );
}
