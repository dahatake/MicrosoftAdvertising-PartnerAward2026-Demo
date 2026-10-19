// App2 の左メニュー（FR-025）: 業務ワークフロー順の垂直メニュー。各項目は「同じアイコンセットのアイコン＋文字ラベル」で、
// hover・フォーカスで 1 文のツールチップ（説明）が出る（説明は aria-describedby でも取得できる）。
// 選択中の項目は aria-current="page" に加え、太字・左の太い枠・「▶」マークで示す（色だけに頼らない）。
import { Tooltip, makeStyles, mergeClasses, shorthands, tokens } from '@fluentui/react-components';
import {
  Calculator20Regular,
  Cart20Regular,
  DataUsage20Regular,
  DocumentText20Regular,
  Image20Regular,
  Lightbulb20Regular,
  Organization20Regular,
  Rocket20Regular,
  Wrench20Regular,
  type FluentIcon,
} from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { AREAS, areaLabelKey, areaTipKey, type AreaKey } from './areas';

const ICONS: Record<AreaKey, FluentIcon> = {
  relation: Organization20Regular,
  plan: Lightbulb20Regular,
  quote: DocumentText20Regular,
  production: Wrench20Regular,
  order: Cart20Regular,
  asset: Image20Regular,
  deploy: Rocket20Regular,
  usage: DataUsage20Regular,
  kpi: Calculator20Regular,
};

const useStyles = makeStyles({
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '176px',
    flexShrink: 0,
    paddingBlock: spacing.xs,
    paddingInline: spacing.xs,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    alignSelf: 'flex-start',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.s,
    minHeight: '32px',
    paddingInline: spacing.s,
    cursor: 'pointer',
    textAlign: 'start',
    fontFamily: 'inherit',
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    backgroundColor: 'transparent',
    ...shorthands.border('0', 'none'),
    borderInlineStartWidth: '4px',
    borderInlineStartStyle: 'solid',
    borderInlineStartColor: 'transparent',
    borderRadius: tokens.borderRadiusMedium,
    ':hover': { backgroundColor: tokens.colorNeutralBackground2Hover },
    ':focus-visible': { outlineStyle: 'solid', outlineWidth: '2px', outlineColor: tokens.colorStrokeFocus2 },
  },
  current: {
    fontWeight: tokens.fontWeightBold,
    backgroundColor: tokens.colorBrandBackground2,
    borderInlineStartColor: tokens.colorBrandStroke1,
  },
  mark: { marginInlineStart: 'auto', fontSize: tokens.fontSizeBase100 },
});

export function SideNav({ current, onSelect }: { current: AreaKey; onSelect: (a: AreaKey) => void }) {
  const s = useStyles();
  const t = useT();
  return (
    <nav className={s.nav} aria-label={t('nav.label')} data-testid="side-nav">
      {AREAS.map((a) => {
        const on = a === current;
        return (
          <Tooltip key={a} content={t(areaTipKey(a))} relationship="description" positioning="after" withArrow>
            <button
              type="button"
              className={mergeClasses(s.item, on && s.current)}
              aria-current={on ? 'page' : undefined}
              data-testid={`nav-item-${a}`}
              onClick={() => onSelect(a)}
            >
              {(() => {
                const Icon = ICONS[a];
                return <Icon aria-hidden />;
              })()}
              <span>{t(areaLabelKey(a))}</span>
              {on && (
                <span className={s.mark} data-testid="nav-current-mark" aria-hidden="true">
                  ▶
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}
