// エンティティの関連の可視化（FR-012）。関係図は 2D が既定で、表示方法を 3D にすると、同じノード・関連線に 3D の空間配置が加わる。
// 3D は共通の DualView（FR-008）を使う。ノードの集合・選択は 2D/3D で同じ（選択は呼び出し側が持つ）。
import { makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { DualView, resolveKinds, useViewMode, type KindDef, type ViewItem } from '../view';
import type { RelNode, Relations } from './relations';
import { KIND_ORDER, kindLabelKey } from './kinds';

const COL_W = 176;
const NODE_W = 160;
const NODE_H = 36;
const ROW_H = 46;
const PAD = 8;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  svg: { width: '100%', height: 'auto', display: 'block' },
  edge: { stroke: tokens.colorNeutralStroke1, strokeWidth: 1.5 },
  edgeActive: { stroke: tokens.colorBrandStroke1, strokeWidth: 2.5 },
  node: { cursor: 'pointer', outline: 'none' },
  box: { fill: tokens.colorNeutralBackground1, stroke: tokens.colorNeutralStroke1, strokeWidth: 1 },
  boxSelected: { fill: tokens.colorBrandBackground2, stroke: tokens.colorBrandStroke1, strokeWidth: 3 },
  focusRing: { fill: 'none', stroke: tokens.colorStrokeFocus2, strokeWidth: 2 },
  text: { fill: tokens.colorNeutralForeground1, fontSize: '11px', fontFamily: tokens.fontFamilyBase },
  kindText: { fill: tokens.colorNeutralForeground2, fontSize: '9px', fontFamily: tokens.fontFamilyBase },
});

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export interface RelationViewProps {
  relations: Relations;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/** 階層（列）ごとに上から並べた位置 */
function place(nodes: readonly RelNode[]) {
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const r = rows.get(n.depth) ?? 0;
    rows.set(n.depth, r + 1);
    pos.set(n.id, { x: PAD + (n.depth + 1) * COL_W, y: PAD + r * ROW_H });
  }
  const maxRows = Math.max(1, ...rows.values());
  return { pos, width: PAD * 2 + 6 * COL_W - (COL_W - NODE_W), height: PAD * 2 + maxRows * ROW_H };
}

export function RelationView({ relations, selectedId, onSelect }: RelationViewProps) {
  const s = useStyles();
  const t = useT();
  const { method } = useViewMode();
  const { nodes, edges } = relations;
  const kinds: KindDef[] = KIND_ORDER.map((k) => ({ id: k, label: t(kindLabelKey(k)) }));
  const resolved = new Map(resolveKinds(kinds).map((k) => [k.id, k]));
  const { pos, width, height } = place(nodes);
  const items: ViewItem[] = nodes.map((n) => ({ id: n.id, label: n.label, kind: n.kind, group: t(kindLabelKey(n.kind)) }));
  const activate = (id: string) => onSelect?.(id);

  return (
    <div
      className={s.root}
      role="group"
      aria-label={t('app2.relationLabel')}
      data-testid={method === '3d' ? 'relation-view-3d' : 'relation-view'}
      data-view-method={method}
    >
      {method === '3d' && nodes.length > 0 && (
        <DualView
          items={items}
          kinds={kinds}
          selectedId={selectedId}
          onSelect={onSelect}
          label={t('app2.relation')}
          testIds={{ view2d: 'relation-dualview-2d', view3d: 'relation-dualview-3d' }}
        />
      )}
      {nodes.length > 0 && (
        <svg className={s.svg} viewBox={`0 0 ${width} ${height}`} role="radiogroup" aria-label={t('app2.relationLabel')}>
          {edges.map((e) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const active = selectedId === e.from || selectedId === e.to;
            return (
              <line
                key={`${e.from}>${e.to}`}
                data-testid="relation-edge"
                data-from={e.from}
                data-to={e.to}
                className={active ? s.edgeActive : s.edge}
                x1={a.x + NODE_W}
                y1={a.y + NODE_H / 2}
                x2={b.x}
                y2={b.y + NODE_H / 2}
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos.get(n.id)!;
            const selected = n.id === selectedId;
            const k = resolved.get(n.kind);
            return (
              <g
                key={n.id}
                role="radio"
                tabIndex={0}
                aria-checked={selected}
                aria-label={`${t(kindLabelKey(n.kind))}: ${n.label}`}
                data-testid="relation-node"
                data-entity-id={n.id}
                data-kind={n.kind}
                className={s.node}
                transform={`translate(${p.x} ${p.y})`}
                onClick={() => activate(n.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activate(n.id);
                  }
                }}
              >
                <title>{n.label}</title>
                <rect width={NODE_W} height={NODE_H} rx={6} className={selected ? s.boxSelected : s.box} />
                <rect width={6} height={NODE_H} rx={3} fill={k?.color} />
                <text x={14} y={14} className={s.kindText}>
                  {t(kindLabelKey(n.kind))}
                </text>
                <text x={14} y={28} className={s.text}>
                  {clip(n.label, 14)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
