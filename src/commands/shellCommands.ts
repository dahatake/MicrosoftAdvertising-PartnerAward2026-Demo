// シェルのコマンド: アプリの切替・言語・表示方法・すべてのレイアウトを既定に戻す。
import { useEffect } from 'react';
import { APPS } from '../apps/registry';
import { LANGUAGES, LANGUAGE_LABELS } from '../i18n';
import { useT } from '../i18n/useT';
import { resetAllLayouts } from '../layout/store';
import { updateSettings, useSettings } from '../settings/store';
import { use3dSupport } from '../view/support';
import { registerCommands, type Command } from './registry';

export function useShellCommands() {
  const t = useT();
  const supported3d = use3dSupport();
  const { lang } = useSettings();
  useEffect(() => {
    const cmds: Command[] = [
      ...APPS.map((a) => ({
        id: `app.${a.id}`,
        label: `${t('cmd.switchApp')} ${t(a.labelKey)}`,
        keywords: `app switch ${a.id}`,
        run: () => updateSettings({ app: a.id }),
      })),
      ...LANGUAGES.map((l) => ({
        id: `lang.${l}`,
        label: `${t('cmd.language')} ${LANGUAGE_LABELS[l]}`,
        keywords: `language lang ${l}`,
        run: () => updateSettings({ lang: l }),
      })),
      { id: 'view.2d', label: `${t('cmd.viewMethod')} 2D`, keywords: 'display view method 2D', run: () => updateSettings({ viewMethod: '2d' }) },
      ...(supported3d
        ? [{ id: 'view.3d', label: `${t('cmd.viewMethod')} 3D`, keywords: 'display view method 3D', run: () => updateSettings({ viewMethod: '3d' as const }) }]
        : []),
      { id: 'layout.resetAll', label: t('cmd.layoutReset'), keywords: 'layout reset default', run: resetAllLayouts },
    ];
    return registerCommands('shell', cmds);
  }, [lang, supported3d]);
}
