// 共通の「表示方法」部品: 同じ情報項目（ViewItem[]）を 2D（既定）と 3D の空間配置で見せる。
// 項目の一覧（data-item-id・選択・ラベル）と凡例は 2D/3D で同じ要素を使うため、ID の集合・選択・絞り込み・色・形・ラベルが一致する。
// 絞り込みは呼び出し側が items に反映し、選択は selectedId / onSelect で呼び出し側が持つ（表示方法を切り替えても保たれる）。
import type { CSSProperties } from 'react';
import { lazyRetry } from '../apps/lazyRetry';
import type { Scene3DProps } from './Scene3D';
import { Body1, Caption1, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
import { AsyncBoundary } from '../shell/AsyncBoundary';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { resolveKinds, type KindDef, type Shape, type ViewItem } from './kinds';
import { useViewMode } from './useViewMode';

const scene3d = lazyRetry<Scene3DProps>(() => import('./Scene3D'));
const Scene3D = scene3d.Component;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  canvas: {
    height: '320px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    overflow: 'hidden',
  },
  groups: { display: 'flex', flexWrap: 'wrap', gap: spacing.m },
  group: { display: 'flex', flexDirection: 'column', gap: spacing.s, minWidth: '160px', flexGrow: 1 },
  list: { display: 'flex', flexWrap: 'wrap', gap: spacing.s, margin: 0, padding: 0 },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.s,
    padding: `${spacing.xs} ${spacing.s}`,
    minHeight: '32px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    cursor: 'pointer',
    ':focus-visible': { outline: `2px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '2px' },
  },
  itemSelected: {
    border: `2px solid ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  legend: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.m },
  legendEntry: { display: 'inline-flex', alignItems: 'center', gap: spacing.xs },
  glyph: { display: 'inline-block', width: '12px', height: '12px', flexShrink: 0 },
});

const SHAPE_STYLE: Record<Shape, CSSProperties> = {
  circle: { borderRadius: '50%' },
  square: {},
  triangle: { clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' },
  diamond: { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
};

/** 色と形で種類を示す記号（2D の項目と凡例で共通。3D の形と対応する） */
export function KindGlyph({ color, shape }: { color: string; shape: Shape }) {
  const s = useStyles();
  return <span aria-hidden className={s.glyph} style={{ backgroundColor: color, ...SHAPE_STYLE[shape] }} />;
}

export interface DualViewProps {
  items: readonly ViewItem[];
  kinds: readonly KindDef[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** 一覧の見出し（アクセシブルな名前）。省略時は「項目」 */
  label?: string;
  /** 2D/3D それぞれの表示領域の data-testid（省略時 dual-view-2d / dual-view-3d） */
  testIds?: { view2d?: string; view3d?: string };
}

export function DualView({ items, kinds, selectedId, onSelect, label, testIds }: DualViewProps) {
  const s = useStyles();
  const t = useT();
  const { method } = useViewMode();
  const resolved = resolveKinds(kinds);
  const kindOf = new Map(resolved.map((k) => [k.id, k]));
  const groups: string[] = [];
  for (const it of items) if (!groups.includes(it.group ?? '')) groups.push(it.group ?? '');

  const renderItem = (it: ViewItem) => {
    const k = kindOf.get(it.kind);
    const selected = it.id === selectedId;
    return (
      <li
        key={it.id}
        role="option"
        tabIndex={0}
        aria-selected={selected}
        data-item-id={it.id}
        data-selected={selected}
        data-kind={it.kind}
        className={`${s.item} ${selected ? s.itemSelected : ''}`}
        onClick={() => onSelect?.(it.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(it.id);
          }
        }}
      >
        {k && <KindGlyph color={k.color} shape={k.shape} />}
        <Body1>{it.label}</Body1>
      </li>
    );
  };

  return (
    <div className={s.root} data-view-method={method}>
      {method === '3d' && (
        <div
          className={s.canvas}
          role="img"
          aria-label={t('view.canvas3d')}
          data-testid={testIds?.view3d ?? 'dual-view-3d'}
        >
          <AsyncBoundary errorKey="view.sceneFailed" loadingKey="view.loading" onRetry={scene3d.reload}>
            <Scene3D items={items} kinds={resolved} selectedId={selectedId} onSelect={onSelect} />
          </AsyncBoundary>
        </div>
      )}
      <div data-testid={method === '2d' ? (testIds?.view2d ?? 'dual-view-2d') : undefined}>
        {items.length === 0 ? (
          <Body1>{t('view.empty')}</Body1>
        ) : (
          <div className={s.groups}>
            {groups.map((g) => (
              <div key={g} className={s.group}>
                {g && <Subtitle2 as="h3">{g}</Subtitle2>}
                <ul role="listbox" aria-label={g || label || t('view.items')} className={s.list} style={{ listStyle: 'none' }}>
                  {items.filter((it) => (it.group ?? '') === g).map(renderItem)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={s.legend} role="group" aria-label={t('view.legend')} data-testid="view-legend">
        <Caption1>{t('view.legend')}</Caption1>
        {resolved.map((k) => (
          <span key={k.id} className={s.legendEntry} data-legend-kind={k.id}>
            <KindGlyph color={k.color} shape={k.shape} />
            <Caption1>{k.label}</Caption1>
          </span>
        ))}
      </div>
    </div>
  );
}
