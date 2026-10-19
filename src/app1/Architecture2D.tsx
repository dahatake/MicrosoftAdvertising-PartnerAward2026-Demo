// 製品の構成図（2D）: 構成要素をノード、関係を関連線で示し、同じ内容を表と要約でも見られる（AC-068）。
// 配置は 3 行 × 3 列の格子（左列＝入力側の部品、右列＝環境）。中心のプロセッサを囲み、開発環境→クラウドは縦の一直線で示す。
// 形は役割で分ける: 楕円＝中心、四角＝製品の部品、角丸＝開発・クラウドの環境。文字のラベルも併せて示し、色だけで区別しない。
import { Body1, Subtitle2, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens } from '@fluentui/react-components';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { app1Text, type NodeId } from './content';

const COL_LEFT = 110;
const COL_CENTER = 300;
const COL_RIGHT = 490;
const ROW_TOP = 70;
const ROW_MIDDLE = 195;
const ROW_BOTTOM = 320;

const POS: Record<NodeId, { x: number; y: number }> = {
  display: { x: COL_LEFT, y: ROW_TOP },
  cpu: { x: COL_CENTER, y: ROW_MIDDLE },
  npu: { x: COL_RIGHT, y: ROW_TOP },
  memory: { x: COL_LEFT, y: ROW_BOTTOM },
  dev: { x: COL_RIGHT, y: ROW_MIDDLE },
  cloud: { x: COL_RIGHT, y: ROW_BOTTOM },
};
const SHAPE: Record<NodeId, 'hub' | 'part' | 'env'> = {
  display: 'part',
  cpu: 'hub',
  npu: 'part',
  memory: 'part',
  dev: 'env',
  cloud: 'env',
};

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  svg: {
    width: '100%',
    maxWidth: '640px',
    height: 'auto',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  link: { stroke: tokens.colorNeutralForeground2, strokeWidth: 2 },
  node: { fill: tokens.colorNeutralBackground1, stroke: tokens.colorBrandStroke1, strokeWidth: 2 },
  hub: { fill: tokens.colorBrandBackground2, stroke: tokens.colorBrandStroke1, strokeWidth: 3 },
  label: { fill: tokens.colorNeutralForeground1, fontSize: '14px', fontFamily: tokens.fontFamilyBase },
});

export function Architecture2D({ testId = 'architecture-2d' }: { testId?: string }) {
  const s = useStyles();
  const { lang } = useSettings();
  const text = app1Text[lang];
  return (
    <div className={s.root} data-testid={testId}>
      <Subtitle2 as="h3">{text.archHeading}</Subtitle2>
      <svg className={s.svg} viewBox="0 0 600 390" role="img" aria-label={`${text.archHeading}: ${text.archSummary}`}>
        {text.links.map((l) => (
          <line key={`${l.from}-${l.to}`} className={s.link} x1={POS[l.from].x} y1={POS[l.from].y} x2={POS[l.to].x} y2={POS[l.to].y} />
        ))}
        {(Object.keys(POS) as NodeId[]).map((id) => {
          const { x, y } = POS[id];
          const shape = SHAPE[id];
          return (
            <g key={id} data-node-id={id}>
              {shape === 'hub' ? (
                <ellipse className={s.hub} cx={x} cy={y} rx={80} ry={40} />
              ) : (
                <rect className={s.node} x={x - 70} y={y - 30} width={140} height={60} rx={shape === 'env' ? 30 : 4} />
              )}
              <text className={s.label} x={x} y={y + 5} textAnchor="middle">
                {text.nodes[id]}
              </text>
            </g>
          );
        })}
      </svg>
      <Body1>{text.archSummary}</Body1>
      <Table size="small" aria-label={text.archCaption}>
        <TableHeader>
          <TableRow>
            {text.archCols.map((c) => (
              <TableHeaderCell key={c}>{c}</TableHeaderCell>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {text.links.map((l) => (
            <TableRow key={`${l.from}-${l.to}`}>
              <TableCell>{text.nodes[l.from]}</TableCell>
              <TableCell>{text.nodes[l.to]}</TableCell>
              <TableCell>{l.label}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
