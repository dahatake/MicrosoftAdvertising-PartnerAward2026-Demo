// App2（広告素材管理）の画面: 左のメニュー（業務ワークフロー順。FR-025）と、選んだ業務領域の画面 1 つ（1 画面収容。FR-024）。
// 業務領域ごとにパネルを割り当て、ペルソナ（FR-018・FR-021）に応じた既定のレイアウトで Workspace に並べる（Q-006 A）。
// 選択中の対象・絞り込み・入力中の内容は、領域を切り替えても失われないよう、ここで持つ。
import { useEffect, useState, type ReactNode } from 'react';
import { Input, makeStyles } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { Workspace, type WorkspacePanel } from '../layout';
import { spacing } from '../theme/theme';
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

const useStyles = makeStyles({
  root: { display: 'flex', gap: spacing.m, alignItems: 'flex-start' },
  main: { display: 'flex', flexDirection: 'column', gap: spacing.s, flexGrow: 1, minWidth: 0 },
});

/** 領域のペルソナ別の既定のレイアウト */
const layoutsOf = (area: AreaKey) => Object.fromEntries((Object.keys(AREA_LAYOUT) as PersonaId[]).map((p) => [p, AREA_LAYOUT[p][area]]));

export function App2() {
  const s = useStyles();
  const t = useT();
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
    <section data-testid="app-root-app2" aria-label={t('app2.heading')} className={s.root}>
      <SideNav current={area} onSelect={setArea} />
      <div className={s.main}>
        <PersonaBar persona={persona} representation={representation} onPersona={onPersona} onRepresentation={setRepresentation} />
        <CameraSettings />
        <div data-testid={`area-root-${area}`} data-area={area} role="region" aria-label={t(areaLabelKey(area))}>
          <Workspace key={area} screenId={`app2-${area}`} persona={persona} personaDefaults={layoutsOf(area)} panels={panels} dense />
        </div>
      </div>
    </section>
  );
}
