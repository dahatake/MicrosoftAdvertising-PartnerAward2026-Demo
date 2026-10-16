// KPI の what-if 試算パネル（FR-015）。前提（予算・チャネル配分）を変えて試算しても、保存済みのデータは書き換えない。
import { useState } from 'react';
import { Body1, Button, Caption1, Input, Label, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { kpisOfProject } from './progress';
import { useDataset } from './store';
import { baselineAssumptions, simulate, type Assumptions, type ForecastRow } from './whatif';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  fields: { display: 'flex', flexWrap: 'wrap', gap: spacing.m },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  cols: { display: 'flex', flexWrap: 'wrap', gap: spacing.l },
  plain: { listStyle: 'none', margin: 0, padding: 0 },
  hint: { color: tokens.colorNeutralForeground2 },
});

const fmt = (r: ForecastRow, v: number) => `${r.metric}: ${v.toLocaleString('ja-JP')}${r.unit}`;

function WhatIfBody({ projectId }: { projectId: string }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const project = data.projects.find((p) => p.id === projectId)!;
  const campaign = data.campaigns.find((c) => c.id === project.campaignId);
  const kpis = kpisOfProject(data, projectId);
  const base: Assumptions = baselineAssumptions(campaign?.budget ?? project.budget, data.channels);
  const [budget, setBudget] = useState(String(base.budget));
  const [alloc, setAlloc] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(base.alloc).map(([k, v]) => [k, String(v)])),
  );
  const [rows, setRows] = useState<ForecastRow[] | null>(null);
  const baseline = simulate(kpis, base, base);

  const run = () => {
    const assumed: Assumptions = {
      budget: Number(budget) || 0,
      alloc: Object.fromEntries(Object.entries(alloc).map(([k, v]) => [k, Number(v) || 0])),
    };
    setRows(simulate(kpis, assumed, base));
  };

  return (
    <div className={s.stack}>
      <Caption1>{t('app2.whatifNote')}</Caption1>
      <div className={s.fields}>
        <div className={s.field}>
          <Label htmlFor="whatif-budget-input">{t('app2.whatifBudget')}</Label>
          <Input
            id="whatif-budget-input"
            type="number"
            value={budget}
            onChange={(_, d) => setBudget(d.value)}
            input={{ 'data-testid': 'whatif-budget' } as object}
          />
        </div>
        {data.channels.map((c) => (
          <div className={s.field} key={c.id}>
            <Label htmlFor={`whatif-alloc-input-${c.id}`}>
              {c.name}（{t('app2.whatifAlloc')}）
            </Label>
            <Input
              id={`whatif-alloc-input-${c.id}`}
              type="number"
              value={alloc[c.id] ?? '0'}
              onChange={(_, d) => setAlloc((a) => ({ ...a, [c.id]: d.value }))}
              input={{ 'data-testid': `whatif-alloc-${c.id}` } as object}
            />
          </div>
        ))}
      </div>
      <div>
        <Button appearance="primary" onClick={run} data-testid="whatif-run">
          {t('app2.whatifRun')}
        </Button>
      </div>
      <div className={s.cols}>
        <div>
          <Caption1>{t('app2.whatifBaseline')}</Caption1>
          <p className={s.plain} data-testid="kpi-baseline">
            {baseline.map((r) => fmt(r, r.baseline)).join('、')}
          </p>
        </div>
        <div>
          <Caption1>{t('app2.whatifForecast')}</Caption1>
          <p className={s.plain} data-testid="kpi-forecast">
            {rows === null ? '—' : rows.map((r) => fmt(r, r.forecast)).join('、')}
          </p>
        </div>
      </div>
      {kpis.length === 0 && <Body1 className={s.hint}>{t('app2.noKpi')}</Body1>}
    </div>
  );
}

export function WhatIfPanel({ projectId }: { projectId: string | null }) {
  const t = useT();
  const s = useStyles();
  const data = useDataset();
  const exists = projectId !== null && data.projects.some((p) => p.id === projectId);
  return (
    <div className={s.stack} data-testid="whatif-panel">
      <Subtitle2 as="h3">{t('app2.whatif')}</Subtitle2>
      {exists ? <WhatIfBody key={projectId} projectId={projectId} /> : <Body1 className={s.hint}>{t('app2.whatifSelect')}</Body1>}
    </div>
  );
}
