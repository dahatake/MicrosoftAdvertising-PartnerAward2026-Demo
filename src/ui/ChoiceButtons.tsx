// ChoiceButtons: 「値を 1 つ選ぶ」項目のボタン群（FR-026。コンボボックスの代わり）。
// role=radiogroup + role=radio（aria-checked）。選択中は色に加えて「✓」と太い枠で示す。
// キーボード: 矢印キーで移動して選ぶ、Tab で群の出入り（roving tabindex）。無効の選択肢は aria-disabled（理由を title で示す）。
// 選択肢が pageSize を超えるときはページ送り（前へ・次へ）で全選択肢に到達できる（AC-110）。
import { useRef, useState, type KeyboardEvent } from 'react';
import { Caption1, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';

export interface ChoiceOption {
  value: string;
  label: string;
  /** ツールチップ（専門名・無効の理由など） */
  title?: string;
  disabled?: boolean;
}

export interface ChoiceButtonsProps {
  /** グループの名前（支援技術に伝える） */
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  testId?: string;
  /** 選択肢ごとの data-testid（省略可） */
  optionTestId?: (value: string) => string;
  /** 1 ページに出す選択肢の数（既定 8） */
  pageSize?: number;
}

const useStyles = makeStyles({
  wrap: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  group: { display: 'flex', flexWrap: 'wrap', gap: spacing.xs },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: '32px',
    paddingInline: spacing.s,
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    ':hover': { backgroundColor: tokens.colorNeutralBackground1Hover },
    ':focus-visible': { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tokens.colorStrokeFocus2 },
  },
  on: {
    ...shorthands.border('2px', 'solid', tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  off: { cursor: 'not-allowed', color: tokens.colorNeutralForegroundDisabled, backgroundColor: tokens.colorNeutralBackgroundDisabled },
  pager: { display: 'flex', alignItems: 'center', gap: spacing.xs },
});

export function ChoiceButtons({ label, options, value, onChange, testId, pageSize = 8, optionTestId }: ChoiceButtonsProps) {
  const s = useStyles();
  const t = useT();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const pages = Math.max(1, Math.ceil(options.length / pageSize));
  const [pageState, setPage] = useState(() => Math.floor(Math.max(0, selectedIndex) / pageSize));
  const page = Math.min(pageState, pages - 1);
  const start = page * pageSize;
  const visible = options.slice(start, start + pageSize);
  const checkedAt = visible.findIndex((o) => o.value === value && !o.disabled);
  const tabStop = checkedAt >= 0 ? checkedAt : visible.findIndex((o) => !o.disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const cur = refs.current.findIndex((el) => el === document.activeElement);
    for (let step = 1; step <= visible.length; step++) {
      const i = ((((cur < 0 ? 0 : cur) + dir * step) % visible.length) + visible.length) % visible.length;
      if (!visible[i].disabled) {
        refs.current[i]?.focus();
        onChange(visible[i].value);
        return;
      }
    }
  };

  return (
    <div className={s.wrap}>
      <div className={s.group} role="radiogroup" aria-label={label} data-testid={testId} onKeyDown={onKeyDown}>
        {visible.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={o.disabled ? true : undefined}
              tabIndex={i === tabStop ? 0 : -1}
              title={o.title}
              data-value={o.value}
              data-testid={optionTestId?.(o.value)}
              className={mergeClasses(s.btn, checked && s.on, o.disabled && s.off)}
              onClick={() => {
                if (!o.disabled) onChange(o.value);
              }}
            >
              {checked && <span aria-hidden="true">✓</span>}
              {o.label}
            </button>
          );
        })}
      </div>
      {pages > 1 && (
        <div className={s.pager}>
          <button type="button" className={s.btn} aria-label={t('ui.prevPage')} disabled={page === 0} onClick={() => setPage(page - 1)}>
            ‹
          </button>
          <Caption1 aria-live="polite">
            {page + 1} / {pages}
          </Caption1>
          <button type="button" className={s.btn} aria-label={t('ui.nextPage')} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
