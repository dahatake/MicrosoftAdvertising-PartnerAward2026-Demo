// デザイン基盤: Fluent 2 のテーマ（OS のライト/ダーク設定に追従）とデザイントークン。
// 色・余白・角丸などは Fluent のトークン（tokens.*）か、ここの spacing で指定し、値を直書きしない。
import { webLightTheme, webDarkTheme, type Theme } from '@fluentui/react-components';

export const spacing = { xs: '4px', s: '8px', m: '16px', l: '24px', xl: '32px' } as const;

export function pickTheme(prefersDark: boolean): Theme {
  return prefersDark ? webDarkTheme : webLightTheme;
}
