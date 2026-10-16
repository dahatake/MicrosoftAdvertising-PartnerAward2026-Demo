// 製品ビュー（FR-005）: 既定は 2D（CSS の図とアニメーション）、表示方法が 3D のときは 3D（遅延読み込み）。
// 説明文は 2D/3D どちらでも同じものを表示し、3D が使えない・描画に失敗したときは 2D と説明文だけになる（AC-014）。
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Body1, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { useViewMode } from '../view/useViewMode';
import { SURFACE_COLORS } from './brand';
import { app1Text } from './content';

const ProductScene3D = lazy(() => import('./ProductScene3D'));

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  stage: {
    height: '320px',
    borderRadius: tokens.borderRadiusXLarge,
    overflow: 'hidden',
    backgroundImage: `linear-gradient(160deg, ${SURFACE_COLORS.bg}, #14284f)`,
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
  screen: {
    height: '150px',
    borderRadius: '10px 10px 2px 2px',
    border: `4px solid ${SURFACE_COLORS.body}`,
    backgroundImage: `radial-gradient(circle at 30% 40%, ${SURFACE_COLORS.accent}, transparent 45%), radial-gradient(circle at 75% 60%, ${SURFACE_COLORS.accent2}, transparent 40%), linear-gradient(135deg, ${SURFACE_COLORS.screen}, ${SURFACE_COLORS.screenGlow})`,
    boxShadow: `0 0 40px ${SURFACE_COLORS.screenGlow}`,
  },
  base: {
    height: '14px',
    margin: '0 -14px',
    borderRadius: '2px 2px 14px 14px',
    backgroundImage: `linear-gradient(${SURFACE_COLORS.pad}, ${SURFACE_COLORS.body})`,
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
    <div className={s.stage} role="img" aria-label={label} data-testid={testId}>
      <div className={s.device} aria-hidden>
        <div className={s.screen} />
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
  return (
    <div className={s.root} data-view-method={method}>
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
