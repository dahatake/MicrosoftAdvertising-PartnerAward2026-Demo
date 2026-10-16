import { useState } from 'react';
import { Body1, Input, Title2 } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { Workspace } from '../layout';
import { DualView } from '../view';
import {
  CampaignList,
  CampaignRelationPanel,
  DEFAULT_REPRESENTATION,
  PersonaBar,
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

export function App2() {
  const t = useT();
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
    <section data-testid="app-root-app2" aria-labelledby="app2-heading">
      <Title2 as="h2" id="app2-heading">
        {t('app2.heading')}
      </Title2>
      <p>
        <Body1>{t('app2.lead')}</Body1>
      </p>
      <PersonaBar persona={persona} representation={representation} onPersona={onPersona} onRepresentation={setRepresentation} />
      <CameraSettings />
      <Workspace
        screenId="app2"
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
        ]}
      />
    </section>
  );
}
