import { useRef, useState } from 'react';
import { Body1, Button, Card, Subtitle1, Title1, Title3, makeStyles, tokens } from '@fluentui/react-components';
import { Open24Regular, Play24Regular } from '@fluentui/react-icons';
import { Architecture2D } from '../app1/Architecture2D';
import { OFFICIAL_SITE_URL } from '../app1/config';
import { app1Text, PERSONAS, type PersonaId } from '../app1/content';
import { Presentation } from '../app1/Presentation';
import { ProductView } from '../app1/ProductView';
import { VideoSection } from '../app1/VideoSection';
import { SURFACE_COLORS } from '../app1/brand';
import { useT } from '../i18n/useT';
import { Narration } from '../narration/Narration';
import { getScript } from '../narration/scripts';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.xl },
  // 製品ビューは最初の画面（スクロールなし）に収める: 左に見出し・CTA・ペルソナ、右に製品ビュー（P-1）または構成図（P-2）
  hero: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: spacing.l,
    alignItems: 'start',
    padding: `${spacing.xl} ${spacing.l}`,
    borderRadius: tokens.borderRadiusXLarge,
    color: '#ffffff',
    backgroundImage: `linear-gradient(135deg, ${SURFACE_COLORS.bg}, #14284f 60%, ${SURFACE_COLORS.screen})`,
  },
  heroTitle: { color: '#ffffff' },
  heroLead: { color: '#e6edf7', maxWidth: '40em' },
  hint: { color: '#c3cfe0' },
  heroText: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  heroVisual: {
    padding: spacing.m,
    borderRadius: tokens.borderRadiusLarge,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  values: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing.m },
  section: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  personas: { display: 'flex', flexWrap: 'wrap', gap: spacing.s, alignItems: 'center' },
  scenes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: spacing.m, margin: 0, padding: 0, listStyle: 'none' },
});

/** App1: Surface Ultra 広告キャンペーンサイト（FR-003 価値説明・CTA・動画、FR-004 利用シーン・プレゼンテーション、FR-005 製品の 2D/3D） */
export function App1() {
  const s = useStyles();
  const t = useT();
  const { lang } = useSettings();
  const text = app1Text[lang];
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
      <div className={s.hero}>
        <div className={s.heroText}>
          <Title1 as="h2" id="app1-heading" className={s.heroTitle}>
            {text.heroHeading}
          </Title1>
          <Body1 as="p" className={s.heroLead}>
            {text.heroLead}
          </Body1>
          <div>
            <Button
              as="a"
              appearance="primary"
              size="large"
              icon={<Open24Regular />}
              iconPosition="after"
              href={OFFICIAL_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="cta-official-site"
            >
              {text.cta}
            </Button>
          </div>
          <Body1 className={s.hint}>{text.ctaHint}</Body1>
          <Title3 as="h3" id="app1-persona" className={s.heroTitle}>
            {text.personaHeading}
          </Title3>
          <div className={s.personas} role="group" aria-labelledby="app1-persona">
            {PERSONAS.map((p) => (
              <Button
                key={p}
                appearance={persona === p ? 'primary' : 'secondary'}
                aria-pressed={persona === p}
                data-testid={`persona-select-${p}`}
                onClick={() => setPersona(p)}
              >
                {text.personaLabel[p]}
              </Button>
            ))}
            <Button ref={startRef} icon={<Play24Regular />} data-testid="presentation-start" onClick={() => setPresenting(true)}>
              {text.start}
            </Button>
          </div>
          <Body1 as="p" className={s.heroLead}>
            {text.personaDesc[persona]}
          </Body1>
        </div>
        <div className={s.heroVisual}>{persona === 'p1' ? <ProductView /> : <Architecture2D />}</div>
      </div>

      <section className={s.section} aria-labelledby="app1-value">
        <Title3 as="h3" id="app1-value">
          {text.valueHeading}
        </Title3>
        <div className={s.values}>
          {text.valuePoints.map((v) => (
            <Card key={v.title}>
              <Subtitle1 as="h4">{v.title}</Subtitle1>
              <Body1>{v.body}</Body1>
            </Card>
          ))}
        </div>
        <Body1 as="p">{t('app1.lead')}</Body1>
      </section>

      <section className={s.section} aria-labelledby="app1-scenes">
        <Title3 as="h3" id="app1-scenes">
          {text.scenesHeading}: {text.personaLabel[persona]}
        </Title3>
        <ol className={s.scenes} data-testid="scene-list">
          {text.scenes[persona].map((sc) => (
            <li key={sc.title}>
              <Card>
                <Subtitle1 as="h4">{sc.title}</Subtitle1>
                <Body1>{sc.body}</Body1>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <VideoSection />

      <section aria-labelledby="narration-heading" className={s.section}>
        <Title3 as="h3" id="narration-heading">
          {t('narration.heading')}
        </Title3>
        <Narration script={getScript('valueIntro', lang)} lang={lang} />
      </section>

      {presenting && <Presentation persona={persona} onClose={close} />}
    </section>
  );
}

