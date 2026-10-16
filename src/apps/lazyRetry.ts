// 失敗しても再試行できる遅延読み込み（NFR-PERF-001 のコード分割と NFR-UX-002 の復旧）。
// React.lazy は失敗した結果を覚えるので、再試行では lazy を作り直して読み込みをやり直す。
import { createElement, lazy, type ComponentType } from 'react';

export interface RetryableLazy<P> {
  Component: ComponentType<P>;
  /** 失敗した読み込みを捨てて、次の描画で読み込みをやり直す */
  reload: () => void;
}

export function lazyRetry<P = Record<string, never>>(
  factory: () => Promise<{ default: ComponentType<P> }>,
): RetryableLazy<P> {
  let inner = lazy(factory);
  const Component = (props: P) => createElement(inner as unknown as ComponentType<object>, props as object);
  return {
    Component,
    reload: () => {
      inner = lazy(factory);
    },
  };
}