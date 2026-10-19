// 実広告素材（FR-027）の設定値: 公開動画の URL だけを持つ（動画・画像ファイルは複製しない。AC-112）。
// PARAM-018（YouTube）・PARAM-019（TikTok）。利用者はここを差し替え・追加して具体的な素材を指定する（Q-005 A）。
export type RealProvider = 'youtube' | 'tiktok';

export interface RealAssetConfig {
  id: string;
  provider: RealProvider;
  /** 公開 URL（元の動画へのリンク） */
  url: string;
}

/** PARAM-018 */
export const YOUTUBE_URLS: readonly string[] = ['https://www.youtube.com/watch?v=fm6VQgCkj20'];
/** PARAM-019: 個別動画 URL は未確認。仮置きは公式プロフィール */
export const TIKTOK_URLS: readonly string[] = ['https://www.tiktok.com/@microsoft'];

export const REAL_ASSETS: readonly RealAssetConfig[] = [
  ...YOUTUBE_URLS.map((url, i) => ({ id: `real-yt-${i + 1}`, provider: 'youtube' as const, url })),
  ...TIKTOK_URLS.map((url, i) => ({ id: `real-tt-${i + 1}`, provider: 'tiktok' as const, url })),
];

/** YouTube の動画 ID（watch?v= または youtu.be/）。取れなければ null */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1) || null;
    const v = u.searchParams.get('v');
    return v && /^[\w-]{6,}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** サムネイル画像の URL（画像の取得だけで第三者へ通信する。AC-115）。個別動画でなければ null */
export function thumbnailUrl(c: RealAssetConfig): string | null {
  if (c.provider !== 'youtube') return null;
  const id = youtubeId(c.url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** 「再生」後にだけ読み込む埋め込みの URL（Cookie を使わないドメイン）。埋め込めなければ null */
export function embedUrl(c: RealAssetConfig): string | null {
  if (c.provider !== 'youtube') return null;
  const id = youtubeId(c.url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
}

/** TikTok の個別動画 URL か（/video/ を含む）。違えば仮置き（プロフィール） */
export function isIndividualVideo(c: RealAssetConfig): boolean {
  return c.provider === 'youtube' ? youtubeId(c.url) !== null : /\/video\/\d+/.test(c.url);
}
