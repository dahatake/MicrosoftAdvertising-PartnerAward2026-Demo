// App1 の設定値（環境変数 VITE_*。コードに秘密値は置かない）。
// 公式サイトの URL は仮置きのダミー（AC-007）。公式動画は確実な公式の埋め込み URL が確認できるまで未設定とし、節を出さない（AC-008）。

/** CTA の遷移先（公式サイト）。VITE_OFFICIAL_SITE_URL で差し替える */
export const OFFICIAL_SITE_URL: string = import.meta.env.VITE_OFFICIAL_SITE_URL || 'https://www.microsoft.com/surface';

/** 既定の公式動画（PARAM-010: 公式チャンネル @surface「Surface Laptop Ultra | Stepping into the future」） */
export const DEFAULT_OFFICIAL_VIDEO_URL = 'https://www.youtube.com/embed/fm6VQgCkj20';

/** 環境変数の値から動画 URL を決める（FR-003 AC-084）: 未指定なら既定、空文字なら空（節を出さない）、それ以外は指定の値 */
export const resolveVideoUrl = (raw: string | undefined): string => (raw === undefined ? DEFAULT_OFFICIAL_VIDEO_URL : raw.trim());

/** 公式動画の埋め込み URL。VITE_OFFICIAL_VIDEO_URL で差し替える。空文字を指定すると動画の節を出さない */
export const OFFICIAL_VIDEO_URL: string = resolveVideoUrl(import.meta.env.VITE_OFFICIAL_VIDEO_URL as string | undefined);

const EMBED_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com'];

/** 埋め込んでよい URL か（https の YouTube /embed/ のみ）。それ以外は表示しない */
export function isEmbeddableVideoUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && EMBED_HOSTS.includes(u.hostname) && u.pathname.startsWith('/embed/') && u.pathname.length > '/embed/'.length;
  } catch {
    return false;
  }
}
