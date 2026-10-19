import { useEffect } from 'react';
import {
  Button,
  Select,
  Tab,
  TabList,
  Title3,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { motion, useReducedMotion } from 'framer-motion';
import { APPS } from '../apps/registry';
import { LANGUAGES, LANGUAGE_LABELS, isLang } from '../i18n';
import { useT } from '../i18n/useT';
import { updateSettings, useSettings, type AppId } from '../settings/store';
import { spacing } from '../theme/theme';
import { CommandPalette } from '../commands/CommandPalette';
import { useShellCommands } from '../commands/shellCommands';
import { ViewModeSwitch } from '../view/ViewModeSwitch';
import { AsyncBoundary } from './AsyncBoundary';
import { ShellTools } from './ShellTools';

const useStyles = makeStyles({
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s,
    padding: `${spacing.xs} ${spacing.m}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  spacer: { flexGrow: 1 },
  main: { padding: spacing.s, maxWidth: '1240px', margin: '0 auto' },
  label: { display: 'flex', alignItems: 'center', gap: spacing.s },
});

/** 画面全体の外枠: 上部にアプリ切替・表示方法・言語、本体に選択中のアプリ。認証要素は置かない（FR-001） */
export function Shell() {
  const s = useStyles();
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
      <header className={s.header}>
        <Title3 as="h1">{t('app.title')}</Title3>
        <TabList
          aria-label={t('shell.appSwitch')}
          size="small"
          selectedValue={app}
          onTabSelect={(_, d) => updateSettings({ app: d.value as AppId })}
        >
          {APPS.map((a) => (
            <Tab key={a.id} value={a.id} data-testid={`app-toggle-${a.id}`}>
              {t(a.labelKey)}
            </Tab>
          ))}
        </TabList>
        <span className={s.spacer} />
        <ViewModeSwitch />
        <ShellTools />
        <Button appearance="subtle" size="small" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
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
