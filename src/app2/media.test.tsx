// FR-026 AC-108 AC-110 / FR-027 AC-111 AC-112 AC-113 AC-114 AC-115 の単体・結合テスト
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ChoiceButtons } from '../ui/ChoiceButtons';
import { AssetPanel } from './AssetPanel';
import { RealAssets } from './RealAssets';
import { REAL_ASSETS, embedUrl, isIndividualVideo, thumbnailUrl, youtubeId } from './realAssetConfig';
import { resetSettings } from '../settings/store';
import { resetDataset } from './store';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['ja']);
  resetDataset();
});
afterEach(cleanup);

// FR-026 AC-108 素材の画面にコンボボックスが無い
describe('FR-026 AC-108 コンボボックスなし', () => {
  it('素材管理の画面に select・combobox・listbox が無く、値の選択はボタン群', () => {
    const { container } = wrap(<AssetPanel />);
    expect(container.querySelectorAll('select, [role=combobox], [role=listbox], datalist')).toHaveLength(0);
    expect(screen.getByTestId('asset-type').getAttribute('role')).toBe('radiogroup');
    expect(screen.getByTestId('asset-project').getAttribute('role')).toBe('radiogroup');
  });
});

// FR-026 AC-110 ボタン群の操作・状態・ページ送り
describe('FR-026 AC-110 ボタン群', () => {
  const opts = Array.from({ length: 20 }, (_, i) => ({ value: `v${i}`, label: `項目${i}` }));
  it('グループ名・選択状態（✓）・矢印キー・ページ送りで全選択肢に到達できる', () => {
    let v = 'v0';
    const { rerender } = wrap(<ChoiceButtons label="テスト群" testId="g" options={opts} value={v} onChange={(x) => (v = x)} pageSize={8} />);
    const g = screen.getByRole('radiogroup', { name: 'テスト群' });
    expect(within(g).getAllByRole('radio')).toHaveLength(8);
    expect(within(g).getByRole('radio', { checked: true }).textContent).toContain('✓');
    within(g).getAllByRole('radio')[0].focus();
    fireEvent.keyDown(g, { key: 'ArrowRight' });
    expect(v).toBe('v1');
    rerender(<FluentProvider theme={webLightTheme}><ChoiceButtons label="テスト群" testId="g" options={opts} value={v} onChange={(x) => (v = x)} pageSize={8} /></FluentProvider>);
    fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
    fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
    expect(g.querySelector('[data-value="v19"]')).not.toBeNull();
    fireEvent.click(g.querySelector('[data-value="v19"]')!);
    expect(v).toBe('v19');
  });
  it('無効の選択肢は選べない', () => {
    let v = 'a';
    wrap(<ChoiceButtons label="g" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true, title: '理由' }]} value={v} onChange={(x) => (v = x)} />);
    const b = screen.getByRole('radio', { name: 'B' });
    expect(b.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(b);
    expect(v).toBe('a');
  });
});

// FR-027 AC-111 AC-113 提供元・URL・権利・別製品の旨
describe('FR-027 AC-111 AC-113 実広告素材の表示', () => {
  it('YouTube と TikTok が各 1 件以上、サムネイルと元 URL つき。PARAM-018 の URL・サムネイルは参照だけ', () => {
    wrap(<RealAssets />);
    const items = screen.getAllByTestId('asset-real-item');
    expect(items.length).toBeGreaterThanOrEqual(2);
    for (const p of ['youtube', 'tiktok']) {
      const it = items.find((i) => i.getAttribute('data-provider') === p)!;
      expect(within(it).getByTestId('asset-real-thumb')).toBeTruthy();
      expect(within(it).getByTestId('asset-real-url').getAttribute('href')).toMatch(/^https:\/\//);
    }
    const yt = items.find((i) => i.getAttribute('data-provider') === 'youtube')!;
    expect(within(yt).getByTestId('asset-real-url').getAttribute('href')).toBe('https://www.youtube.com/watch?v=fm6VQgCkj20');
    expect(within(yt).getByTestId('asset-real-thumb').getAttribute('src')).toBe('https://i.ytimg.com/vi/fm6VQgCkj20/hqdefault.jpg');
    for (const it of items) {
      expect(within(it).getByTestId('asset-real-source').textContent).toMatch(/YouTube|TikTok/);
      expect(within(it).getByTestId('asset-real-rights').textContent).toContain('依頼者の申告');
      expect(within(it).getByTestId('asset-real-notice').textContent).toMatch(/別|実在/);
    }
    // TikTok は個別 URL 未設定の間、仮置き（プロフィールへのリンク）と理由
    const tt = items.find((i) => i.getAttribute('data-provider') === 'tiktok')!;
    expect(within(tt).getByTestId('asset-real-url').getAttribute('href')).toBe('https://www.tiktok.com/@microsoft');
    expect(within(tt).getByTestId('asset-real-fallback')).toBeTruthy();
  });
  it('素材の設定は URL だけで、動画・画像ファイルを持たない（AC-112）', () => {
    for (const c of REAL_ASSETS) {
      expect(c.url).toMatch(/^https:\/\//);
      expect(c.url).not.toMatch(/\.(mp4|webm|mov|m4v|png|jpe?g)(\?|$)/i);
    }
    expect(youtubeId('https://youtu.be/abc12345')).toBe('abc12345');
    expect(youtubeId('https://example.com/')).toBeNull();
    expect(isIndividualVideo({ id: 'x', provider: 'tiktok', url: 'https://www.tiktok.com/@a/video/123456' })).toBe(true);
  });
});

// FR-027 AC-114 サムネイルの読み込み失敗
describe('FR-027 AC-114 異常系', () => {
  it('サムネイルが読み込めないと、壊れた画像を出さず、仮置き・元 URL・原因と次の行動を示す', () => {
    wrap(<RealAssets />);
    const yt = screen.getAllByTestId('asset-real-item').find((i) => i.getAttribute('data-provider') === 'youtube')!;
    fireEvent.error(within(yt).getByTestId('asset-real-thumb'));
    expect(within(yt).queryByTestId('asset-real-thumb')).toBeNull();
    expect(within(yt).getByTestId('asset-real-fallback-reason').textContent!.length).toBeGreaterThan(5);
    expect(within(yt).getByTestId('asset-real-url').getAttribute('href')).toMatch(/^https:\/\//);
  });
});

// FR-027 AC-115 再生まで埋め込まない
describe('FR-027 AC-115 再生操作', () => {
  it('再生前は iframe が無く、「再生」で youtube-nocookie の埋め込みに切り替わる', () => {
    const { container } = wrap(<RealAssets />);
    expect(container.querySelector('iframe')).toBeNull();
    const yt = REAL_ASSETS.find((c) => c.provider === 'youtube')!;
    expect(embedUrl(yt)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    expect(thumbnailUrl(yt)).toMatch(/^https:\/\/i\.ytimg\.com\//);
    fireEvent.click(screen.getByTestId('asset-real-play'));
    expect(container.querySelector('iframe[data-testid="asset-real-embed"]')).not.toBeNull();
  });
});
