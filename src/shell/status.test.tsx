// NFR-PERF-001 / NFR-PERF-002 / NFR-UX-002 の単体・結合テスト
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lazyRetry } from '../apps/lazyRetry';
import { AsyncBoundary } from './AsyncBoundary';
import { FpsGuard, resetLowPerf, useFpsFallback, useLowPerfNotice, LOW_FPS_SECONDS } from '../view/perf';
import { getSettings, resetSettings, updateSettings } from '../settings/store';
import { set3dSupport } from '../view/support';
import { ThemeProvider } from '../theme/ThemeProvider';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  set3dSupport(undefined);
  resetLowPerf();
  resetSettings(['ja']);
});

// NFR-PERF-002 AC-061: PARAM-009 の 5 秒連続の低下だけを検出する
describe('NFR-PERF-002 AC-061 FpsGuard', () => {
  const run = (guard: FpsGuard, frameMs: number, seconds: number, start = 0) => {
    let hit = false;
    for (let t = start; t <= start + seconds * 1000; t += frameMs) hit = guard.frame(t) || hit;
    return hit;
  };
  it('20fps が 5 秒続くと検出する', () => {
    expect(run(new FpsGuard(), 50, LOW_FPS_SECONDS + 1)).toBe(true);
  });
  it('60fps では検出しない', () => {
    expect(run(new FpsGuard(), 16, 20)).toBe(false);
  });
  it('4 秒だけ低下して回復すれば検出しない', () => {
    const g = new FpsGuard();
    const low = run(g, 50, 4);
    const ok = run(g, 16, 10, 4100);
    expect(low || ok).toBe(false);
  });
  it('背面などの長い空白は低下とみなさない', () => {
    const g = new FpsGuard();
    g.frame(0);
    expect(g.frame(10000)).toBe(false);
  });
});

function Probe() {
  useFpsFallback();
  const low = useLowPerfNotice();
  return <p data-testid="low">{String(low)}</p>;
}

// NFR-PERF-002 AC-061: 低下が続いたら 2D に切り替え、利用者に通知する
describe('NFR-PERF-002 AC-061 3D → 2D の切替', () => {
  it('フレームレートが下回り続けると 2D になり通知が立つ', async () => {
    let now = 0;
    const cbs: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => (cbs.push(cb), cbs.length));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    set3dSupport(true);
    updateSettings({ viewMethod: '3d' });
    render(<Probe />);
    await act(async () => {
      for (let i = 0; i < 400 && getSettings().viewMethod === '3d'; i++) {
        now += 100; // 10fps
        cbs.shift()?.(now);
      }
    });
    expect(getSettings().viewMethod).toBe('2d');
    expect(screen.getByTestId('low').textContent).toBe('true');
  });
});

// NFR-UX-002 AC-065: 読み込み中・失敗が支援技術に通知され、再試行で復旧する
describe('NFR-UX-002 AC-065 AsyncBoundary', () => {
  it('読み込み失敗は alert で原因と次の行動を示し、再試行で復旧する', async () => {
    let fail = true;
    const app = lazyRetry(() =>
      fail ? Promise.reject<{ default: () => JSX.Element }>(new Error('x')) : Promise.resolve({ default: () => <p>loaded</p> }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ThemeProvider>
        <AsyncBoundary onRetry={app.reload}>
          <app.Component />
        </AsyncBoundary>
      </ThemeProvider>,
    );
    expect(screen.getByRole('status')).toBeTruthy();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('読み込みに失敗');
    expect(alert.textContent).toContain('再試行');
    fail = false;
    fireEvent.click(screen.getByTestId('status-retry'));
    await waitFor(() => expect(screen.getByText('loaded')).toBeTruthy());
  });
});

// NFR-PERF-001: 画面はコード分割され、選ばれたときに読み込まれる
describe('NFR-PERF-001 コード分割', () => {
  it('lazyRetry は読み込みが成功した画面を描画する', async () => {
    const app = lazyRetry(() => Promise.resolve({ default: () => <p>ok</p> }));
    render(
      <AsyncBoundary>
        <app.Component />
      </AsyncBoundary>,
    );
    await waitFor(() => expect(screen.getByText('ok')).toBeTruthy());
  });
});
