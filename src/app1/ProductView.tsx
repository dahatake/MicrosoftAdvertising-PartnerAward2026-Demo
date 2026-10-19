// 製品ビュー（FR-005）: 既定は 2D（CSS の図とアニメーション）、表示方法が 3D のときは 3D（遅延読み込み）。
// 説明文は 2D/3D どちらでも同じものを表示し、3D が使えない・描画に失敗したときは 2D と説明文だけになる（AC-014）。
import { Component, lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { Body1, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { useSettings } from '../settings/store';
import { brandGlowBackground, spacing } from '../theme/theme';
import { useViewMode } from '../view/useViewMode';
import { DEFAULT_FINISH, metalGradient, PRODUCT_FINISHES, PRODUCT_GLASS, withAlpha } from './brand';
import { app1Text } from './content';

const ProductScene3D = lazy(() => import('./ProductScene3D'));

// NFR-UX-004 AC-094: 2D の製品図も 3D と同じ製品色（既定は Dune）の金属の面で描き、暗い面（PARAM-022）の舞台の上で
// 縁の色（edge）の細い縁取りと光の青のリムの光で外形を見分けられるようにする。
const finish = PRODUCT_FINISHES[DEFAULT_FINISH];
const [glow1, glow2, glow3] = PRODUCT_GLASS.glow;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  stage: {
    ...brandGlowBackground,
    height: '320px',
    borderRadius: tokens.borderRadiusXLarge,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    perspective: '900px',
    '& canvas': { display: 'block', width: '100%', height: '100%' },
    '& canvas:focus-visible': { outline: `3px solid ${tokens.colorStrokeFocus2}`, outlineOffset: '-3px' },
  },
  device: {
    position: 'relative',
    width: '260px',
    transformStyle: 'preserve-3d',
    transform: 'rotateX(8deg) rotateY(-18deg)',
    animationName: {
      from: { transform: 'rotateX(8deg) rotateY(-18deg)' },
      to: { transform: 'rotateX(8deg) rotateY(18deg)' },
    },
    animationDuration: '6s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  },
  // 画面の蓋: 金属の枠（製品色のグラデーション）＋縁取り＋背後の光（リム）
  lid: {
    padding: '6px',
    borderRadius: '12px 12px 3px 3px',
    backgroundImage: metalGradient(finish),
    boxShadow: `0 0 0 1px ${withAlpha(finish.edge, 0.6)}, 0 0 32px ${withAlpha(glow2, 0.35)}`,
  },
  // 表示面: 黒の細い縁の内側に光のグラデーション（PARAM-023）と、ガラスの映り込みの斜めのハイライト
  screen: {
    height: '144px',
    borderRadius: '6px 6px 1px 1px',
    border: `3px solid ${PRODUCT_GLASS.bezel}`,
    backgroundImage: [
      'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 38%)',
      `radial-gradient(circle at 28% 80%, ${withAlpha(glow1, 0.95)}, transparent 62%)`,
      `radial-gradient(circle at 70% 40%, ${withAlpha(glow2, 0.75)}, transparent 46%)`,
      `radial-gradient(circle at 86% 16%, ${withAlpha(glow3, 0.6)}, transparent 30%)`,
      `linear-gradient(135deg, ${PRODUCT_GLASS.base}, ${PRODUCT_GLASS.baseEnd})`,
    ].join(', '),
  },
  // 本体の前端: 金属の面と、上端のハイライト・縁取り・床への影
  base: {
    height: '14px',
    margin: '0 -16px',
    borderRadius: '2px 2px 14px 14px',
    backgroundImage: metalGradient(finish, 180),
    boxShadow: `inset 0 1px 0 ${withAlpha(finish.highlight, 0.9)}, 0 0 0 1px ${withAlpha(finish.edge, 0.6)}, 0 18px 28px rgba(0, 0, 0, 0.5)`,
  },
  note: { color: tokens.colorNeutralForeground2 },
});

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface ProductViewProps {
  /** 2D/3D の data-testid（省略時 product-view-2d / product-view-3d-canvas） */
  testIds?: { view2d?: string; view3d?: string };
  /** 説明文を出すか（プレゼンテーションでは出さない） */
  showDescription?: boolean;
}

function Device2D({ testId, label }: { testId: string; label: string }) {
  const s = useStyles();
  return (
    <div className={s.stage} role="img" aria-label={label} data-testid={testId} data-product-finish={finish.name}>
      <div className={s.device} aria-hidden>
        <div className={s.lid}>
          <div className={s.screen} />
        </div>
        <div className={s.base} />
      </div>
    </div>
  );
}

export function ProductView({ testIds, showDescription = true }: ProductViewProps) {
  const s = useStyles();
  const t = useT();
  const { lang } = useSettings();
  const { method } = useViewMode();
  const text = app1Text[lang];
  const id2d = testIds?.view2d ?? 'product-view-2d';
  const id3d = testIds?.view3d ?? 'product-view-3d-canvas';
  const view2d = <Device2D testId={id2d} label={text.product2dLabel} />;
  // 製品ビューはレイアウトのパネル内にあり、最初の画面の外になることがある。3D を選んだら画面内へ寄せる（FR-005 AC-013）。
  // 全画面のプレゼンテーション（説明文なし）では動かさない
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (method === '3d' && showDescription) rootRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [method, showDescription]);
  return (
    <div className={s.root} data-view-method={method} ref={rootRef}>
      {method === '3d' ? (
        <div className={s.stage}>
          <Boundary fallback={view2d}>
            <Suspense fallback={<Caption1>{t('view.loading')}</Caption1>}>
              <ProductScene3D label={text.product3dLabel} testId={id3d} />
            </Suspense>
          </Boundary>
        </div>
      ) : (
        view2d
      )}
      {method === '3d' && <Caption1 className={s.note}>{text.product3dHelp}</Caption1>}
      {showDescription && <Body1 data-testid="product-description">{text.productDesc}</Body1>}
    </div>
  );
}
