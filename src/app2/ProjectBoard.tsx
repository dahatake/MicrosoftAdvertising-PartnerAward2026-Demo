// 制作プロジェクトの一覧と、選択したプロジェクトの進捗・予算消化・成果物・KPI（FR-013）。App2 の画面のパネルとして置く。
import { Badge, Body1, Button, Caption1, ProgressBar, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { Warning16Filled } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { formatYen, isOverBudget, kpisOfProject, projectStatusKey, spentPercent } from './progress';
import { stateCode, stateKey } from './states';
import { useDataset } from './store';
import type { Project } from './types';

const useStyles = makeStyles({
  list: { display: 'flex', flexDirection: 'column', gap: spacing.xs, margin: 0, padding: 0 },
  item: { justifyContent: 'space-between', textAlign: 'start', minHeight: '32px', width: '100%', gap: spacing.s },
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  ul: { margin: 0, paddingInlineStart: spacing.l },
  hint: { color: tokens.colorNeutralForeground2 },
  plain: { listStyle: 'none', margin: 0, padding: 0 },
});

/** 状態の表示。色だけでなく文言でも状態を示す（AC-054）。testId は一覧の状態は 'project-state-badge'、企画・見積の詳細は 'state-badge' */
export function StateBadge({ status, testId = 'state-badge' }: { status: string; testId?: string }) {
  const t = useT();
  const key = stateKey(status);
  return (
    <Badge appearance="tint" color="informative" data-testid={testId} data-state={stateCode(status)}>
      {key ? t(key) : status}
    </Badge>
  );
}

/** 予算超過の表示。色に加えて、アイコンと文言で示す（AC-044） */
export function OverrunMark({ project }: { project: Pick<Project, 'budget' | 'spent'> }) {
  const t = useT();
  if (!isOverBudget(project)) return null;
  return (
    <Badge appearance="filled" color="danger" icon={<Warning16Filled />} data-testid="project-overrun">
      {t('app2.overrun')}
    </Badge>
  );
}

export function ProjectList({
  selectedId,
  onSelect,
  campaignId,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 絞り込み。省略すると全件 */
  campaignId?: string | null;
}) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const projects = data.projects.filter((p) => !campaignId || p.campaignId === campaignId);
  return (
    <div className={s.list} role="radiogroup" data-testid="project-list" aria-label={t('app2.projects')}>
      {projects.map((p) => (
        <Button
          key={p.id}
          role="radio"
          className={s.item}
          appearance={p.id === selectedId ? 'primary' : 'subtle'}
          aria-checked={p.id === selectedId}
          data-testid="project-item"
          data-entity-id={p.id}
          onClick={() => onSelect(p.id)}
        >
          <span>{p.name}</span>
          <span className={s.row}>
            <StateBadge status={p.status} testId="project-state-badge" />
            <OverrunMark project={p} />
          </span>
        </Button>
      ))}
    </div>
  );
}

export function ProjectDetail({ projectId }: { projectId: string | null }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const p = data.projects.find((x) => x.id === projectId);
  if (!p) return <Body1 className={s.hint}>{t('app2.selectProject')}</Body1>;
  const kpis = kpisOfProject(data, p.id);
  const key = projectStatusKey(p.status);
  const percent = Math.min(Math.max(p.progressPercent, 0), 100);
  return (
    <div className={s.stack} data-testid="project-detail" data-entity-id={p.id}>
      <Subtitle2 as="h3">{p.name}</Subtitle2>
      <div className={s.row}>
        <Caption1>{t('app2.progress')}</Caption1>
        <span data-testid="project-progress-status">{key ? t(key) : p.status}</span>
        <span data-testid="project-progress-percent">{percent} %</span>
      </div>
      <ProgressBar value={percent / 100} aria-label={t('app2.progress')} />
      <div className={s.row}>
        <Caption1>{t('app2.budget')}</Caption1>
        <span data-testid="project-budget">{formatYen(p.budget)}</span>
        <Caption1>{t('app2.spent')}</Caption1>
        <span data-testid="project-budget-spent">
          {formatYen(p.spent)}（{spentPercent(p)} %）
        </span>
        <OverrunMark project={p} />
      </div>
      <div>
        <Caption1>{t('app2.deliverables')}</Caption1>
        <ul className={s.ul} data-testid="project-deliverables">
          {p.deliverables.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        {p.deliverables.length === 0 && <Body1 className={s.hint}>{t('app2.noDeliverables')}</Body1>}
      </div>
      <div>
        <Caption1>{t('app2.kpi')}</Caption1>
        {kpis.length === 0 && <Body1 className={s.hint}>{t('app2.noKpi')}</Body1>}
        <p className={s.plain} data-testid="project-kpi-target" aria-label={t('app2.kpiTarget')}>
          {kpis.map((k) => `${t('app2.kpiTarget')} ${k.metric}: ${k.target.toLocaleString('ja-JP')}${k.unit}`).join('、')}
        </p>
        <p className={s.plain} data-testid="project-kpi-actual" aria-label={t('app2.kpiCurrent')}>
          {kpis.map((k) => `${t('app2.kpiCurrent')} ${k.metric}: ${k.actual.toLocaleString('ja-JP')}${k.unit}`).join('、')}
        </p>
      </div>
    </div>
  );
}
