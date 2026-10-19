import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Shell } from './Shell';
import { ThemeProvider } from '../theme/ThemeProvider';
import { resetSettings } from '../settings/store';

const OFFICIAL_NAME = 'MicrosoftAdvertising-PartnerAward2026-Demo';
const LOCALES = ['en', 'ja', 'ko', 'zh'] as const;

beforeEach(() => {
  localStorage.clear();
  resetSettings(['en']);
});

afterEach(() => {
  cleanup();
  resetSettings(['en']);
});

// FR-022 AC-086: ヘッダーと document.title は全ロケールで正式名称を保つ
describe('FR-022 AC-086 アプリ名のブラウザー表示', () => {
  it('言語を切り替えても可視ヘッダーと document.title が正式名称のまま', async () => {
    render(
      <ThemeProvider>
        <Shell />
      </ThemeProvider>,
    );

    const heading = screen.getByRole('banner').querySelector('h1');
    expect(heading?.textContent).toBe(OFFICIAL_NAME);
    for (const locale of LOCALES) {
      fireEvent.change(screen.getByTestId('lang-select'), { target: { value: locale } });
      await waitFor(() => {
        expect(document.documentElement.lang).toBe(locale);
        expect(document.title).toBe(OFFICIAL_NAME);
        expect(screen.getByRole('banner').querySelector('h1')?.textContent).toBe(OFFICIAL_NAME);
      });
    }
  });
});
