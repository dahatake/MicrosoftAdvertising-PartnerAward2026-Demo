// ペルソナと表現の切替、表現（表・グラフ・ガント・関係の要約）、同じ情報の表（FR-018）。
// どの表現でも、表示するデータの集合（制作プロジェクトの件数と ID）は同じ。視覚的な表現には必ず表の代替（data-table-alternative）を添える（AC-054）。
import { Select, Subtitle2, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import type { MessageKey } from '../i18n';
import { spacing } from '../theme/theme';
import { OverrunMark, StateBadge } from './ProjectBoard';
import { formatYen } from './progress';
import { buildRelations } from './relations';
import { useDataset } from './store';
import { kindLabelKey } from './kinds';
import {
  PERSONAS,
  REPRESENTATIONS,
  isPersona,
  isRepresentation,
  type PersonaId,
  type Representation,
} from './persona';
import type { Dataset, Project } from './types';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  bar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.m },
  label: { display: 'flex', alignItems: 'center', gap: spacing.s },
  chartRow: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  track: {
    position: 'relative',
    height: '12px',
    backgroundColor: tokens.colorNeutralBackground5,
    borderRadius: tokens.borderRadiusSmall,
  },
  fillBudget: {
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: 0,
    backgroundColor: tokens.colorNeutralStroke1,
    borderRadius: tokens.borderRadiusSmall,
  },
  fillSpent: {
    position: 'absolute',
    insetBlock: 0,
    insetInlineStart: 0,
    backgroundColor: tokens.colorBrandBackground,
    borderRadius: tokens.borderRadiusSmall,
  },
  ganttBar: {
    position: 'absolute',
    insetBlock: 0,
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    overflow: 'hidden',
  },
  ganttDone: { height: '100%', backgroundColor: tokens.colorBrandBackground },
  table: { borderCollapse: 'collapse', width: '100%' },
  cell: { textAlign: 'start', padding: `${spacing.xs} ${spacing.s}`, borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  plain: { margin: 0, paddingInlineStart: spacing.l },
});

export function PersonaBar({
  persona,
  representation,
  onPersona,
  onRepresentation,
}: {
  persona: PersonaId;
  representation: Representation;
  onPersona: (p: PersonaId) => void;
  onRepresentation: (r: Representation) => void;
}) {
  const s = useStyles();
  const t = useT();
  return (
    <div className={s.bar}>
      <label className={s.label}>
        <span>{t('app2.persona')}</span>
        <Select
          value={persona}
          aria-label={t('app2.persona')}
          onChange={(_, d) => isPersona(d.value) && onPersona(d.value)}
          select={{ 'data-testid': 'persona-select' } as object}
        >
          {PERSONAS.map((p) => (
            <option key={p} value={p}>
              {t(`app2.persona.${p}` as MessageKey)}
            </option>
          ))}
        </Select>
      </label>
      <label className={s.label}>
        <span>{t('app2.representation')}</span>
        <Select
          value={representation}
          aria-label={t('app2.representation')}
          onChange={(_, d) => isRepresentation(d.value) && onRepresentation(d.value)}
          select={{ 'data-testid': 'representation-select' } as object}
        >
          {REPRESENTATIONS.map((r) => (
            <option key={r} value={r}>
              {t(`app2.rep.${r}` as MessageKey)}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

const DAY = 86400000;
const day = (iso: string) => Math.floor(new Date(iso).getTime() / DAY);

function Graph({ projects }: { projects: Project[] }) {
  const s = useStyles();
  const t = useT();
  const max = Math.max(1, ...projects.map((p) => Math.max(p.budget, p.spent)));
  return (
    <div className={s.stack} data-testid="rep-graph" role="group" aria-label={t('app2.graphLabel')}>
      {projects.map((p) => (
        <div key={p.id} className={s.chartRow}>
          <Caption1>
            {p.name} — {t('app2.budget')} {formatYen(p.budget)} / {t('app2.spent')} {formatYen(p.spent)} <OverrunMark project={p} />
          </Caption1>
          <div className={s.track} aria-hidden="true">
            <div className={s.fillBudget} style={{ width: `${(p.budget / max) * 100}%` }} />
            <div className={s.fillSpent} style={{ width: `${(p.spent / max) * 100}%`, height: '50%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Gantt({ data, projects }: { data: Dataset; projects: Project[] }) {
  const s = useStyles();
  const t = useT();
  const rows = projects.map((p) => {
    const c = data.campaigns.find((x) => x.id === p.campaignId);
    const start = Math.min(day(c?.startDate ?? p.dueDate), day(p.dueDate));
    return { p, start, end: day(p.dueDate) };
  });
  const min = Math.min(...rows.map((r) => r.start));
  const span = Math.max(1, Math.max(...rows.map((r) => r.end)) - min);
  return (
    <div className={s.stack} data-testid="rep-gantt" role="group" aria-label={t('app2.ganttLabel')}>
      {rows.map(({ p, start, end }) => (
        <div key={p.id} className={s.chartRow}>
          <Caption1>
            {p.name} — {p.dueDate} — {p.progressPercent} %
          </Caption1>
          <div className={s.track} aria-hidden="true">
            <div className={s.ganttBar} style={{ insetInlineStart: `${((start - min) / span) * 100}%`, width: `${Math.max(((end - start) / span) * 100, 1)}%` }}>
              <div className={s.ganttDone} style={{ width: `${Math.min(Math.max(p.progressPercent, 0), 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RelationSummary({ data, campaignId }: { data: Dataset; campaignId: string | null }) {
  const s = useStyles();
  const t = useT();
  if (!campaignId) return <Caption1>{t('app2.selectCampaign')}</Caption1>;
  const r = buildRelations(data, campaignId);
  return (
    <ul className={s.plain} data-testid="rep-relation">
      {r.nodes.map((n) => (
        <li key={n.id}>
          {t(kindLabelKey(n.kind))}: {n.label}
        </li>
      ))}
    </ul>
  );
}

/** 表現の本体。projects は呼び出し側の絞り込み後の集合で、表現を切り替えても変わらない */
export function RepresentationPanel({
  representation,
  campaignId,
  filterCampaignId,
}: {
  representation: Representation;
  /** 関係の要約に使うキャンペーン */
  campaignId: string | null;
  /** 絞り込み（省略で全件） */
  filterCampaignId?: string | null;
}) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const projects = data.projects.filter((p) => !filterCampaignId || p.campaignId === filterCampaignId);
  return (
    <div className={s.stack} data-testid="representation-panel" data-representation={representation}>
      {representation === 'graph' && <Graph projects={projects} />}
      {representation === 'gantt' && projects.length > 0 && <Gantt data={data} projects={projects} />}
      {representation === 'relation' && <RelationSummary data={data} campaignId={campaignId} />}
      <ProjectTable projects={projects} />
    </div>
  );
}

/** 視覚的な表現の代替: 同じ制作プロジェクトの表とテキストの要約（状態は文言つき） */
export function ProjectTable({ projects }: { projects: Project[] }) {
  const s = useStyles();
  const t = useT();
  return (
    <div data-testid="data-table-alternative" data-ids={projects.map((p) => p.id).join(',')}>
      <Subtitle2 as="h3">{t('app2.altTable')}</Subtitle2>
      <p>
        {t('app2.count')}: {projects.length}
      </p>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.cell}>{t('app2.col.name')}</th>
            <th className={s.cell}>{t('app2.col.status')}</th>
            <th className={s.cell}>{t('app2.progress')}</th>
            <th className={s.cell}>{t('app2.budget')}</th>
            <th className={s.cell}>{t('app2.spent')}</th>
            <th className={s.cell}>{t('app2.col.due')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} data-entity-id={p.id}>
              <td className={s.cell}>{p.name}</td>
              <td className={s.cell}>
                <StateBadge status={p.status} />
              </td>
              <td className={s.cell}>{p.progressPercent} %</td>
              <td className={s.cell}>{formatYen(p.budget)}</td>
              <td className={s.cell}>
                {formatYen(p.spent)} <OverrunMark project={p} />
              </td>
              <td className={s.cell}>{p.dueDate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
