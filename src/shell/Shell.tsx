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
import { LANGUAGES, LANGUAGE_LABELS, isLang, translate } from '../i18n';
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
  // ワードマーク・アプリ名・アプリ切替のトグルを置き、狭い画面では折り返す（幅 320px でも欠けない）。
  // App2 の 1 画面収容（FR-024 AC-098）のため、帯は 1 行ぶんの高さに詰める（余白は xs・トグルは small）
  band: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.m,
    rowGap: spacing.xs,
    padding: `${spacing.xs} ${spacing.m}`,
  },
  // ワードマーク（NFR-UX-005 AC-095）とアプリ名の見出し（FR-022 AC-086: h1 の文字は正式名称だけ）
  brand: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.s,
    minWidth: 0,
  },
  title: {
    margin: 0,
    minWidth: 0,
    overflowWrap: 'anywhere',
    color: brandTokens.foregroundOnDarkMuted,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  // 架空の製品・非公式のデモの注記（NFR-UX-005 AC-117）。帯の中の 1 行の細い注記。狭い幅でだけ折り返す
  notice: {
    flexBasis: '100%',
    margin: 0,
    minWidth: 0,
    overflowWrap: 'anywhere',
    color: brandTokens.foregroundOnDarkMuted,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
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
    ':enabled:hover': { backgroundColor: brandTokens.surfaceOnDarkHover, color: brandTokens.foregroundOnDark },
    ':enabled:active': { backgroundColor: brandTokens.surfaceOnDarkPressed, color: brandTokens.foregroundOnDark },
  },
  // ヘッダー帯の下の共通操作（表示方法・カメラワーク・レイアウト・素材登録・コマンド・言語）。テーマの面に追従する
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.s,
    padding: `${spacing.xs} ${spacing.m}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    '@media (max-width: 480px)': { justifyContent: 'flex-start' },
  },
  main: { padding: spacing.s, maxWidth: '1240px', margin: '0 auto' },
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
    document.title = translate(lang, 'app.title');
  }, [lang]);

  const current = APPS.find((a) => a.id === app) ?? APPS[0];
  const Current = current.Component;

  return (
    <>
      <header>
        <div data-testid="shell-header" className={mergeClasses(b.glowBand, s.band)}>
          <div className={s.brand}>
            <BrandMark surface="dark" />
            <h1 className={s.title}>{t('app.title')}</h1>
          </div>
          {/* アプリ切替（FR-001）: タブの矢印キー操作（NFR-A11Y-001）を保ち、選択中は主色のピル形と aria-selected で示す */}
          <TabList
            className={s.tabs}
            appearance="filled-circular"
            size="small"
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
          <p role="note" data-testid="brand-notice" className={s.notice}>
            {t('shell.brandNotice')}
          </p>
        </div>
        <div className={s.toolbar}>
          <ViewModeSwitch />
          <ShellTools />
          <Button appearance="subtle" size="small" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
            {t('cmd.open')}
          </Button>
          <label className={s.label}>
            <span>{t('shell.language')}</span>
            <Select
              size="small"
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
