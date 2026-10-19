import { useEffect } from 'react';
import {
  Button,
  Select,
  Tab,
  TabList,
  createCustomFocusIndicatorStyle,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';
import { motion, useReducedMotion } from 'framer-motion';
import { APPS } from '../apps/registry';
import { LANGUAGES, LANGUAGE_LABELS, isLang } from '../i18n';
import { useT } from '../i18n/useT';
import { updateSettings, useSettings, type AppId } from '../settings/store';
import { brandTokens, spacing } from '../theme/theme';
import { useBrandStyles } from '../theme/BrandButton';
import { CommandPalette } from '../commands/CommandPalette';
import { useShellCommands } from '../commands/shellCommands';
import { ViewModeSwitch } from '../view/ViewModeSwitch';
import { AsyncBoundary } from './AsyncBoundary';
import { BrandMark } from './BrandMark';
import { ShellTools } from './ShellTools';

const useStyles = makeStyles({
  // ヘッダーの帯（NFR-UX-004 AC-116）: テーマによらず暗い面と光のグラデーション（デザイン基盤の glowBand）。
  // ワードマークとアプリ切替のトグルを置き、狭い画面では折り返す（幅 320px でも欠けない）
  band: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.l,
    rowGap: spacing.s,
    padding: `${spacing.s} ${spacing.l}`,
    '@media (max-width: 480px)': { padding: `${spacing.s} ${spacing.m}` },
  },
  brand: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.s,
    margin: 0,
    minWidth: 0,
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  appTitle: {
    color: brandTokens.foregroundOnDarkMuted,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightRegular,
  },
  tabs: { flexWrap: 'wrap', gap: spacing.xs, minWidth: 0, maxWidth: '100%' },
  // トグルの項目: 暗い面の上の文字。未選択は透明の背景、選択中は主色のピル形（filled-circular と useBrandStyles().pill）
  tab: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: '100%',
    whiteSpace: 'normal',
    textAlign: 'start',
    ...createCustomFocusIndicatorStyle({
      outlineWidth: tokens.strokeWidthThick,
      outlineStyle: 'solid',
      outlineColor: brandTokens.foregroundOnDark,
      outlineOffset: tokens.strokeWidthThick,
    }),
  },
  tabIdle: {
    backgroundColor: tokens.colorTransparentBackground,
    color: brandTokens.foregroundOnDark,
    ':enabled:hover': { backgroundColor: 'rgba(255, 255, 255, 0.12)', color: brandTokens.foregroundOnDark },
    ':enabled:active': { backgroundColor: 'rgba(255, 255, 255, 0.2)', color: brandTokens.foregroundOnDark },
  },
  // ヘッダー帯の下の共通操作（表示方法・カメラワーク・レイアウト・素材登録・コマンド・言語）。テーマの面に追従する
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.m,
    padding: `${spacing.xs} ${spacing.l}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    '@media (max-width: 480px)': { padding: `${spacing.xs} ${spacing.m}`, justifyContent: 'flex-start' },
  },
  main: { padding: spacing.l, maxWidth: '1200px', margin: '0 auto' },
  label: { display: 'flex', alignItems: 'center', gap: spacing.s },
});

/** 画面全体の外枠: 上部にアプリ切替・表示方法・言語、本体に選択中のアプリ。認証要素は置かない（FR-001） */
export function Shell() {
  const s = useStyles();
  const b = useBrandStyles();
  const t = useT();
  const { app, lang } = useSettings();
  const reduce = useReducedMotion();
  useShellCommands();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const current = APPS.find((a) => a.id === app) ?? APPS[0];
  const Current = current.Component;

  return (
    <>
      <header>
        <div data-testid="shell-header" className={mergeClasses(b.glowBand, s.band)}>
          <h1 className={s.brand}>
            <BrandMark surface="dark" />
            <span className={s.appTitle}>{t('app.title')}</span>
          </h1>
          {/* アプリ切替（FR-001）: タブの矢印キー操作（NFR-A11Y-001）を保ち、選択中は主色のピル形と aria-selected で示す */}
          <TabList
            className={s.tabs}
            appearance="filled-circular"
            aria-label={t('shell.appSwitch')}
            selectedValue={app}
            onTabSelect={(_, d) => updateSettings({ app: d.value as AppId })}
          >
            {APPS.map((a) => (
              <Tab
                key={a.id}
                value={a.id}
                data-testid={`app-toggle-${a.id}`}
                className={mergeClasses(s.tab, a.id === app ? mergeClasses(b.pill, b.toggleChecked) : s.tabIdle)}
              >
                {t(a.labelKey)}
              </Tab>
            ))}
          </TabList>
        </div>
        <div className={s.toolbar}>
          <ViewModeSwitch />
          <ShellTools />
          <Button appearance="subtle" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
            {t('cmd.open')}
          </Button>
          <label className={s.label}>
            <span>{t('shell.language')}</span>
            <Select
              value={lang}
              aria-label={t('shell.language')}
              onChange={(_, d) => isLang(d.value) && updateSettings({ lang: d.value })}
              select={{ 'data-testid': 'lang-select' } as object}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_LABELS[l]}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </header>
      <main className={s.main}>
        <motion.div
            key={current.id}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 0.15 }}
          >
            <AsyncBoundary key={current.id}>
              <Current />
            </AsyncBoundary>
          </motion.div>
      </main>
      <CommandPalette />
    </>
  );
}
