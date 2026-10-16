// App1 の設定値（環境変数 VITE_*。コードに秘密値は置かない）。
// 公式サイトの URL は仮置きのダミー（AC-007）。公式動画は確実な公式の埋め込み URL が確認できるまで未設定とし、節を出さない（AC-008）。

/** CTA の遷移先（公式サイト）。VITE_OFFICIAL_SITE_URL で差し替える */
export const OFFICIAL_SITE_URL: string = import.meta.env.VITE_OFFICIAL_SITE_URL || 'https://www.microsoft.com/surface';

/** 公式動画の埋め込み URL。未設定（空）なら動画の節を出さない。VITE_OFFICIAL_VIDEO_URL で設定する */
export const OFFICIAL_VIDEO_URL: string = import.meta.env.VITE_OFFICIAL_VIDEO_URL || '';

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
