// Paged: 件数が 1 画面に収まらない一覧を、ページ送りでスクロールなしに全件へ到達できるようにする（FR-024 AC-100）。
// 現在の表示範囲（「a–b / 全 n」）を示す。pageSize 以下のときは全件を出し、範囲だけ示す。
import { useState, type ReactNode } from 'react';
import { Button, Caption1, makeStyles } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';

const useStyles = makeStyles({
  bar: { display: 'flex', alignItems: 'center', gap: spacing.xs },
});

export function Paged<T>({
  items,
  pageSize,
  children,
  testId,
}: {
  items: readonly T[];
  pageSize: number;
  children: (visible: readonly T[]) => ReactNode;
  testId?: string;
}) {
  const s = useStyles();
  const t = useT();
  const [pageState, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(pageState, pages - 1);
  const from = items.length === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(items.length, (page + 1) * pageSize);
  return (
    <>
      {children(items.slice(page * pageSize, page * pageSize + pageSize))}
      {items.length > pageSize && (
        <div className={s.bar} data-testid={testId ? `${testId}-pager` : undefined}>
          <Button size="small" appearance="subtle" aria-label={t('ui.prevPage')} disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹
          </Button>
          <Caption1 aria-live="polite" data-testid={testId ? `${testId}-range` : undefined}>
            {from}–{to} / {items.length}
          </Caption1>
          <Button size="small" appearance="subtle" aria-label={t('ui.nextPage')} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            ›
          </Button>
        </div>
      )}
    </>
  );
}
