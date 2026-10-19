// 外部発注の管理（FR-017）: 発注先・金額・納期・状態で登録・一覧・更新する。状態は 依頼前→発注済→納品済→検収済 の順にだけ進める。
import { useState } from 'react';
import { Badge, Body1, Button, Input, Label, Select, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { brandTokens, spacing } from '../theme/theme';
import { PrimaryButton } from '../theme/BrandButton';
import { advanceOrder, isLastOrderState, registerOrder } from './operations';
import { formatYen } from './progress';
import { stateCode, stateKey } from './states';
import { useDataset } from './store';
import { ErrorText, useFailText } from './ui';

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  fields: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.m },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: spacing.xs },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.m,
    padding: spacing.xs,
    // NFR-UX-004 AC-093: カード（一覧の行・詳細）の角丸は PARAM-024 の範囲
    borderRadius: brandTokens.radiusCard,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  hint: { color: tokens.colorNeutralForeground2 },
});

export function OrderPanel({ projectId }: { projectId?: string | null }) {
  const s = useStyles();
  const t = useT();
  const data = useDataset();
  const failText = useFailText();
  const [project, setProject] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  // 制作プロジェクトは、選ばれていればそれ、なければ利用者が選んだもの、どちらもなければ先頭
  const effectiveProject = project || projectId || data.projects[0]?.id || '';

  const register = () => {
    const r = registerOrder({ projectId: effectiveProject, vendorId: vendor, amount, dueDate: due });
    if (!r.ok) return setError(failText(r)); // 入力済みの内容は残す
    setError(null);
    setVendor('');
    setAmount('');
    setDue('');
  };

  return (
    <div className={s.stack}>
      <div className={s.fields} data-testid="order-form">
        <div className={s.field}>
          <Label htmlFor="order-project-input">{t('app2.projects')}</Label>
          <Select id="order-project-input" value={effectiveProject} onChange={(_, d) => setProject(d.value)} select={{ 'data-testid': 'order-project' } as object}>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={s.field}>
          <Label htmlFor="order-vendor-input">{t('app2.vendor')}</Label>
          <Select id="order-vendor-input" value={vendor} onChange={(_, d) => setVendor(d.value)} select={{ 'data-testid': 'order-vendor' } as object}>
            <option value="">{t('app2.select')}</option>
            {data.vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </div>
        <div className={s.field}>
          <Label htmlFor="order-amount-input">{t('app2.amount')}</Label>
          <Input id="order-amount-input" type="number" value={amount} onChange={(_, d) => setAmount(d.value)} input={{ 'data-testid': 'order-amount' } as object} />
        </div>
        <div className={s.field}>
          <Label htmlFor="order-due-input">{t('app2.col.due')}</Label>
          <Input id="order-due-input" type="date" value={due} onChange={(_, d) => setDue(d.value)} input={{ 'data-testid': 'order-due' } as object} />
        </div>
        <PrimaryButton onClick={register} data-testid="order-register">
          {t('app2.register')}
        </PrimaryButton>
      </div>
      <ErrorText message={error} testId="order-error" />
      <ErrorText message={advanceError} testId="order-advance-error" />
      {data.orders.length === 0 && <Body1 className={s.hint}>{t('app2.none')}</Body1>}
      <ul className={s.list} data-testid="order-list" aria-label={t('app2.orders')}>
        {data.orders.map((o) => {
          const vendorName = data.vendors.find((v) => v.id === o.vendorId)?.name ?? o.vendorId;
          const projectName = data.projects.find((p) => p.id === o.projectId)?.name ?? o.projectId;
          const key = stateKey(o.state);
          return (
            <li key={o.id} className={s.row} data-testid="order-row" data-entity-id={o.id}>
              <span>{vendorName}</span>
              <span>{projectName}</span>
              <span>{formatYen(o.amount)}</span>
              <span>{o.dueDate}</span>
              <Badge appearance="tint" color="informative" data-testid="order-state" data-state={stateCode(o.state)}>
                {key ? t(key) : o.state}
              </Badge>
              <Button
                size="small"
                data-testid="order-advance"
                disabled={isLastOrderState(o.state)}
                onClick={() => {
                  const r = advanceOrder(o.id);
                  setAdvanceError(r.ok ? null : failText(r));
                }}
              >
                {t('app2.advance')}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
