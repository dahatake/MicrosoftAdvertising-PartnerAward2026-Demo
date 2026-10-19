// CameraSettings: カメラワークの選択パネル（両アプリ共通）。かんたん選択（雰囲気のスライダーと 9 つのプリセット）と
// くわしく選択（4 要素）。選択は即座に大きなプレビューと「いま: …」に反映され、localStorage に保存される。
// data-testid: camera-simple-slider / camera-preset-<n> / camera-mini-preview / camera-now / camera-detail-<part> / camera-combo / camera-preview
import { useRef, useState } from 'react';
import { Button, Caption1, Subtitle2, Body1Strong, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { spacing } from '../theme/theme';
import { useT } from '../i18n/useT';
import { ChoiceButtons } from '../ui/ChoiceButtons';
import { useSettings } from '../settings/store';
import { CAMERA_LABELS, TECH_NAMES } from './labels';
import { PART_VALUES, PARTS, PRESETS, comboKey, isAvailable, type CameraCombo, type CameraPart } from './model';
import { useCameraAnimation2d, useCameraWork } from './useCameraWork';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.m },
  group: { display: 'flex', flexDirection: 'column', gap: spacing.s },
  sliderRow: { display: 'flex', alignItems: 'center', gap: spacing.s },
  slider: { flexGrow: 1, minHeight: '24px', accentColor: tokens.colorBrandBackground },
  presets: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: spacing.s },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    alignItems: 'stretch',
    textAlign: 'start',
    minHeight: '44px',
    padding: spacing.s,
    cursor: 'pointer',
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    borderRadius: tokens.borderRadiusMedium,
    ':focus-visible': { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tokens.colorStrokeFocus2 },
  },
  cardOn: {
    ...shorthands.border('2px', 'solid', tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  stage: {
    position: 'relative',
    overflow: 'hidden',
    height: '72px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  stageBig: { height: '140px' },
  subject: {
    position: 'absolute',
    insetBlock: '22%',
    insetInline: '30%',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    boxShadow: tokens.shadow4,
  },
  details: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: spacing.s },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
  select: {
    minHeight: '32px',
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    borderRadius: tokens.borderRadiusMedium,
    paddingInline: spacing.s,
  },
});

/** 動く見本（2D の近似）。reduced のときは動かさず静止で表示する */
function Stage({ combo, reduced, big, testId }: { combo: CameraCombo; reduced: boolean; big?: boolean; testId: string }) {
  const s = useStyles();
  const ref = useRef<HTMLDivElement>(null);
  useCameraAnimation2d(ref, combo, reduced);
  return (
    <div className={mergeClasses(s.stage, big && s.stageBig)} data-testid={testId} aria-hidden="true">
      <div ref={ref} className={s.subject} />
    </div>
  );
}

export function CameraSettings() {
  const s = useStyles();
  const { lang } = useSettings();
  const l = CAMERA_LABELS[lang];
  const cw = useCameraWork();
  const sliderValue = cw.preset ?? 0;
  const detailText = (part: CameraPart, v: string) => {
    const name = (l[part] as Record<string, string>)[v];
    return isAvailable(part, v, cw.method) ? name : `${name} — ${l.only3d}`;
  };
  const has3dOnly = cw.method === '2d';
  const t = useT();
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <section className={s.root} aria-labelledby="camera-heading" data-testid="camera-settings">
      <Subtitle2 as="h3" id="camera-heading">
        {l.title}
      </Subtitle2>

      <div className={s.group}>
        <Body1Strong>{l.simple}</Body1Strong>
        <div className={s.sliderRow}>
          <Caption1>{l.calm}</Caption1>
          <input
            className={s.slider}
            type="range"
            min={0}
            max={PRESETS.length - 1}
            step={1}
            value={sliderValue}
            aria-label={l.slider}
            aria-valuetext={l.presets[sliderValue]}
            data-testid="camera-simple-slider"
            onChange={(e) => cw.selectPreset(Number(e.target.value))}
          />
          <Caption1>{l.flashy}</Caption1>
        </div>
        <div className={s.presets} role="radiogroup" aria-label={l.simple}>
          {PRESETS.map((p, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={cw.preset === n}
              className={mergeClasses(s.card, cw.preset === n && s.cardOn)}
              data-testid={`camera-preset-${n}`}
              onClick={() => cw.selectPreset(n)}
            >
              <Stage combo={p} reduced={cw.reducedMotion} testId="camera-mini-preview" />
              <Caption1>{l.presets[n]}</Caption1>
            </button>
          ))}
        </div>
      </div>

      <div className={s.group}>
        <Body1Strong>{l.detail}</Body1Strong>
        <Button
          size="small"
          appearance="secondary"
          aria-expanded={detailOpen}
          data-testid="camera-detail-open"
          onClick={() => setDetailOpen((v) => !v)}
        >
          {detailOpen ? t('camera.detailClose') : t('camera.detailOpen')}
        </Button>
        {detailOpen && (
          <>
            <div className={s.details} data-testid="camera-detail">
              {PARTS.map((part) => (
                <div key={part} className={s.field}>
                  <Caption1>{l.partNames[part]}</Caption1>
                  <ChoiceButtons
                    label={l.partNames[part]}
                    testId={`camera-group-${part}`}
                    value={cw.combo[part]}
                    onChange={(v) => cw.setPart(part, v as never)}
                    options={PART_VALUES[part].map((v) => ({
                      value: v,
                      label: (l[part] as Record<string, string>)[v],
                      title: isAvailable(part, v, cw.method) ? (TECH_NAMES[part] as Record<string, string>)[v] : detailText(part, v),
                      disabled: !isAvailable(part, v, cw.method),
                    }))}
                  />
                </div>
              ))}
            </div>
            {has3dOnly && <Caption1 data-testid="camera-2d-note">{l.unavailable}</Caption1>}
            {has3dOnly && (
              <Caption1 data-testid="camera-disabled-reason" role="note">
                {l.only3d}
              </Caption1>
            )}
          </>
        )}
      </div>

      <div className={s.group}>
        <Body1Strong data-testid="camera-now" role="status">
          {cw.now}
        </Body1Strong>
        <Stage combo={cw.combo} reduced={cw.reducedMotion} big testId="camera-preview" />
        {cw.reducedMotion && <Caption1>{l.reducedNote}</Caption1>}
        {comboKey(cw.effective) !== cw.key && <Caption1>{l.fallbackNote}</Caption1>}
      </div>
      <Caption1 data-testid="camera-combo" data-value={cw.key} data-max-duration-ms={String(cw.maxDurationMs)}>
        {PARTS.map((part) => (l[part] as Record<string, string>)[cw.combo[part]]).join(' / ')}
      </Caption1>
    </section>
  );
}
