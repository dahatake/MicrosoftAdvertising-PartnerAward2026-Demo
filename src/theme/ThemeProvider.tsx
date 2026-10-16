import { useEffect, useState, type ReactNode } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { pickTheme } from './theme';

function usePrefersDark() {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = usePrefersDark();
  return (
    <FluentProvider theme={pickTheme(dark)} style={{ minHeight: '100vh' }}>
      {children}
    </FluentProvider>
  );
}
