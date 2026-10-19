// 展開の一覧と、選んだ展開の利用状況（実績値）・KPI の目標値の登録・更新（FR-019）。
// 登録すると、制作プロジェクトの KPI の目標と現在値の表示（FR-013）と KPI の関係図に反映され、localStorage に保存される。
import { useState } from 'react';
import { Badge, Body1, Button, Caption1, Input, Label, makeStyles, tokens } from '@fluentui/react-components';
import { ChoiceButtons } from '../ui/ChoiceButtons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { kpisOfDeployment, saveUsage } from './operations';
import { stateCode, stateKey } from './states';
import { useDataset } from './store';
import { ErrorText, useFailText } from './ui';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  list: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  item: { justifyContent: 'flex-start', textAlign: 'start', minHeight: '32px', width: '100%', gap: spacing.s },
  fields: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.m },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  hint: { color: tokens.colorNeutralForeground2 },
});

function UsageForm({ deploymentId }: { deploymentId: string }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const failText = useFailText();
  const kpis = kpisOfDeployment(data, deploymentId);
  const [kpiId, setKpiId] = useState(kpis[0]?.id ?? '');
  const kpi = kpis.find((k) => k.id === kpiId) ?? kpis[0];
  // 入力は、選んだ KPI の現在の値から始める（KPI を切り替えたら取り直す）
  return <UsageFields key={kpi?.id ?? 'none'} deploymentId={deploymentId} kpiId={kpi?.id} initialActual={kpi?.actual} initialTarget={kpi?.target} kpiSelect={
    <div className={s.field}>
      <Label>{t('app2.kpiSelect')}</Label>
      <ChoiceButtons
        label={t('app2.kpiSelect')}
        testId="kpi-select"
        value={kpi?.id ?? ''}
        onChange={setKpiId}
        options={kpis.map((k) => ({ value: k.id, label: `${k.metric}（${k.unit}）` }))}
      />
    </div>
  } failText={failText} />;
}

function UsageFields({
  deploymentId,
  kpiId,
  initialActual,
  initialTarget,
  kpiSelect,
  failText,
}: {
  deploymentId: string;
  kpiId?: string;
  initialActual?: number;
  initialTarget?: number;
  kpiSelect: React.ReactNode;
  failText: ReturnType<typeof useFailText>;
}) {
  const s = useStyles();
  const t = useT();
  const [actual, setActual] = useState(initialActual === undefined ? '' : String(initialActual));
  const [target, setTarget] = useState(initialTarget === undefined ? '' : String(initialTarget));
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    const r = saveUsage({ deploymentId, kpiId, actual, target });
    setError(r.ok ? null : failText(r));
  };
  return (
    <div className={s.stack}>
      <div className={s.fields} data-testid="usage-form">
        {kpiSelect}
        <div className={s.field}>
          <Label htmlFor="usage-actual-input">{t('app2.usageValue')}</Label>
          <Input id="usage-actual-input" type="number" value={actual} onChange={(_, d) => setActual(d.value)} input={{ 'data-testid': 'usage-actual' } as object} />
        </div>
        <div className={s.field}>
          <Label htmlFor="kpi-target-input-field">{t('app2.kpiTargetInput')}</Label>
          <Input id="kpi-target-input-field" type="number" value={target} onChange={(_, d) => setTarget(d.value)} input={{ 'data-testid': 'kpi-target-input' } as object} />
        </div>
        <Button appearance="primary" onClick={save} data-testid="usage-save">
          {t('app2.usageSave')}
        </Button>
      </div>
      <ErrorText message={error} testId="usage-error" />
    </div>
  );
}

export function DeploymentPanel() {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <div className={s.stack}>
      {data.deployments.length === 0 && <Body1 className={s.hint}>{t('app2.none')}</Body1>}
      <div className={s.list} role="radiogroup" aria-label={t('app2.deployments')} data-testid="deployment-list">
        {data.deployments.map((dep) => {
          const asset = data.assets.find((a) => a.id === dep.assetId);
          const channel = data.channels.find((c) => c.id === dep.channelId);
          const usage = data.usages.find((u) => u.deploymentId === dep.id);
          const key = stateKey(dep.state);
          return (
            <Button
              key={dep.id}
              role="radio"
              className={s.item}
              appearance={dep.id === selectedId ? 'primary' : 'subtle'}
              aria-checked={dep.id === selectedId}
              data-testid="deployment-row"
              data-entity-id={dep.id}
              onClick={() => setSelectedId(dep.id)}
            >
              <span>
                {asset?.name ?? dep.assetId} / {channel?.name ?? dep.channelId} / {dep.startDate}
              </span>
              <Badge appearance="tint" color="informative" data-testid="deployment-state" data-state={stateCode(dep.state)}>
                {key ? t(key) : dep.state}
              </Badge>
              {usage?.actual !== undefined && (
                <Caption1>
                  {t('app2.usage')}: {usage.actual.toLocaleString('ja-JP')}
                </Caption1>
              )}
            </Button>
          );
        })}
      </div>
      {selectedId && data.deployments.some((d) => d.id === selectedId) ? (
        <UsageForm key={selectedId} deploymentId={selectedId} />
      ) : (
        <Body1 className={s.hint}>{t('app2.selectDeployment')}</Body1>
      )}
    </div>
  );
}
