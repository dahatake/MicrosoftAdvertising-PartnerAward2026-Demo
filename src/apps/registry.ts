// アプリの登録簿: 新しいアプリ（画面）はここに 1 行足す。シェルのトグルは登録簿から作られる。
import type { ComponentType } from 'react';
import type { AppId } from '../settings/store';
import type { MessageKey } from '../i18n';
import { App1 } from './App1';
import { App2 } from './App2';

export interface AppEntry {
  id: AppId;
  labelKey: MessageKey;
  Component: ComponentType;
}

export const APPS: readonly AppEntry[] = [
  { id: 'app1', labelKey: 'shell.app1', Component: App1 },
  { id: 'app2', labelKey: 'shell.app2', Component: App2 },
];
