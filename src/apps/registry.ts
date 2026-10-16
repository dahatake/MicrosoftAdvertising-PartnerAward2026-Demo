// アプリの登録簿: 新しいアプリ（画面）はここに 1 行足す。シェルのトグルは登録簿から作られる。
import type { ComponentType } from 'react';
import type { AppId } from '../settings/store';
import type { MessageKey } from '../i18n';
import { lazyRetry } from './lazyRetry';

// 画面ごとにコード分割し、選ばれたときに読み込む（NFR-PERF-001）。読み込み中・失敗の表示は Shell の AsyncBoundary が担う
const App1 = lazyRetry(() => import('./App1').then((m) => ({ default: m.App1 })));
const App2 = lazyRetry(() => import('./App2').then((m) => ({ default: m.App2 })));

export interface AppEntry {
  id: AppId;
  labelKey: MessageKey;
  Component: ComponentType;
  /** 読み込みに失敗したあとの再試行で呼ぶ */
  reload: () => void;
}

export const APPS: readonly AppEntry[] = [
  { id: 'app1', labelKey: 'shell.app1', Component: App1.Component, reload: App1.reload },
  { id: 'app2', labelKey: 'shell.app2', Component: App2.Component, reload: App2.reload },
];