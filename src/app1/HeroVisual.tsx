// App1 のヒーローの製品のビジュアル（NFR-UX-004 AC-091）: CSS だけで描いた製品のシルエット（画像を読み込まない。初期表示を遅くしない）。
// 要素そのものが role="img" とアクセシブルな名前を持つ（data-testid は呼び出し側が渡す。ヒーローでは app1-hero-visual）。
// 製品の色は 2D の製品ビュー（ProductView）と同じ SURFACE_COLORS（src/app1/brand.ts。製品色は NFR-UX-004 AC-094 の項目が決める）。
// 背面の光は、暗い面の上の光のグラデーション（PARAM-023）と同じトークン。ロゴ・シンボルは描かない（NFR-UX-005）。
import { makeStyles, mergeClasses } from '@fluentui/react-components';
import { brandTokens } from '../theme/theme';
import { SURFACE_COLORS } from './brand';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    width: '100%',
    maxWidth: '560px',
    aspectRatio: '16 / 11',
    marginInline: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // 製品の背面の光（ヒーローの帯の光と重ねても、文字のない範囲だけを明るくする）
    backgroundImage: `radial-gradient(closest-side, ${brandTokens.glow2Soft}, ${brandTokens.glow1Soft} 55%, transparent 100%)`,
  },
  device: {
    position: 'relative',
    width: '84%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    transform: 'perspective(1400px) rotateX(6deg)',
    animationName: {
      from: { transform: 'perspective(1400px) rotateX(6deg) translateY(0)' },
      to: { transform: 'perspective(1400px) rotateX(6deg) translateY(-8px)' },
    },
    animationDuration: '6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  },
  lid: {
    position: 'relative',
    width: '88%',
    aspectRatio: '3 / 2',
    boxSizing: 'border-box',
    borderRadius: '14px 14px 4px 4px',
    border: `6px solid ${SURFACE_COLORS.body}`,
    backgroundColor: SURFACE_COLORS.screen,
    // 画面の壁紙（抽象的な光の面。ロゴ・文字は描かない）
    backgroundImage: [
      `radial-gradient(circle at 28% 38%, ${SURFACE_COLORS.accent}, transparent 46%)`,
      `radial-gradient(circle at 74% 64%, ${SURFACE_COLORS.accent2}, transparent 42%)`,
      `linear-gradient(135deg, ${SURFACE_COLORS.screen}, ${SURFACE_COLORS.screenGlow})`,
    ].join(', '),
    boxShadow: `0 0 0 1px ${SURFACE_COLORS.pad}, 0 24px 80px ${brandTokens.glow1Soft}`,
    overflow: 'hidden',
    // 画面のガラスの映り込み
    '::after': {
      content: '""',
      position: 'absolute',
      inset: 0,
      backgroundImage: `linear-gradient(120deg, ${brandTokens.glow3Soft} 0%, transparent 38%)`,
    },
  },
  deck: {
    position: 'relative',
    width: '100%',
    height: '14px',
    borderRadius: '2px 2px 16px 16px',
    backgroundImage: `linear-gradient(${SURFACE_COLORS.pad}, ${SURFACE_COLORS.body})`,
    boxShadow: `0 1px 0 ${SURFACE_COLORS.pad}`,
    // 開口部（指をかける切り欠き）
    '::before': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: 0,
      width: '16%',
      height: '5px',
      transform: 'translateX(-50%)',
      borderRadius: '0 0 6px 6px',
      backgroundColor: SURFACE_COLORS.body,
    },
  },
  shadow: {
    width: '92%',
    height: '20px',
    marginTop: '4px',
    backgroundImage: `radial-gradient(closest-side, ${brandTokens.surfaceDark1}, transparent)`,
  },
});

export interface HeroVisualProps {
  /** アクセシブルな名前（画面の言語の文言） */
  label: string;
  className?: string;
  'data-testid'?: string;
}

/** ヒーローの製品のシルエット（role="img"。子は飾りなので支援技術には名前だけが伝わる） */
export function HeroVisual({ label, className, 'data-testid': testId }: HeroVisualProps) {
  const s = useStyles();
  return (
    <div className={mergeClasses(s.root, className)} role="img" aria-label={label} data-testid={testId}>
      <div className={s.device} aria-hidden>
        <div className={s.lid} />
        <div className={s.deck} />
        <div className={s.shadow} />
      </div>
    </div>
  );
}
