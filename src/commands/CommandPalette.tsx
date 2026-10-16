// コマンドの検索（コマンドパレット）: Ctrl+K（Mac は ⌘K）で開き、キーボードだけでレイアウト・アプリ・言語・表示方法に到達できる（FR-010 AC-038）。
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { Body1, Input, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { filterCommands, useCommands } from './registry';


// 開閉の状態は React の外に持つ: ページの読み込み直後（React の副作用が走る前）の Ctrl+K も取りこぼさない。
let isOpen = false;
const subs = new Set<() => void>();
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
function setOpen(v: boolean) {
  isOpen = v;
  subs.forEach((l) => l());
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setOpen(true);
    }
  });
  window.addEventListener('open-command-palette', () => setOpen(true));
}
const useStyles = makeStyles({
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '12vh',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  dialog: {
    width: 'min(560px, 92vw)',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s,
    padding: spacing.m,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow28,
  },
  list: { listStyle: 'none', margin: 0, padding: 0, overflowY: 'auto' },
  option: {
    padding: `${spacing.s} ${spacing.m}`,
    minHeight: '32px',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
  },
  optionActive: { backgroundColor: tokens.colorBrandBackground2, outline: `1px solid ${tokens.colorBrandStroke1}` },
});

export function CommandPalette() {
  const open = useSyncExternalStore(subscribe, () => isOpen);
  return open ? <PaletteDialog /> : null;
}

function PaletteDialog() {
  const s = useStyles();
  const t = useT();
  const commands = useCommands();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const opener = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const listId = useId();

  useEffect(() => {
    const el = opener.current;
    return () => el?.focus?.();
  }, []);

  const close = () => setOpen(false);

  const found = filterCommands(commands, query);
  const run = (i: number) => {
    const c = found[i];
    if (!c) return;
    setOpen(false);
    c.run();
  };

  return (
    <div className={s.backdrop} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('cmd.title')}
        data-testid="command-palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          }
        }}
      >
        <Input
          autoFocus
          value={query}
          placeholder={t('cmd.placeholder')}
          aria-label={t('cmd.title')}
          input={{
            role: 'combobox',
            'aria-expanded': true,
            'aria-controls': listId,
            'aria-activedescendant': found[index] ? `${listId}-${index}` : undefined,
          } as object}
          onChange={(_, d) => {
            setQuery(d.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(found.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(index);
            }
          }}
        />
        <ul id={listId} role="listbox" aria-label={t('cmd.title')} className={s.list}>
          {found.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === index}
              className={`${s.option} ${i === index ? s.optionActive : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(i)}
            >
              <Body1>{c.label}</Body1>
            </li>
          ))}
        </ul>
        {found.length === 0 && <Body1 role="status">{t('cmd.empty')}</Body1>}
      </div>
    </div>
  );
}
