import { Radio, RadioGroup, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import type { ViewMethod } from '../settings/store';
import { useViewMode } from './useViewMode';

const useStyles = makeStyles({
  root: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: spacing.s },
  reason: { color: tokens.colorNeutralForeground2 },
});

/** 2D/3D の切替（既定 2D）。3D が使えない端末では 3D を選べず、理由を表示する */
export function ViewModeSwitch() {
  const s = useStyles();
  const t = useT();
  const { requested, supported3d, set } = useViewMode();
  return (
    <div className={s.root}>
      <RadioGroup
        layout="horizontal"
        aria-label={t('shell.viewMethod')}
        value={supported3d ? requested : '2d'}
        onChange={(_, d) => set(d.value as ViewMethod)}
      >
        <Radio value="2d" label={t('shell.view2d')} input={{ 'data-testid': 'view-mode-2d' } as object} />
        <Radio
          value="3d"
          label={t('shell.view3d')}
          disabled={!supported3d}
          input={{ 'data-testid': 'view-mode-3d' } as object}
        />
      </RadioGroup>
      {!supported3d && (
        <Caption1 className={s.reason} role="status" data-testid="view-mode-reason">
          {t('view.unsupported')}
        </Caption1>
      )}
    </div>
  );
}
