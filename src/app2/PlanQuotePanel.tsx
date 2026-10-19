// 企画・見積の変更と版の履歴（FR-014）。確定した企画・承認済みの見積を変更して保存すると新しい版ができ、
// 状態は「改訂中」を経て企画は「確定」・見積は「提出済み」に戻る。履歴から旧版に戻せる（戻しも新しい版になる）。
import { useState } from 'react';
import { Body1, Button, Caption1, Input, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { ErrorCircle16Filled } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { brandTokens, spacing } from '../theme/theme';
import { PrimaryButton } from '../theme/BrandButton';
import { beginRevision, cancelRevision, restoreVersion, saveRevision, applyStateOp, toDraft, type RevisableKind } from './operations';
import { entityLabel } from './relations';
import { StateBadge } from './ProjectBoard';
import { stateCode, stateKey, errorKey, type Fail, type PlanQuoteOp } from './states';
import type { MessageKey } from '../i18n';
import { useDataset, useHistory } from './store';
import type { VersionRecord } from './types';
import { ErrorText, useFailText } from './ui';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  group: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  item: { justifyContent: 'flex-start', textAlign: 'start', minHeight: '32px', width: '100%' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs },
  version: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s,
    padding: spacing.xs,
    // NFR-UX-004 AC-093: カード（一覧の行・詳細）の角丸は PARAM-024 の範囲
    borderRadius: brandTokens.radiusCard,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  hint: { color: tokens.colorNeutralForeground2 },
  rejection: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color: tokens.colorPaletteRedForeground1 },
});

interface Sel {
  kind: RevisableKind;
  id: string;
}

export function PlanQuotePanel() {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const history = useHistory();
  const failText = useFailText();
  const [sel, setSel] = useState<Sel | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<Fail | null>(null);

  const entity = sel ? (sel.kind === 'plan' ? data.plans.find((p) => p.id === sel.id) : data.quotes.find((q) => q.id === sel.id)) : undefined;
  const contentOf = (kind: RevisableKind, e: NonNullable<typeof entity>) => (kind === 'plan' ? (e as { title: string }).title : String((e as { amount: number }).amount));

  const select = (next: Sel) => {
    if (sel && editing) cancelRevision(sel.kind, sel.id);
    setSel(next);
    setEditing(false);
    setError(null);
    setRejection(null);
  };
  const start = () => {
    if (!sel || !entity) return;
    const r = beginRevision(sel.kind, sel.id);
    if (!r.ok) return setError(failText(r));
    setDraft(contentOf(sel.kind, entity));
    setEditing(true);
    setError(null);
  };
  const cancel = () => {
    if (!sel) return;
    cancelRevision(sel.kind, sel.id);
    setEditing(false);
    setError(null);
  };
  const save = () => {
    if (!sel) return;
    const r = saveRevision(sel.kind, sel.id, sel.kind === 'plan' ? { title: draft } : { amount: draft.trim() === '' ? NaN : Number(draft) });
    if (!r.ok) return setError(failText(r));
    setEditing(false);
    setError(null);
  };
  const restore = (version: number) => {
    if (!sel) return;
    const r = restoreVersion(sel.kind, sel.id, version);
    setError(r.ok ? null : failText(r));
  };
  const runOp = (op: 'confirm' | 'submit' | 'approve' | 'draft') => {
    if (!sel) return;
    const r = op === 'draft' ? toDraft(sel.kind, sel.id) : applyStateOp(sel.kind, sel.id, op);
    setError(null);
    setRejection(r.ok ? null : r);
  };
  const opLabel = (op: PlanQuoteOp) => t(`app2.op.${op}` as MessageKey);

  const rows = sel ? history.filter((h) => h.entityId === sel.id) : [];
  const latest = rows.reduce((m, r) => Math.max(m, r.version), 0);
  const fmt = (v: string | number) => (typeof v === 'number' ? v.toLocaleString('ja-JP') : v);
  const stateText = (st: string) => {
    const k = stateKey(st);
    return k ? t(k) : st;
  };
  const describe = (r: VersionRecord) => {
    const parts = r.changes.map((c) => `${c.field === 'title' ? t('app2.title') : t('app2.amount')}: ${fmt(c.from)} → ${fmt(c.to)}`);
    if (r.restoredFrom !== undefined) parts.unshift(`${t('app2.version')} ${r.restoredFrom} ${t('app2.restore')}`);
    if (r.operation) parts.unshift(`${t('app2.history.operation')}: ${opLabel(r.operation)}`);
    return parts.join('、');
  };

  return (
    <div className={s.stack}>
      <div className={s.group} role="listbox" aria-label={t('app2.plans')} data-testid="plan-list">
        <Caption1>{t('app2.plans')}</Caption1>
        {data.plans.map((p) => (
          <Button
            key={p.id}
            role="option"
            className={s.item}
            appearance={sel?.id === p.id ? 'primary' : 'subtle'}
            aria-selected={sel?.id === p.id}
            data-testid="plan-item"
            data-state={stateCode(p.state)}
            data-entity-id={p.id}
            onClick={() => select({ kind: 'plan', id: p.id })}
          >
            {entityLabel('plan', p)}
          </Button>
        ))}
      </div>
      <div className={s.group} role="listbox" aria-label={t('app2.quotes')} data-testid="quote-list">
        <Caption1>{t('app2.quotes')}</Caption1>
        {data.quotes.map((q) => (
          <Button
            key={q.id}
            role="option"
            className={s.item}
            appearance={sel?.id === q.id ? 'primary' : 'subtle'}
            aria-selected={sel?.id === q.id}
            data-testid="quote-item"
            data-state={stateCode(q.state)}
            data-entity-id={q.id}
            onClick={() => select({ kind: 'quote', id: q.id })}
          >
            {entityLabel('quote', q)}
          </Button>
        ))}
      </div>
      {!sel || !entity ? (
        <Body1 className={s.hint}>{t('app2.selectPlanQuote')}</Body1>
      ) : (
        <div className={s.stack} data-testid="plan-quote-detail" data-entity-id={entity.id}>
          <div className={s.row}>
            <Subtitle2 as="h3">{sel.kind === 'plan' ? (entity as { title: string }).title : entityLabel('quote', entity as never)}</Subtitle2>
            <StateBadge status={entity.state} />
            <Caption1 data-testid="current-version">
              {t('app2.version')} {entity.version}
            </Caption1>
          </div>
          {editing ? (
            <div className={s.row}>
              <Input
                aria-label={sel.kind === 'plan' ? t('app2.title') : t('app2.amount')}
                type={sel.kind === 'plan' ? 'text' : 'number'}
                value={draft}
                onChange={(_, d) => setDraft(d.value)}
                input={{ 'data-testid': sel.kind === 'plan' ? 'plan-title' : 'quote-amount' } as object}
              />
              <PrimaryButton onClick={save} data-testid={sel.kind === 'plan' ? 'save-plan' : 'save-quote'}>
                {t('app2.save')}
              </PrimaryButton>
              <Button onClick={cancel} data-testid="cancel-revision">
                {t('app2.cancel')}
              </Button>
            </div>
          ) : (
            <div className={s.row}>
              <Button onClick={start} data-testid={sel.kind === 'plan' ? 'edit-plan' : 'edit-quote'}>
                {t('app2.edit')}
              </Button>
            </div>
          )}
          <div className={s.row} data-testid="state-ops">
            {sel.kind === 'plan' ? (
              <PrimaryButton onClick={() => runOp('confirm')} data-testid="op-confirm-plan">
                {t('app2.op.confirm')}
              </PrimaryButton>
            ) : (
              <>
                <PrimaryButton onClick={() => runOp('submit')} data-testid="op-submit-quote">
                  {t('app2.op.submit')}
                </PrimaryButton>
                <PrimaryButton onClick={() => runOp('approve')} data-testid="op-approve-quote">
                  {t('app2.op.approve')}
                </PrimaryButton>
              </>
            )}
            <Button onClick={() => runOp('draft')} data-testid="op-to-draft">
              {t('app2.op.toDraft')}
            </Button>
          </div>
          {rejection && (
            <span
              className={s.rejection}
              role="alert"
              data-testid="op-rejection"
              data-current-state={rejection.state ? stateCode(rejection.state) : ''}
              data-allowed-ops={(rejection.allowed ?? []).join(',')}
            >
              <ErrorCircle16Filled aria-hidden />
              <Body1>
                {t(errorKey(rejection.code))}　{t('app2.rejection.current')}: {rejection.state ? stateText(rejection.state) : ''}　{t('app2.rejection.allowed')}:{' '}
                {(rejection.allowed ?? []).map(opLabel).join('、')}
              </Body1>
            </span>
          )}
          <ErrorText message={error} testId="revision-error" />
          <div className={s.group}>
            <Caption1>{t('app2.history')}</Caption1>
            <ul className={s.list} data-testid="version-history">
              {rows.map((r) => (
                <li key={r.version} className={s.version} data-testid="version-row" data-version={r.version}>
                  <strong>
                    {t('app2.version')} {r.version}
                  </strong>
                  <span>{new Date(r.at).toLocaleString('ja-JP')}</span>
                  <span>{r.states.map(stateText).join(' → ')}</span>
                  <span data-testid="version-op" data-operation={r.operation ?? ''}>{describe(r)}</span>
                  {r.version !== latest && (
                    <Button size="small" onClick={() => restore(r.version)} data-testid="version-restore" disabled={editing}>
                      {t('app2.restore')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
