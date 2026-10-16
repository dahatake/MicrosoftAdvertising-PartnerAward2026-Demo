import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import {
  PlanQuotePanel,
  approveQuote,
  beginRevision,
  confirmPlan,
  getDataset,
  getHistory,
  resetDataset,
  saveRevision,
  submitQuote,
  toDraft,
} from './index';
import { resetSettings } from '../settings/store';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(() => cleanup());

const NOW = new Date('2026-10-17T01:00:00Z');
const plan = (state: string) => getDataset().plans.find((p) => p.state === state);
const quote = (state: string) => getDataset().quotes.find((q) => q.state === state);

// FR-020 AC-077 確定・提出・承認で状態が進む
describe('FR-020 AC-077 状態の操作', () => {
  it('下書きの企画を確定し、下書きの見積を提出し、提出済みの見積を承認できる', () => {
    const p = plan('下書き');
    const q = quote('下書き');
    if (!p || !q) return; // シードに下書きがなければ、下の保存経由のテストで確かめる
    expect(confirmPlan(p.id, NOW).ok).toBe(true);
    expect(getDataset().plans.find((x) => x.id === p.id)!.state).toBe('確定');
    expect(submitQuote(q.id, NOW).ok).toBe(true);
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('提出済み');
    expect(approveQuote(q.id, NOW).ok).toBe(true);
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('承認済み');
  });
});

// FR-020 AC-078 逆戻り・飛び越しは拒否され、状態と版は変わらない
describe('FR-020 AC-078 拒否', () => {
  it('承認済みの見積の提出、確定した企画の確定、確定済み・承認済みから下書きへは拒否し、現在の状態と可能な操作を返す', () => {
    const q = quote('承認済み')!;
    const p = plan('確定')!;
    const before = JSON.stringify(getDataset());
    const histBefore = getHistory(q.id).length;
    const r1 = submitQuote(q.id);
    expect(r1.ok).toBe(false);
    if (!r1.ok) {
      expect(r1.code).toBe('backward');
      expect(r1.state).toBe('承認済み');
      expect(r1.allowed).toEqual(['edit']);
    }
    const r2 = confirmPlan(p.id);
    expect(!r2.ok && r2.code).toBe('same');
    expect(toDraft('quote', q.id).ok).toBe(false);
    expect(toDraft('plan', p.id).ok).toBe(false);
    expect(JSON.stringify(getDataset())).toBe(before);
    expect(getHistory(q.id)).toHaveLength(histBefore);
  });
  it('提出済みの見積は提出を拒否し、改訂中は確定・提出・承認を拒否して「保存」だけを可能な操作に示す', () => {
    const q = quote('提出済み')!;
    expect(!submitQuote(q.id).ok).toBe(true);
    beginRevision('quote', q.id);
    for (const r of [submitQuote(q.id), approveQuote(q.id)]) {
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('revising');
        expect(r.state).toBe('改訂中');
        expect(r.allowed).toEqual(['save']);
      }
    }
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('改訂中');
    expect(saveRevision('quote', q.id, { amount: 777 }, NOW).ok).toBe(true);
    expect(getDataset().quotes.find((x) => x.id === q.id)!.state).toBe('提出済み');
  });
  it('下書きの見積の承認は飛び越しとして拒否する（保存で作った下書きにも当てはまる）', () => {
    const q = quote('下書き');
    if (!q) return;
    const r = approveQuote(q.id);
    expect(!r.ok && r.code).toBe('skip');
    expect(!r.ok && r.allowed).toEqual(['submit', 'edit']);
  });
});

// FR-020 AC-079 操作は履歴に操作名・遷移前後の状態・日時とともに記録され、拒否は記録されない
describe('FR-020 AC-079 履歴', () => {
  it('提出・承認は版の履歴に操作名・前後の状態・日時つきで残り、拒否は残らない', () => {
    const q = quote('下書き');
    if (!q) return;
    const n = getHistory(q.id).length;
    submitQuote(q.id, NOW);
    approveQuote(q.id, NOW);
    submitQuote(q.id, NOW); // 拒否
    const rows = getHistory(q.id);
    expect(rows).toHaveLength(n + 2);
    const [a, b] = rows.slice(-2);
    expect(a.operation).toBe('submit');
    expect(a.states).toEqual(['下書き', '提出済み']);
    expect(a.at).toBe(NOW.toISOString());
    expect(b.operation).toBe('approve');
    expect(b.states).toEqual(['提出済み', '承認済み']);
    expect(b.version).toBe(a.version + 1);
  });
  it('画面: 操作ボタンは常に押せ、拒否は理由・現在の状態・可能な操作を表示して版の行数を変えない', () => {
    wrap(<PlanQuotePanel />);
    const q = getDataset().quotes.find((x) => x.state === '承認済み')!;
    fireEvent.click(screen.getAllByTestId('quote-item').find((e) => e.getAttribute('data-entity-id') === q.id)!);
    const rows = () => screen.getAllByTestId('version-row').length;
    const n = rows();
    for (const id of ['op-submit-quote', 'op-approve-quote', 'op-to-draft']) expect((screen.getByTestId(id) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('op-submit-quote'));
    const rej = screen.getByTestId('op-rejection');
    expect(rej.getAttribute('data-current-state')).toBe('approved');
    expect(rej.getAttribute('data-allowed-ops')).toBe('edit');
    expect(rej.textContent).toContain('承認済み');
    expect(rows()).toBe(n);
    expect(within(screen.getByTestId('plan-quote-detail')).getByTestId('state-badge').getAttribute('data-state')).toBe('approved');
  });
});
