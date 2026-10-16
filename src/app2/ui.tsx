// 業務操作の画面で共通の小さな部品: 拒否の理由の文言、エラー表示（原因と次の行動を示す）。
import { Body1, makeStyles, tokens } from '@fluentui/react-components';
import { ErrorCircle16Filled } from '@fluentui/react-icons';
import type { MessageKey } from '../i18n';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { errorKey, type Fail } from './states';

/** 必須エラーで名前を出す項目 → ラベルの文言キー */
const FIELD_LABELS: Record<string, MessageKey> = {
  name: 'app2.col.name',
  type: 'app2.type',
  project: 'app2.projects',
  channel: 'app2.channel',
  vendor: 'app2.vendor',
  amount: 'app2.amount',
  due: 'app2.col.due',
  title: 'app2.title',
  usage: 'app2.usageValue',
  kpiTarget: 'app2.kpiTargetInput',
};

/** 拒否の理由の文言（必須の欠けは、どの項目かを先頭に付ける） */
export function useFailText(): (f: Fail) => string {
  const t = useT();
  return (f) => {
    const label = f.field && FIELD_LABELS[f.field] ? t(FIELD_LABELS[f.field]) : '';
    return f.code === 'required' ? `${label}${t(errorKey(f.code))}` : t(errorKey(f.code));
  };
}

const useStyles = makeStyles({
  error: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs, color: tokens.colorPaletteRedForeground1 },
});

/** エラーの表示。色に加えてアイコンと文言で示し、読み上げにも伝える */
export function ErrorText({ message, testId }: { message: string | null; testId: string }) {
  const s = useStyles();
  if (!message) return null;
  return (
    <span className={s.error} role="alert" data-testid={testId}>
      <ErrorCircle16Filled aria-hidden />
      <Body1>{message}</Body1>
    </span>
  );
}
