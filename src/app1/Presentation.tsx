// ペルソナ別の全画面プレゼンテーション（FR-004）。場面（利用シーン）を順に表示し、場面転換で選択中のカメラワーク（FR-009）の動きを使う。
// 「動きを減らす」のときは静止する（useCameraWork の keyframes が空）。キーボード: ← → で前後、Esc で閉じる、Tab はダイアログ内で循環。
import { useEffect, useRef, useState } from 'react';
import { Body1, Button, Caption1, Subtitle1, Title1, makeStyles, tokens } from '@fluentui/react-components';
import { ArrowLeft24Regular, ArrowRight24Regular, Dismiss24Regular, Stop24Regular } from '@fluentui/react-icons';
import { useCameraWork } from '../camera/useCameraWork';
import { Narration } from '../narration/Narration';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { Architecture2D } from './Architecture2D';
import { app1Text, type PersonaId } from './content';
import { ProductView } from './ProductView';

const useStyles = makeStyles({
  root: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.m,
    padding: spacing.l,
    boxSizing: 'border-box',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    overflow: 'auto',
    ':focus-visible': { outline: 'none' },
  },
  bar: { display: 'flex', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  grow: { flexGrow: 1 },
  stageWrap: { flexGrow: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stage: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: spacing.l,
    alignItems: 'center',
    width: '100%',
    maxWidth: '1100px',
  },
  text: { display: 'flex', flexDirection: 'column', gap: spacing.m },
});

export interface PresentationProps {
  persona: PersonaId;
  onClose: () => void;
}

export function Presentation({ persona, onClose }: PresentationProps) {
  const s = useStyles();
  const { lang } = useSettings();
  const text = app1Text[lang];
  const scenes = text.scenes[persona];
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cam = useCameraWork();
  const scene = scenes[index];

  const go = (d: number) => setIndex((i) => Math.min(scenes.length - 1, Math.max(0, i + d)));

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  // 場面転換のカメラワーク（reduced のときは keyframes が空で、何も動かさない）
  useEffect(() => {
    const el = stageRef.current;
    const frames = cam.animation2d.keyframes;
    if (!el || !frames.length || typeof el.animate !== 'function') return;
    const a = el.animate(frames, { ...cam.animation2d.options, iterations: 1, direction: 'normal', fill: 'none' });
    return () => a.cancel();
    // 場面（index）と選択中のカメラワークが変わったときだけ動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, cam.key, cam.reducedMotion]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Tab' && rootRef.current) {
        const f = Array.from(rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, canvas[tabindex], [tabindex]:not([tabindex="-1"])'));
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === rootRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, scenes.length]);

  return (
    <div
      ref={rootRef}
      className={s.root}
      role="dialog"
      aria-modal="true"
      aria-label={`${text.pres.label}: ${text.personaLabel[persona]}`}
      tabIndex={-1}
      data-testid="presentation-root"
      data-persona={persona}
      data-camera-key={cam.key}
      data-reduced-motion={cam.reducedMotion}
    >
      <div className={s.bar}>
        <Subtitle1 as="h2">
          {text.pres.label}: {text.personaLabel[persona]}
        </Subtitle1>
        <span className={s.grow} />
        <Caption1 data-testid="presentation-position">
          {index + 1} / {scenes.length}
        </Caption1>
        <Button icon={<Stop24Regular />} data-testid="presentation-stop" onClick={onClose}>
          {text.pres.stop}
        </Button>
        <Button icon={<Dismiss24Regular />} appearance="subtle" data-testid="presentation-close" aria-label={text.pres.close} onClick={onClose} />
      </div>
      <div className={s.stageWrap}>
        <div ref={stageRef} className={s.stage}>
          <div className={s.text} data-testid="presentation-scene" aria-live="polite">
            <Title1 as="h3">{scene.title}</Title1>
            <Body1>{scene.body}</Body1>
          </div>
          {persona === 'p1' ? (
            <ProductView showDescription={false} testIds={{ view2d: 'presentation-product-2d', view3d: 'presentation-product-3d' }} />
          ) : (
            <Architecture2D testId="presentation-architecture" />
          )}
        </div>
      </div>
      <Narration key={`${persona}-${index}-${lang}`} script={scene.body} lang={lang} />
      <div className={s.bar}>
        <Button icon={<ArrowLeft24Regular />} data-testid="presentation-prev" disabled={index === 0} onClick={() => go(-1)}>
          {text.pres.prev}
        </Button>
        <Button icon={<ArrowRight24Regular />} iconPosition="after" appearance="primary" data-testid="presentation-next" disabled={index === scenes.length - 1} onClick={() => go(1)}>
          {text.pres.next}
        </Button>
        <Caption1>{text.pres.hint}</Caption1>
      </div>
    </div>
  );
}
