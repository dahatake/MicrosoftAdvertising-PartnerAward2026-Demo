// 製品の構成図（2D）: 構成要素をノード、関係を関連線で示し、同じ内容を表と要約でも見られる（AC-068）。
// 要素は形（角丸・楕円・四角）と文字のラベルで区別し、色だけで示さない。
import { Body1, Subtitle2, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, makeStyles, tokens } from '@fluentui/react-components';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { app1Text, type NodeId } from './content';

const POS: Record<NodeId, { x: number; y: number }> = {
  display: { x: 90, y: 60 },
  cpu: { x: 300, y: 150 },
  npu: { x: 510, y: 60 },
  memory: { x: 90, y: 240 },
  dev: { x: 510, y: 240 },
  cloud: { x: 510, y: 330 },
};
const SHAPE: Record<NodeId, 'round' | 'circle' | 'square'> = {
  display: 'square',
  cpu: 'circle',
  npu: 'round',
  memory: 'square',
  dev: 'round',
  cloud: 'circle',
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
              {shape === 'circle' ? (
                <ellipse className={s.node} cx={x} cy={y} rx={70} ry={34} />
              ) : (
                <rect className={s.node} x={x - 70} y={y - 30} width={140} height={60} rx={shape === 'round' ? 24 : 4} />
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
