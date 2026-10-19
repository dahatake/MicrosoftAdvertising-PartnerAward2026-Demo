// ブランドの表示（NFR-UX-005 AC-095・AC-096）: テキストのワードマーク「Surface Ultra」と、設定で差し替えるロゴ。
// 商標ライセンスと公式のロゴファイルがない間は、Microsoft のロゴ・シンボル・Surface のロゴを模した図形を作らず、
// 見出しの書体（PARAM-013）のテキストだけを表示する。公式のロゴファイルが提供されたら、コードを変えずに
// 環境変数 VITE_BRAND_LOGO_LIGHT（明るい背景用: グレーのロゴタイプ）/ VITE_BRAND_LOGO_DARK（暗い背景用: 白のロゴタイプ）で
// 差し替える。ロゴは改変せず（色・形・効果を加えない）、元の縦横比のまま表示する。
import { useState } from 'react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { brandTokens, spacing } from '../theme/theme';

/** テキストのワードマーク（商標の表記なので翻訳しない） */
export const BRAND_WORDMARK = 'Surface Ultra';

/** ロゴを置く面の明暗（明るい面には明るい背景用、暗い面には暗い背景用のロゴを使う） */
export type BrandSurface = 'light' | 'dark';

/** ロゴファイルの設定（未指定はワードマーク） */
export interface BrandLogoConfig {
  light?: string;
  dark?: string;
}

/**
 * 環境変数の値からロゴの URL を決める。未指定・空白だけ・画像として扱えない値（javascript: など）は未指定とする。
 * 使える値: http(s) の URL、同じオリジンのパス（/brand/logo.svg、./logo.png など）、data:image の URL。
 */
export function resolveBrandLogo(raw: string | undefined | null): string | undefined {
  const v = (raw ?? '').trim();
  if (!v) return undefined;
  if (/^(https?:)?\/\//i.test(v) || /^data:image\//i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return undefined; // ほかのスキーム（javascript: など）は使わない
  return v; // 相対・ルートからのパス
}

/** 環境変数（Vite の import.meta.env の形）からロゴの設定を読む */
export function brandLogoConfig(env: Record<string, unknown> = import.meta.env): BrandLogoConfig {
  return {
    light: resolveBrandLogo(env.VITE_BRAND_LOGO_LIGHT as string | undefined),
    dark: resolveBrandLogo(env.VITE_BRAND_LOGO_DARK as string | undefined),
  };
}

const useStyles = makeStyles({
  wordmark: {
    fontFamily: brandTokens.fontFamilyDisplay,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase500,
    letterSpacing: '0',
    whiteSpace: 'nowrap',
  },
  onDark: { color: brandTokens.foregroundOnDark },
  onLight: { color: brandTokens.foreground },
  // 元の縦横比のまま: 高さを決め、幅は auto。狭い所で幅が縮んでも object-fit: contain で比率を保つ（引き伸ばさない）
  logo: {
    display: 'block',
    height: spacing.l,
    width: 'auto',
    maxWidth: '100%',
    objectFit: 'contain',
  },
});

/**
 * ブランドの表示。ロゴの設定があり読み込めればロゴ（data-testid=brand-logo、alt がアクセシブルな名前）、
 * ないか読み込めなければワードマーク（data-testid=brand-wordmark）を表示する。
 * surface はロゴを置く面の明暗（シェルのヘッダー帯は暗い面）。logos を省くと環境変数から読む。
 */
export function BrandMark({ surface, logos, className }: { surface: BrandSurface; logos?: BrandLogoConfig; className?: string }) {
  const s = useStyles();
  const src = (logos ?? brandLogoConfig())[surface];
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <img
        src={src}
        alt={BRAND_WORDMARK}
        data-testid="brand-logo"
        className={mergeClasses(s.logo, className)}
        onError={() => setFailed(src)}
      />
    );
  }
  return (
    <span
      lang="en"
      data-testid="brand-wordmark"
      className={mergeClasses(s.wordmark, surface === 'dark' ? s.onDark : s.onLight, className)}
    >
      {BRAND_WORDMARK}
    </span>
  );
}
