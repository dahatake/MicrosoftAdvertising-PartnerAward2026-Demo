import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Narration } from './Narration';
import { getScript, narrationScripts } from './scripts';
import { LANGUAGES } from '../i18n';
import { resetSettings } from '../settings/store';

let spoken: { text: string; lang: string }[];
let cancelled: number;

beforeEach(() => {
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  (window as any).ResizeObserver = (globalThis as any).ResizeObserver;
  localStorage.clear();
  resetSettings();
  spoken = [];
  cancelled = 0;
  (globalThis as any).SpeechSynthesisUtterance = function (this: any, text: string) {
    this.text = text;
  };
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: { speak: (u: any) => spoken.push({ text: u.text, lang: u.lang }), cancel: () => cancelled++ },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const status = () => screen.getByTestId('narration-status');
const tokenFails = () => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

describe('NFR-A11Y-003 AC-058 台本辞書', () => {
  it.each(LANGUAGES)('%s の台本があり、空でない', (lang) => {
    expect(getScript('valueIntro', lang).length).toBeGreaterThan(20);
  });
  it('言語ごとに台本が違う', () => {
    const texts = LANGUAGES.map((l) => narrationScripts.valueIntro[l]);
    expect(new Set(texts).size).toBe(4);
  });
});

describe('FR-006', () => {
  // FR-006 AC-016 トークン取得に失敗したらブラウザ音声合成で再生し、フォールバックを表示する
  it('AC-016 トークン失敗 → SpeechSynthesis で再生し、通知を出す', async () => {
    tokenFails();
    render(<Narration script="こんにちは、台本です。" lang="ja" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken).toEqual([{ text: 'こんにちは、台本です。', lang: 'ja-JP' }]));
    expect(status().getAttribute('data-state')).toBe('playing');
    expect(screen.getByTestId('narration-notice').getAttribute('data-kind')).toBe('fallback');
  });

  // FR-006 AC-015 停止で止まる
  it('AC-015 停止で stopped になり音声合成が止まる', async () => {
    tokenFails();
    render(<Narration script="台本" lang="en" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken.length).toBe(1));
    const before = cancelled;
    fireEvent.click(screen.getByTestId('narration-stop'));
    expect(status().getAttribute('data-state')).toBe('stopped');
    expect(cancelled).toBeGreaterThan(before);
  });

  // FR-006 AC-017 言語切替で止まり、新しい台本で再生し直せる
  it('AC-017 言語が変わると止まり、新しい台本で再生できる', async () => {
    tokenFails();
    const { rerender } = render(<Narration script="日本語の台本" lang="ja" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken.length).toBe(1));
    rerender(<Narration script="English script" lang="en" />);
    expect(status().getAttribute('data-state')).toBe('stopped');
    expect(status().getAttribute('data-lang')).toBe('en');
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken[1]).toEqual({ text: 'English script', lang: 'en-US' }));
  });

  // FR-006 AC-018 離れる（アンマウント）と止まる
  it('AC-018 アンマウントで音声が止まる', async () => {
    tokenFails();
    const { unmount } = render(<Narration script="台本" lang="ko" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken.length).toBe(1));
    const before = cancelled;
    unmount();
    expect(cancelled).toBeGreaterThan(before);
  });

  // FR-006 AC-018 ページを離れるとき（pagehide）に止まる
  it('AC-018 pagehide で止まる', async () => {
    tokenFails();
    render(<Narration script="台本" lang="zh" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(spoken.length).toBe(1));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(status().getAttribute('data-state')).toBe('stopped');
  });

  // FR-006 AC-016 / NFR-A11Y-003 AC-058 音声合成が使えなくても字幕で読める
  it('AC-058 音声合成もトークンも使えなくても台本が読める', async () => {
    tokenFails();
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: undefined });
    render(<Narration script="読めるはずの台本です。" lang="ja" />);
    fireEvent.click(screen.getByTestId('narration-play'));
    await waitFor(() => expect(screen.getByTestId('narration-notice').getAttribute('data-kind')).toBe('unavailable'));
    expect(status().getAttribute('data-state')).toBe('stopped');
    expect(screen.getByTestId('narration-transcript').textContent).toBe('読めるはずの台本です。');
  });

  // NFR-A11Y-003 AC-058 字幕の開閉
  it('AC-058 字幕を切替で隠し、再表示できる', () => {
    render(<Narration script="台本の本文" lang="ja" />);
    expect(screen.getByTestId('narration-transcript').textContent).toBe('台本の本文');
    fireEvent.click(screen.getByTestId('narration-transcript-toggle'));
    expect(screen.queryByTestId('narration-transcript')).toBeNull();
    fireEvent.click(screen.getByTestId('narration-transcript-toggle'));
    expect(screen.getByTestId('narration-transcript').textContent).toBe('台本の本文');
  });
});
