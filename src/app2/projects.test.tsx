import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import {
  DEFAULT_REPRESENTATION,
  PersonaBar,
  ProjectDetail,
  ProjectList,
  RepresentationPanel,
  WhatIfPanel,
  baselineAssumptions,
  forecastKpi,
  getDataset,
  isOverBudget,
  projectStatusKey,
  resetDataset,
  seedDataset,
  simulate,
  updateDataset,
  type Representation,
} from './index';
import { resetSettings } from '../settings/store';
import { choose } from '../ui/choose';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(() => cleanup());

// FR-013 AC-044 予算超過は色だけでなく文言（とアイコン）でも示される
describe('FR-013 AC-044 予算超過の表示', () => {
  it('超過したプロジェクトに「予算超過」の文言が付き、超過していないものには付かない', () => {
    const first = seedDataset.projects[0];
    expect(isOverBudget(first)).toBe(false);
    updateDataset((d) => ({
      ...d,
      projects: d.projects.map((p) => (p.id === first.id ? { ...p, spent: p.budget + 1 } : p)),
    }));
    wrap(<ProjectList selectedId={null} onSelect={() => {}} />);
    const over = screen.getAllByTestId('project-overrun');
    expect(over).toHaveLength(1);
    expect(over[0].textContent).toContain('予算超過');
    expect(within(over[0]).queryByRole('img', { hidden: true }) ?? over[0].querySelector('svg')).not.toBeNull();
  });

  it('詳細にも超過が文言で出る。予算ちょうどは超過ではない', () => {
    const id = seedDataset.projects[1].id;
    updateDataset((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, spent: p.budget } : p)) }));
    wrap(<ProjectDetail projectId={id} />);
    expect(screen.queryByTestId('project-overrun')).toBeNull();
    cleanup();
    updateDataset((d) => ({ ...d, projects: d.projects.map((p) => (p.id === id ? { ...p, spent: p.budget * 2 } : p)) }));
    wrap(<ProjectDetail projectId={id} />);
    expect(screen.getByTestId('project-overrun').textContent).toContain('予算超過');
  });
});

// FR-013 AC-043 進捗・予算消化・成果物・KPI
describe('FR-013 AC-043 プロジェクトの詳細', () => {
  it('状態・割合・消化額・成果物・KPI の目標と現在値が出る。未選択は案内', () => {
    wrap(<ProjectDetail projectId={null} />);
    expect(screen.getByText(/制作プロジェクトを選ぶと/)).toBeTruthy();
    cleanup();
    const p = seedDataset.projects[0];
    wrap(<ProjectDetail projectId={p.id} />);
    expect(screen.getByTestId('project-progress-status').textContent).toBe('完了');
    expect(screen.getByTestId('project-progress-percent').textContent).toMatch(/100\s*%/);
    expect(screen.getByTestId('project-budget-spent').textContent).toContain('1,425,000');
    expect(screen.getByTestId('project-deliverables').querySelectorAll('li').length).toBe(p.deliverables.length);
    expect(screen.getByTestId('project-kpi-target').textContent).toMatch(/\d/);
    expect(screen.getByTestId('project-kpi-actual').textContent).toMatch(/\d/);
  });
  it('データの状態値を「計画中・制作中・レビュー中・完了」に対応づける', () => {
    expect(projectStatusKey('計画中')).toBe('app2.status.planning');
    expect(projectStatusKey('制作中')).toBe('app2.status.production');
    expect(projectStatusKey('レビュー中')).toBe('app2.status.review');
    expect(projectStatusKey('完了')).toBe('app2.status.done');
    expect(projectStatusKey('不明')).toBeNull();
  });
});

// FR-015 AC-048 決定的・係数のみ
describe('FR-015 AC-048 試算は決定的', () => {
  const base = baselineAssumptions(10_000_000, seedDataset.channels);
  const kpi = { target: 1000 };
  it('同じ前提からは常に同じ値、元の前提では目標のまま', () => {
    expect(forecastKpi(kpi, base, base)).toBe(1000);
    const a = { budget: 15_000_000, alloc: { ...base.alloc, 'chn-1': 70 } };
    expect(forecastKpi(kpi, a, base)).toBe(forecastKpi(kpi, { ...a, alloc: { ...a.alloc } }, base));
  });
  it('予算を増やすと増え、減らすと減る。効率の高いチャネルへの配分で増える', () => {
    expect(forecastKpi(kpi, { ...base, budget: 20_000_000 }, base)).toBeGreaterThan(1000);
    expect(forecastKpi(kpi, { ...base, budget: 5_000_000 }, base)).toBeLessThan(1000);
    const shifted = { ...base, alloc: { ...base.alloc, 'chn-1': 100, 'chn-2': 0, 'chn-3': 0, 'chn-4': 0 } };
    expect(forecastKpi(kpi, shifted, base)).toBeGreaterThan(1000);
  });
  it('異常な入力（予算 0・配分すべて 0・基準の予算 0）でも有限の値', () => {
    expect(forecastKpi(kpi, { budget: 0, alloc: base.alloc }, base)).toBe(0);
    expect(Number.isFinite(forecastKpi(kpi, { budget: 1, alloc: { a: 0 } }, base))).toBe(true);
    expect(Number.isFinite(forecastKpi(kpi, base, { budget: 0, alloc: {} }))).toBe(true);
  });
  it('simulate は元の値を目標として並べる', () => {
    const rows = simulate(seedDataset.kpis.slice(0, 2), base, base);
    expect(rows.map((r) => r.baseline)).toEqual(seedDataset.kpis.slice(0, 2).map((k) => k.target));
  });
});

// FR-015 AC-047 保存済みデータは変わらない
describe('FR-015 AC-047 試算でデータは変わらない', () => {
  it('試算を実行しても、予測値が元の値と並んで出て、データセットは同じ参照のまま', () => {
    const before = getDataset();
    const id = seedDataset.projects[0].id;
    wrap(<WhatIfPanel projectId={id} />);
    const baseline = screen.getByTestId('kpi-baseline').textContent;
    fireEvent.change(screen.getByTestId('whatif-budget'), { target: { value: '99999999' } });
    fireEvent.click(screen.getByTestId('whatif-run'));
    expect(screen.getByTestId('kpi-forecast').textContent).not.toBe(baseline);
    expect(screen.getByTestId('kpi-baseline').textContent).toBe(baseline);
    expect(getDataset()).toBe(before);
    expect(localStorage.getItem('app2:data')).toBeNull();
  });
});

// FR-018 AC-073 / AC-054 / AC-053
describe('FR-018 表現の切替', () => {
  const ids = (el: HTMLElement) => el.getAttribute('data-ids');
  it('AC-073 表現を切り替えても、表示するデータの集合（ID）と件数が同じ', () => {
    const reps: Representation[] = ['table', 'graph', 'gantt', 'relation'];
    const sets = reps.map((r) => {
      const { unmount } = wrap(<RepresentationPanel representation={r} campaignId={null} />);
      const v = ids(screen.getByTestId('data-table-alternative'));
      unmount();
      return v;
    });
    expect(new Set(sets).size).toBe(1);
    expect(sets[0]!.split(',')).toHaveLength(seedDataset.projects.length);
  });
  it('AC-073 同じ絞り込みのもとで集合が同じ', () => {
    const c = seedDataset.campaigns[0].id;
    const sets = (['table', 'gantt'] as Representation[]).map((r) => {
      const { unmount } = wrap(<RepresentationPanel representation={r} campaignId={c} filterCampaignId={c} />);
      const v = ids(screen.getByTestId('data-table-alternative'));
      unmount();
      return v;
    });
    expect(sets[0]).toBe(sets[1]);
    expect(sets[0]!.split(',').length).toBe(seedDataset.projects.filter((p) => p.campaignId === c).length);
  });
  it('AC-054 すべての視覚表現に表の代替があり、状態が文言で示される', () => {
    for (const r of ['relation', 'gantt', 'graph'] as Representation[]) {
      const { unmount } = wrap(<RepresentationPanel representation={r} campaignId={seedDataset.campaigns[0].id} />);
      expect(screen.getByTestId('data-table-alternative').textContent!.trim().length).toBeGreaterThan(0);
      for (const b of screen.getAllByTestId('project-state-badge')) expect(b.textContent!.trim().length).toBeGreaterThan(0);
      unmount();
    }
  });
  it('AC-053 ペルソナの既定の表現は §7 のとおり（P-3 グラフ、P-4 ガント、P-5 グラフ）', () => {
    expect(DEFAULT_REPRESENTATION).toEqual({ 'P-3': 'graph', 'P-4': 'gantt', 'P-5': 'graph' });
  });
  it('AC-053 ペルソナ・表現の選択が通知される', () => {
    const got: string[] = [];
    wrap(
      <PersonaBar persona="P-3" representation="graph" onPersona={(p) => got.push(p)} onRepresentation={(r) => got.push(r)} />,
    );
    fireEvent.change(screen.getByTestId('persona-select'), { target: { value: 'P-4' } });
    choose(screen.getByTestId('representation-select'), 'table');
    expect(got).toEqual(['P-4', 'table']);
  });
});
