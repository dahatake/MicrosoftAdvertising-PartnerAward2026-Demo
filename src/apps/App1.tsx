import { useRef, useState } from 'react';
import { Body1, Button, Subtitle1, Title3, makeStyles, tokens } from '@fluentui/react-components';
import { Color32Regular, Laptop32Regular, Open24Regular, Play24Regular, Sparkle32Regular } from '@fluentui/react-icons';
import { motion } from 'framer-motion';
import { Architecture2D } from '../app1/Architecture2D';
import { isEmbeddableVideoUrl, OFFICIAL_SITE_URL, OFFICIAL_VIDEO_URL } from '../app1/config';
import { app1Text, PERSONAS, type PersonaId } from '../app1/content';
import { HeroVisual } from '../app1/HeroVisual';
import { Presentation } from '../app1/Presentation';
import { ProductView } from '../app1/ProductView';
import { revealMotion } from '../app1/reveal';
import { VideoSection } from '../app1/VideoSection';
import { usePrefersReducedMotion } from '../camera';
import { useT } from '../i18n/useT';
import { Workspace } from '../layout';
import { PERSONA_LABEL, APP1_PERSONA_LAYOUT } from '../app1/persona-layout';
import { Narration } from '../narration/Narration';
import { getScript } from '../narration/scripts';
import { useSettings } from '../settings/store';
import { brandCardStyle, brandGlowBackground, brandTokens, spacing } from '../theme/theme';
import { BrandToggleButton, PrimaryButton } from '../theme/BrandButton';

const WIDE = '@media (min-width: 840px)';

/** 価値説明のカードの飾りのアイコン（文言の順に対応。飾りなので支援技術には伝えない） */
const VALUE_ICONS = [Sparkle32Regular, Color32Regular, Laptop32Regular] as const;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.xl },

  // ---------- NFR-UX-004 AC-091: 全幅のヒーロー ----------
  // シェルの本文の枠（中央寄せ・最大幅）から、ビューポートの全幅へ広げる（full-bleed）。
  // 背景はテーマによらない暗い面（PARAM-022）と光のグラデーション（PARAM-023）。文字は暗い面の上の文字の色。
  hero: {
    ...brandGlowBackground,
    position: 'relative',
    boxSizing: 'border-box',
    width: '100vw',
    maxWidth: '100vw',
    marginInline: 'calc(50% - 50vw)',
    overflow: 'hidden',
  },
  heroInner: {
    boxSizing: 'border-box',
    maxWidth: '1200px',
    marginInline: 'auto',
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'center',
    gap: spacing.xl,
    padding: `${spacing.xl} ${spacing.m}`,
    [WIDE]: {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      padding: `calc(${spacing.xl} * 2) ${spacing.l}`,
    },
  },
  heroText: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: spacing.m, minWidth: 0 },
  eyebrow: {
    margin: 0,
    color: brandTokens.glow3,
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  // 大きな見出し（Segoe 系の display。320px でも欠けないよう clamp で縮め、長い語は折り返す）
  heroTitle: {
    margin: 0,
    color: brandTokens.foregroundOnDark,
    fontFamily: brandTokens.fontFamilyDisplay,
    fontSize: 'clamp(2.25rem, 1.25rem + 5vw, 4.5rem)',
    lineHeight: 1.05,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '-0.02em',
    maxWidth: '100%',
  },
  heroLead: {
    margin: 0,
    color: brandTokens.foregroundOnDark,
    fontSize: 'clamp(1.0625rem, 1rem + 0.5vw, 1.375rem)',
    lineHeight: 1.45,
    maxWidth: '34em',
  },
  ctaRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.m, marginTop: spacing.s, maxWidth: '100%' },
  cta: { maxWidth: '100%', whiteSpace: 'normal', textAlign: 'center' },
  hint: { color: brandTokens.foregroundOnDarkMuted, fontSize: tokens.fontSizeBase200, lineHeight: tokens.lineHeightBase200 },
  heroVisual: { minWidth: 0 },

  // ---------- ペルソナの選択（FR-004）。角丸・影の帯 ----------
  personaBar: {
    ...brandCardStyle,
    borderRadius: brandTokens.radiusCardLarge,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s,
    padding: spacing.m,
    [WIDE]: { padding: spacing.l },
  },
  personaHeading: { margin: 0 },
  personas: { display: 'flex', flexWrap: 'wrap', gap: spacing.s, alignItems: 'center' },
  personaDesc: { margin: 0, color: tokens.colorNeutralForeground2 },

  // ---------- NFR-UX-004 AC-092: 価値説明のカード ----------
  values: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: spacing.m },
  section: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  valueCard: {
    ...brandCardStyle,
    borderRadius: brandTokens.radiusCardLarge,
    boxShadow: tokens.shadow16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    margin: 0,
    backgroundImage: `linear-gradient(180deg, ${tokens.colorNeutralBackground1} 55%, ${tokens.colorBrandBackground2} 100%)`,
    transitionProperty: 'box-shadow',
    transitionDuration: tokens.durationNormal,
    ':hover': { boxShadow: tokens.shadow28 },
  },
  // カードの上部の画像の役の面（暗い面に光のグラデーション。アイコンは飾り）
  valueArt: {
    ...brandGlowBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '112px',
    '& svg': { width: '48px', height: '48px' },
  },
  valueBody: { display: 'flex', flexDirection: 'column', gap: spacing.s, padding: spacing.m },
  cardTitle: { margin: 0 },
  cardText: { margin: 0, color: tokens.colorNeutralForeground2 },

  // ---------- NFR-UX-004 AC-092: 利用シーンのカード ----------
  scenes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
    gap: spacing.m,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  sceneCard: {
    ...brandCardStyle,
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s,
    height: '100%',
    boxSizing: 'border-box',
    padding: `${spacing.l} ${spacing.m} ${spacing.m}`,
    backgroundImage: `radial-gradient(120% 80% at 100% 0%, ${tokens.colorBrandBackground2} 0%, transparent 60%), linear-gradient(${tokens.colorNeutralBackground1}, ${tokens.colorNeutralBackground1})`,
    // 上辺の光の帯（PARAM-023 の色）
    '::before': {
      content: '""',
      position: 'absolute',
      insetInline: 0,
      top: 0,
      height: spacing.xs,
      backgroundImage: `linear-gradient(90deg, ${brandTokens.glow1}, ${brandTokens.glow2}, ${brandTokens.glow3})`,
    },
  },
  sceneNo: {
    alignSelf: 'flex-start',
    padding: `${spacing.xs} ${spacing.s}`,
    borderRadius: brandTokens.radiusPill,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
  visualPanel: {
    ...brandCardStyle,
    padding: spacing.m,
  },
});

/** App1: Surface Ultra 広告キャンペーンサイト（FR-003 価値説明・CTA・動画、FR-004 利用シーン・プレゼンテーション、FR-005 製品の 2D/3D、NFR-UX-004 ヒーロー・カード） */
export function App1() {
  const s = useStyles();
  const t = useT();
  const { lang } = useSettings();
  const text = app1Text[lang];
  const reduce = usePrefersReducedMotion();
  const [persona, setPersona] = useState<PersonaId>('p1');
  const [presenting, setPresenting] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setPresenting(false);
    // 開始ボタンへフォーカスを戻す（スクロール位置は動かさない）
    requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
  };

  return (
    <section className={s.root} data-testid="app-root-app1" aria-labelledby="app1-heading">
      {/* NFR-UX-004 AC-091: 最初の画面の全幅のヒーロー（見出し・副題・主 CTA・製品のビジュアル） */}
      <div className={s.hero} data-testid="app1-hero">
        <div className={s.heroInner}>
          <div className={s.heroText}>
            <p className={s.eyebrow}>{text.heroEyebrow}</p>
            <h2 id="app1-heading" className={s.heroTitle}>
              {text.heroHeading}
            </h2>
            <p className={s.heroLead}>{text.heroLead}</p>
            <div className={s.ctaRow}>
              {/* FR-003 AC-007 公式サイトへの導線（新しいタブ）。NFR-UX-004 AC-089: 主色・ピル形の主ボタン */}
              <PrimaryButton
                as="a"
                size="large"
                icon={<Open24Regular />}
                iconPosition="after"
                href={OFFICIAL_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="cta-official-site"
                className={s.cta}
              >
                {text.cta}
              </PrimaryButton>
              <span className={s.hint}>{text.ctaHint}</span>
            </div>
          </div>
          <HeroVisual className={s.heroVisual} label={text.heroVisualLabel} data-testid="app1-hero-visual" />
        </div>
      </div>

      {/* FR-004 ペルソナの選択とプレゼンテーションの開始 */}
      <div className={s.personaBar} data-testid="app1-persona-bar">
        <Title3 as="h3" id="app1-persona" className={s.personaHeading}>
          {text.personaHeading}
        </Title3>
        <div className={s.personas} role="group" aria-labelledby="app1-persona">
          {PERSONAS.map((p) => (
            <BrandToggleButton
              key={p}
              appearance="secondary"
              checked={persona === p}
              data-testid={`persona-select-${p}`}
              onClick={() => setPersona(p)}
            >
              {text.personaLabel[p]}
            </BrandToggleButton>
          ))}
          <Button ref={startRef} shape="circular" icon={<Play24Regular />} data-testid="presentation-start" onClick={() => setPresenting(true)}>
            {text.start}
          </Button>
        </div>
        <Body1 as="p" className={s.personaDesc}>
          {text.personaDesc[persona]}
        </Body1>
      </div>

      <Workspace
        screenId="app1"
        persona={PERSONA_LABEL[persona]}
        personaDefaults={APP1_PERSONA_LAYOUT}
        panels={[
          {
            id: 'visual',
            title: t('app1.panel.visual'),
            content: <div className={s.visualPanel}>{persona === 'p1' ? <ProductView /> : <Architecture2D />}</div>,
          },
          {
            id: 'scenes',
            title: `${text.scenesHeading}: ${text.personaLabel[persona]}`,
            content: (
              // NFR-UX-004 AC-092 利用シーンのカード（角丸・影・グラデーション、出現の動きは reduced-motion で静止）
              <ol className={s.scenes} data-testid="scene-list">
                {text.scenes[persona].map((sc, i) => (
                  <motion.li key={`${persona}-${sc.title}`} {...revealMotion(reduce, i)}>
                    <article className={s.sceneCard} data-testid="scene-card">
                      <span className={s.sceneNo} aria-hidden>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <Subtitle1 as="h4" className={s.cardTitle}>
                        {sc.title}
                      </Subtitle1>
                      <Body1 as="p" className={s.cardText}>
                        {sc.body}
                      </Body1>
                    </article>
                  </motion.li>
                ))}
              </ol>
            ),
          },
          {
            id: 'values',
            title: text.valueHeading,
            content: (
              <div className={s.section}>
                <div className={s.values}>
                  {/* NFR-UX-004 AC-092 価値説明のカード（上部に暗い面と光の画像の役の面） */}
                  {text.valuePoints.map((v, i) => {
                    const Icon = VALUE_ICONS[i % VALUE_ICONS.length];
                    return (
                      <motion.article key={v.title} className={s.valueCard} data-testid="value-card" {...revealMotion(reduce, i)}>
                        <div className={s.valueArt} aria-hidden>
                          <Icon />
                        </div>
                        <div className={s.valueBody}>
                          <Subtitle1 as="h4" className={s.cardTitle}>
                            {v.title}
                          </Subtitle1>
                          <Body1 as="p" className={s.cardText}>
                            {v.body}
                          </Body1>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
                <Body1 as="p">{t('app1.lead')}</Body1>
              </div>
            ),
          },
          ...(isEmbeddableVideoUrl(OFFICIAL_VIDEO_URL) ? [{ id: 'video', title: text.videoHeading, content: <VideoSection /> }] : []),
          {
            id: 'narration',
            title: t('narration.heading'),
            content: <Narration script={getScript('valueIntro', lang)} lang={lang} />,
          },
        ]}
      />

      {presenting && <Presentation persona={persona} onClose={close} />}
    </section>
  );
}
