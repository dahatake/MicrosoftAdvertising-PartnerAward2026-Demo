// デザイン基盤: Fluent 2 のテーマ（OS のライト/ダーク設定に追従）とデザイントークン。
// 色・余白・角丸などは Fluent のトークン（tokens.*）か、ここの spacing で指定し、値を直書きしない。
import { webLightTheme, webDarkTheme, type Theme } from '@fluentui/react-components';

export const spacing = { xs: '4px', s: '8px', m: '16px', l: '24px', xl: '32px' } as const;

/** 項目の種類ごとの色（2D と 3D で同じ値を使い、意味づけを一致させる。ライト/ダークどちらでも見分けられる中間の彩度） */
export const kindPalette = ['#0f6cbd', '#c4314b', '#13a10e', '#c239b3', '#ca5010', '#038387', '#8764b8', '#986f0b'] as const;

export function pickTheme(prefersDark: boolean): Theme {
  return prefersDark ? webDarkTheme : webLightTheme;
}
