import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { LANGUAGES } from '../i18n';
import { resetSettings, updateSettings } from '../settings/store';
import { set3dSupport } from '../view/support';
import { App1 } from '../apps/App1';
import { Presentation } from './Presentation';
import { VideoSection } from './VideoSection';
import { Architecture2D } from './Architecture2D';
import { ProductView } from './ProductView';
import { DEFAULT_OFFICIAL_VIDEO_URL, isEmbeddableVideoUrl, OFFICIAL_SITE_URL, resolveVideoUrl } from './config';
import { app1Text, PERSONAS } from './content';
import { selectPreset } from '../camera/store';

const wrap = (ui: React.ReactNode) => render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

beforeEach(() => {
  localStorage.clear();
  resetSettings(['en']);
});
afterEach(() => {
  cleanup();
  set3dSupport(undefined);
});

// FR-003 AC-007 CTA は設定された公式サイトを新しいタブで開く
describe('FR-003 AC-007 CTA', () => {
  it('公式サイトへの新しいタブのリンクで、元の画面の遷移を伴わない', () => {
    wrap(<App1 />);
    const a = screen.getByTestId('cta-official-site');
    expect(a.getAttribute('href')).toBe(OFFICIAL_SITE_URL);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('noopener');
  });
});

// FR-003 AC-008 動画は設定されているときだけ表示し、ないときは節・空の枠・壊れたリンクを出さない
describe('FR-003 AC-008 公式動画', () => {
  it.each(['', 'not a url', 'http://www.youtube.com/embed/x', 'https://evil.example/embed/x', 'https://www.youtube.com/watch?v=x'])(
    '埋め込み先が %j のときは何も出さない',
    (url) => {
      const { container } = wrap(<VideoSection url={url as string} />);
      expect(container.querySelector('iframe')).toBeNull();
      expect(screen.queryByTestId('video-section')).toBeNull();
      expect(container.textContent).toBe('');
    },
  );
  it('設定されている（YouTube の https 埋め込み）ときは動画を表示する', () => {
    expect(isEmbeddableVideoUrl('https://www.youtube.com/embed/abc')).toBe(true);
    wrap(<VideoSection url="https://www.youtube-nocookie.com/embed/abc" />);
    expect(screen.getByTestId('official-video').getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/abc');
  });
  // FR-003 AC-084 環境変数が未指定なら既定の公式動画、指定で差し替え、空なら節なし
  it('AC-084 未指定は既定の動画、指定は差し替え、空は非表示', () => {
    expect(resolveVideoUrl(undefined)).toBe('https://www.youtube.com/embed/fm6VQgCkj20');
    expect(DEFAULT_OFFICIAL_VIDEO_URL).toContain('fm6VQgCkj20');
    expect(resolveVideoUrl('https://www.youtube.com/embed/abc')).toBe('https://www.youtube.com/embed/abc');
    expect(resolveVideoUrl('')).toBe('');
    expect(isEmbeddableVideoUrl(resolveVideoUrl(''))).toBe(false);
  });
  it('AC-084 既定の App1 に既定の動画が埋め込まれる', () => {
    wrap(<App1 />);
    expect(screen.getByTestId('official-video').getAttribute('src')).toBe('https://www.youtube.com/embed/fm6VQgCkj20');
  });
});

// FR-004 FR-003 4 言語の文言に欠落がない
describe('FR-004 文言の網羅', () => {
  it.each(LANGUAGES)('%s の場面数・構成要素が ja と同じで空がない', (lang) => {
    const t = app1Text[lang];
    for (const p of PERSONAS) {
      expect(t.scenes[p].length).toBe(app1Text.ja.scenes[p].length);
      for (const sc of t.scenes[p]) expect(sc.title.trim() && sc.body.trim()).toBeTruthy();
    }
    expect(t.links.length).toBe(app1Text.ja.links.length);
    expect(Object.values(t.nodes).every((v) => v.trim())).toBe(true);
  });
});

// FR-004 AC-068 構成図は同じ情報を表でも見られ、色だけで示さない
describe('FR-004 AC-068 構成図', () => {
  it('ノードと関連線、同じ関係の表、要約がある', () => {
    const { container } = wrap(<Architecture2D />);
    expect(screen.getByTestId('architecture-2d')).toBeTruthy();
    expect(container.querySelectorAll('[data-node-id]').length).toBe(6);
    expect(container.querySelectorAll('line').length).toBe(app1Text.en.links.length);
    expect(container.querySelectorAll('tbody tr').length).toBe(app1Text.en.links.length);
    // ラベルは文字で示される（色だけではない）
    expect(container.querySelector('[data-node-id="cpu"] text')?.textContent).toBe(app1Text.en.nodes.cpu);
  });
});

// FR-004 AC-010 AC-012 場面の移動と閉じる操作
describe('FR-004 AC-010 AC-011 AC-012 プレゼンテーション', () => {
  it('ペルソナごとに場面が順に表示され、前へ・次へ・矢印キー・Esc・停止で操作できる', () => {
    let closed = 0;
    const { unmount } = wrap(<Presentation persona="p1" onClose={() => closed++} />);
    const scene = () => screen.getByTestId('presentation-scene').textContent;
    const s1 = scene();
    expect((screen.getByTestId('presentation-prev') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    const s2 = scene();
    expect(s2).not.toBe(s1);
    fireEvent.click(screen.getByTestId('presentation-prev'));
    expect(scene()).toBe(s1);
    fireEvent.click(screen.getByTestId('presentation-next'));
    fireEvent.click(screen.getByTestId('presentation-next'));
    expect((screen.getByTestId('presentation-next') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('presentation-stop'));
    fireEvent.click(screen.getByTestId('presentation-close'));
    expect(closed).toBe(3);
    unmount();
    wrap(<Presentation persona="p2" onClose={() => {}} />);
    expect(scene()).not.toBe(s1);
  });
  it('P-1 は製品ビュー、P-2 は構成図を場面に添える', () => {
    wrap(<Presentation persona="p1" onClose={() => {}} />);
    expect(screen.getByTestId('presentation-product-2d')).toBeTruthy();
    cleanup();
    wrap(<Presentation persona="p2" onClose={() => {}} />);
    expect(screen.getByTestId('presentation-architecture')).toBeTruthy();
  });
});

// FR-004 AC-069 場面転換でカメラワークが使われ、動きを減らすときは静止する
describe('FR-004 AC-069 場面転換のカメラワーク', () => {
  const stub = (reduce: boolean) => {
    const calls: unknown[][] = [];
    (window as any).matchMedia = (q: string) => ({ matches: reduce && q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
    (HTMLElement.prototype as any).animate = function (...a: unknown[]) {
      calls.push(a);
      return { cancel() {} };
    };
    return calls;
  };
  afterEach(() => {
    delete (window as any).matchMedia;
    delete (HTMLElement.prototype as any).animate;
  });
  it('選択中のカメラワークで場面転換が動く', () => {
    selectPreset(4);
    const calls = stub(false);
    wrap(<Presentation persona="p1" onClose={() => {}} />);
    const first = calls.length;
    expect(first).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId('presentation-next'));
    expect(calls.length).toBeGreaterThan(first);
  });
  it('「動きを減らす」のときは動かさない', () => {
    const calls = stub(true);
    wrap(<Presentation persona="p1" onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('presentation-next'));
    expect(calls.length).toBe(0);
    expect(screen.getByTestId('presentation-root').getAttribute('data-reduced-motion')).toBe('true');
  });
});

// FR-005 AC-013 AC-014 製品ビュー（既定 2D・3D 切替・3D 不可のときは 2D と説明文）
describe('FR-005 AC-013 AC-014 製品ビュー', () => {
  it('既定は 2D（3D の canvas はない）。説明文がある', () => {
    set3dSupport(true);
    wrap(<ProductView />);
    expect(screen.getByTestId('product-view-2d')).toBeTruthy();
    expect(screen.queryByTestId('product-view-3d-canvas')).toBeNull();
    expect(screen.getByTestId('product-description').textContent).toBe(app1Text.en.productDesc);
  });
  it('3D が使えない端末では 3D を選んでも 2D と同じ説明文が表示される', () => {
    set3dSupport(false);
    updateSettings({ viewMethod: '3d' });
    wrap(<ProductView />);
    expect(screen.getByTestId('product-view-2d')).toBeTruthy();
    expect(screen.queryByTestId('product-view-3d-canvas')).toBeNull();
    expect(screen.getByTestId('product-description').textContent).toBe(app1Text.en.productDesc);
  });
});

// FR-004 AC-067 P-1 は製品ビュー、P-2 は説明文と 2D 構成図が既定
describe('FR-004 AC-067 ペルソナの既定の表現', () => {
  it('P-1 は 2D 製品ビュー、P-2 は構成図に切り替わる', () => {
    set3dSupport(true);
    wrap(<App1 />);
    expect(screen.getByTestId('product-view-2d')).toBeTruthy();
    fireEvent.click(screen.getByTestId('persona-select-p2'));
    expect(screen.getByTestId('architecture-2d')).toBeTruthy();
    expect(screen.queryByTestId('product-view-2d')).toBeNull();
    expect(screen.queryByTestId('product-view-3d-canvas')).toBeNull();
  });
  it('プレゼンテーションの開始と Esc 相当の閉じる操作で元の画面に戻る', () => {
    wrap(<App1 />);
    fireEvent.click(screen.getByTestId('presentation-start'));
    expect(screen.getByTestId('presentation-root')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('presentation-root')).toBeNull();
  });
});
