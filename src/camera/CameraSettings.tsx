// CameraSettings: カメラワークの選択パネル（両アプリ共通）。かんたん選択（雰囲気のスライダーと 9 つのプリセット）と
// くわしく選択（4 要素。ボタン群。FR-026）。選択は即座に「いま: …」とプレビューに反映され、localStorage に保存される。
// 1 画面に収める（FR-024）ため、全体を低い帯にまとめ、くわしく選択は「開く」で重ねて表示する（画面の高さを増やさない）。
// data-testid: camera-simple-slider / camera-preset-<n> / camera-mini-preview / camera-now / camera-detail-open /
//   camera-group-<part> / camera-disabled-reason / camera-combo / camera-preview
import { useRef, useState } from 'react';
import { Button, Caption1, Body1Strong, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import { spacing } from '../theme/theme';
import { useT } from '../i18n/useT';
import { ChoiceButtons } from '../ui/ChoiceButtons';
import { useSettings } from '../settings/store';
import { CAMERA_LABELS, TECH_NAMES } from './labels';
import { PART_VALUES, PARTS, PRESETS, comboKey, isAvailable, type CameraCombo, type CameraPart } from './model';
import { useCameraAnimation2d, useCameraWork } from './useCameraWork';

const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '2px 4px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
  },
  bar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  sliderRow: { display: 'flex', alignItems: 'center', gap: spacing.xs, flexGrow: 1, minWidth: '200px' },
  slider: { flexGrow: 1, minHeight: '20px', accentColor: tokens.colorBrandBackground },
  presets: { display: 'grid', gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', gap: spacing.xs },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    alignItems: 'stretch',
    textAlign: 'start',
    minHeight: '36px',
    padding: '2px 4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
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
  cardText: { fontSize: tokens.fontSizeBase100, lineHeight: tokens.lineHeightBase100, overflowWrap: 'anywhere' },
  stage: {
    position: 'relative',
    overflow: 'hidden',
    height: '16px',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  stageBig: { height: '28px', width: '96px', flexShrink: 0 },
  subject: {
    position: 'absolute',
    insetBlock: '22%',
    insetInline: '30%',
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorBrandBackground,
    boxShadow: tokens.shadow4,
  },
  popover: {
    position: 'absolute',
    insetInlineStart: 0,
    insetInlineEnd: 0,
    top: '100%',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.xs,
    padding: spacing.s,
    marginTop: '2px',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow16,
  },
  details: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.s },
  field: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
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
    <section className={s.root} aria-label={l.title} data-testid="camera-settings">
      <div className={s.bar}>
        <Body1Strong>{l.title}</Body1Strong>
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
        <Body1Strong data-testid="camera-now" role="status">
          {cw.now}
        </Body1Strong>
        <Caption1 data-testid="camera-combo" data-value={cw.key} data-max-duration-ms={String(cw.maxDurationMs)}>
          {PARTS.map((part) => (l[part] as Record<string, string>)[cw.combo[part]]).join(' / ')}
        </Caption1>
        <Stage combo={cw.combo} reduced={cw.reducedMotion} big testId="camera-preview" />
        <Button size="small" appearance="secondary" aria-expanded={detailOpen} data-testid="camera-detail-open" onClick={() => setDetailOpen((v) => !v)}>
          {detailOpen ? t('camera.detailClose') : t('camera.detailOpen')}
        </Button>
        {cw.reducedMotion && <Caption1>{l.reducedNote}</Caption1>}
        {comboKey(cw.effective) !== cw.key && <Caption1>{l.fallbackNote}</Caption1>}
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
            <span className={s.cardText}>{l.presets[n]}</span>
          </button>
        ))}
      </div>
      {detailOpen && (
        <div className={s.popover} role="group" aria-label={l.detail} data-testid="camera-detail">
          <Body1Strong>{l.detail}</Body1Strong>
          <div className={s.details}>
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
        </div>
      )}
    </section>
  );
}
