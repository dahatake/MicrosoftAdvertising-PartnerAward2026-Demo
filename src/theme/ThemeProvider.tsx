import { useEffect, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { FluentProvider } from '@fluentui/react-components';
import { brandTokens, pickTheme } from './theme';

/** テーマの切替中に付ける属性。global.css がこの間の遷移（transition）を止め、色を一度に切り替える */
export const THEME_SWITCHING_ATTR = 'data-theme-switching';

function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => {
      // OS のテーマが変わったら、前のテーマの色が遷移で残らないよう、遷移を止めて同期的に描き直す（NFR-UX-001・NFR-UX-004 AC-089）
      const root = document.documentElement;
      root.setAttribute(THEME_SWITCHING_ATTR, '');
      flushSync(() => setDark(e.matches));
      requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute(THEME_SWITCHING_ATTR)));
    };
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

/** デザイン基盤のテーマ（NFR-UX-001 の OS のライト/ダークに追従、NFR-UX-004 のブランドのテーマとページの面） */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = usePrefersDark();
  return (
    <FluentProvider theme={pickTheme(dark)} style={{ minHeight: '100vh', backgroundColor: brandTokens.surfacePage }}>
      {children}
    </FluentProvider>
  );
}