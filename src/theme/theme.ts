// デザイン基盤: Fluent 2 のテーマ（OS のライト/ダーク設定に追従）とデザイントークン。
// 色・余白・角丸・フォントは Fluent のトークン（tokens.*）か、ここの spacing・brandTokens で指定し、値を直書きしない。
// NFR-UX-004: Microsoft Surface の公開のブランド表現（SRC-009 の CSS から抽出した値。PARAM-011〜014・020〜024）を、
// Fluent 2 の createLightTheme/createDarkTheme にカスタムのブランドランプとして渡して全アプリに効かせる。
import { createCustomFocusIndicatorStyle, createDarkTheme, createLightTheme, tokens, type BrandVariants, type Theme } from '@fluentui/react-components';

export const spacing = { xs: '4px', s: '8px', m: '16px', l: '24px', xl: '32px' } as const;

/** 項目の種類ごとの色（2D と 3D で同じ値を使い、意味づけを一致させる。ライト/ダークどちらでも見分けられる中間の彩度） */
export const kindPalette = ['#0f6cbd', '#c4314b', '#13a10e', '#c239b3', '#ca5010', '#038387', '#8764b8', '#986f0b'] as const;

/**
 * ブランドの値（要求定義書の PARAM の表の値。ブランドキット SRC-010 で別の値が示されたらここだけを置き換える）。
 * 画面からは brandTokens（CSS 変数）を使う。生の値は CSS 変数を使えない所（3D の材質・テスト）だけで使う。
 */
export const BRAND = {
  /** PARAM-011 ライトのテーマの主色（主要ボタンの背景） */
  primaryLight: '#0067B8',
  /** PARAM-020 ダークのテーマの主色 */
  primaryDark: '#2A66B2',
  /** PARAM-013 見出しのフォント指定 */
  fontFamilyDisplay: '"Segoe Sans", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  /** PARAM-014 本文のフォント指定 */
  fontFamilyText: '"Segoe Sans", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  /** PARAM-021 明るい面（ライトのテーマのページ・セクションの背景） */
  surfaceLight: '#F5F5F7',
  /** ライトのテーマの文字（SRC-009 の #1d1d1f） */
  foregroundLight: '#1D1D1F',
  /** PARAM-022 暗い面（ヒーロー・ヘッダー帯・見出し帯。テーマによらない） */
  surfaceDark: ['#0A1522', '#021C3F'] as const,
  /** PARAM-023 光のグラデーションの色（暗い面の上に重ねる） */
  glow: ['#0538C7', '#34BFFB', '#AADFFF'] as const,
  /** PARAM-024 カードの角丸の範囲（.75rem〜1.5rem） */
  radiusCard: '0.75rem',
  radiusCardLarge: '1.5rem',
  /** 暗い面の上の文字（白と、補足の文字。どちらも暗い面・光のグラデーションの上でコントラスト比 4.5 以上） */
  foregroundOnDark: '#FFFFFF',
  foregroundOnDarkMuted: '#C9D6EA',
} as const;

// ---------- ブランドランプ（Fluent の BrandVariants: 10〜160 の 16 段） ----------
type RGB = [number, number, number];
const toRgb = (hex: string): RGB => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const mix = (a: string, b: string, t: number) => {
  const x = toRgb(a);
  const y = toRgb(b);
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
};
const RAMP_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;
/** 最も暗い段と最も明るい段（主色の色相に合わせた紺と、ほぼ白の青） */
const RAMP_INK = '#020A16';
const RAMP_PAPER = '#F2F8FD';

/**
 * 基準色 base を段 anchor（Fluent の慣習: ライトは 80、ダークは 70 が主要ボタンの背景）に置き、
 * 下の段は紺へ、上の段はほぼ白へ線形に混ぜた 16 段のランプを作る。
 */
export function brandRamp(base: string, anchor: (typeof RAMP_STEPS)[number]): BrandVariants {
  const ai = RAMP_STEPS.indexOf(anchor);
  const last = RAMP_STEPS.length - 1;
  const out = {} as Record<(typeof RAMP_STEPS)[number], string>;
  RAMP_STEPS.forEach((step, i) => {
    out[step] =
      i === ai ? base.toUpperCase() : i < ai ? mix(RAMP_INK, base, i / ai) : mix(base, RAMP_PAPER, (i - ai) / (last - ai));
  });
  return out as BrandVariants;
}

export const brandLight = brandRamp(BRAND.primaryLight, 80);
export const brandDark = brandRamp(BRAND.primaryDark, 70);

// ---------- ブランドの追加トークン（Fluent の FluentProvider がテーマのキーを CSS 変数 --<キー> にする） ----------
type BrandExtension = {
  brandFontFamilyDisplay: string;
  brandPrimary: string;
  brandSurfacePage: string;
  brandForeground: string;
  brandSurfaceDark1: string;
  brandSurfaceDark2: string;
  brandGlow1: string;
  brandGlow2: string;
  brandGlow3: string;
  brandGlow1Soft: string;
  brandGlow2Soft: string;
  brandGlow3Soft: string;
  brandRadiusCard: string;
  brandRadiusCardLarge: string;
  brandForegroundOnDark: string;
  brandForegroundOnDarkMuted: string;
};
export type BrandTheme = Theme & BrandExtension;

const sharedExtension = {
  brandFontFamilyDisplay: BRAND.fontFamilyDisplay,
  brandSurfaceDark1: BRAND.surfaceDark[0],
  brandSurfaceDark2: BRAND.surfaceDark[1],
  brandGlow1: BRAND.glow[0],
  brandGlow2: BRAND.glow[1],
  brandGlow3: BRAND.glow[2],
  // 暗い面に重ねる半透明の光（8 桁の 16 進。文字の下に来ても白の文字とのコントラストを保つ濃さ）
  brandGlow1Soft: `${BRAND.glow[0]}B3`,
  brandGlow2Soft: `${BRAND.glow[1]}59`,
  brandGlow3Soft: `${BRAND.glow[2]}33`,
  brandRadiusCard: BRAND.radiusCard,
  brandRadiusCardLarge: BRAND.radiusCardLarge,
  brandForegroundOnDark: BRAND.foregroundOnDark,
  brandForegroundOnDarkMuted: BRAND.foregroundOnDarkMuted,
} satisfies Partial<BrandExtension>;

function withBrandFonts(t: Theme): Theme {
  return { ...t, fontFamilyBase: BRAND.fontFamilyText };
}

/** ライトのテーマ: 主色 PARAM-011、文字 #1D1D1F、ページの面 PARAM-021 */
export const brandLightTheme: BrandTheme = (() => {
  const t = withBrandFonts(createLightTheme(brandLight));
  return {
    ...t,
    colorNeutralForeground1: BRAND.foregroundLight,
    colorNeutralForeground1Hover: BRAND.foregroundLight,
    colorNeutralForeground1Pressed: BRAND.foregroundLight,
    colorNeutralForeground1Selected: BRAND.foregroundLight,
    ...sharedExtension,
    brandPrimary: t.colorBrandBackground,
    brandSurfacePage: BRAND.surfaceLight,
    brandForeground: BRAND.foregroundLight,
  };
})();

/** ダークのテーマ: 主色 PARAM-020 */
export const brandDarkTheme: BrandTheme = (() => {
  const t = withBrandFonts(createDarkTheme(brandDark));
  return {
    ...t,
    ...sharedExtension,
    brandPrimary: t.colorBrandBackground,
    brandSurfacePage: t.colorNeutralBackground2,
    brandForeground: t.colorNeutralForeground1,
  };
})();

export function pickTheme(prefersDark: boolean): BrandTheme {
  return prefersDark ? brandDarkTheme : brandLightTheme;
}

/** ブランドのトークン（CSS 変数の参照。makeStyles と global.css で使う。Fluent の tokens と同じ使い方） */
export const brandTokens = {
  fontFamilyDisplay: 'var(--brandFontFamilyDisplay)',
  fontFamilyText: tokens.fontFamilyBase,
  primary: 'var(--brandPrimary)',
  surfacePage: 'var(--brandSurfacePage)',
  foreground: 'var(--brandForeground)',
  surfaceDark1: 'var(--brandSurfaceDark1)',
  surfaceDark2: 'var(--brandSurfaceDark2)',
  glow1: 'var(--brandGlow1)',
  glow2: 'var(--brandGlow2)',
  glow3: 'var(--brandGlow3)',
  glow1Soft: 'var(--brandGlow1Soft)',
  glow2Soft: 'var(--brandGlow2Soft)',
  glow3Soft: 'var(--brandGlow3Soft)',
  radiusCard: 'var(--brandRadiusCard)',
  radiusCardLarge: 'var(--brandRadiusCardLarge)',
  radiusPill: tokens.borderRadiusCircular,
  foregroundOnDark: 'var(--brandForegroundOnDark)',
  foregroundOnDarkMuted: 'var(--brandForegroundOnDarkMuted)',
} as const;

/**
 * 暗い面と光のグラデーションの背景（App1 のヒーロー・シェルのヘッダー帯・App2 の見出し帯。テーマによらない）。
 * makeStyles のスタイルにそのまま広げて使う（例: `band: { ...brandGlowBackground, padding: spacing.l }`）。
 * 上に置く文字の色は brandTokens.foregroundOnDark（補足は foregroundOnDarkMuted）を使う。
 */
export const brandGlowBackground = {
  color: brandTokens.foregroundOnDark,
  backgroundColor: brandTokens.surfaceDark1,
  backgroundImage: [
    `radial-gradient(ellipse 70% 140% at 100% 0%, ${brandTokens.glow3Soft} 0%, ${brandTokens.glow2Soft} 30%, ${brandTokens.glow1Soft} 60%, transparent 100%)`,
    `linear-gradient(160deg, ${brandTokens.surfaceDark2} 0%, ${brandTokens.surfaceDark1} 70%)`,
  ].join(', '),
} as const;

/** 角丸のカード（PARAM-024 の .75rem、影つき。テーマの面の色に追従） */
export const brandCardStyle = {
  borderRadius: brandTokens.radiusCard,
  backgroundColor: tokens.colorNeutralBackground1,
  color: tokens.colorNeutralForeground1,
  boxShadow: tokens.shadow8,
} as const;

/**
 * ピル形（角丸の半径が高さの半分以上）。トグルの選択中の項目など、shape の API を持たない要素に使う。
 * Fluent の部品はキーボードでフォーカスしたとき（[data-fui-focus-visible]）に大きさごとの角丸を付け直すため、
 * フォーカス中の角丸もピル形にする選択子を含める（Fluent の部品の className に渡すと、部品のスタイルより後に合成されて勝つ）。
 * Fluent の Button・ToggleButton には、これではなく標準の API の shape="circular" を使う（PrimaryButton・BrandToggleButton）。
 */
export const brandPillStyle = {
  borderRadius: brandTokens.radiusPill,
  ...createCustomFocusIndicatorStyle({ borderRadius: brandTokens.radiusPill }),
} as const;
