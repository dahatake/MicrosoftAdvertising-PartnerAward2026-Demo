// デザイン基盤の再利用の部品（NFR-UX-004）: ピル形の主ボタンと、ブランドの面・カードのクラス。
import { forwardRef } from 'react';
import { Button, makeStyles, mergeClasses, type ButtonProps } from '@fluentui/react-components';
import { brandCardStyle, brandGlowBackground, brandPillStyle, brandTokens } from './theme';

/** ブランドの形のクラス（makeStyles）。各画面は自分の makeStyles に theme.ts のスタイルを広げてもよい */
export const useBrandStyles = makeStyles({
  /** ピル形（主操作のボタン・トグルの選択中の項目） */
  pill: brandPillStyle,
  /** 角丸・影のカード（テーマの面に追従） */
  card: brandCardStyle,
  /** 暗い面と光のグラデーションの帯（テーマによらない） */
  glowBand: brandGlowBackground,
  /** ライトのテーマの明るい面（PARAM-021）。ダークではテーマの面 */
  pageSurface: { backgroundColor: brandTokens.surfacePage },
  /** 見出しのフォント（PARAM-013）。h1〜h6 と Fluent の見出しの部品には global.css で自動で効く */
  display: { fontFamily: brandTokens.fontFamilyDisplay },
});

/**
 * 主操作のボタン: appearance="primary"（背景がテーマの主色 PARAM-011 / PARAM-020、文字は白）でピル形。
 * Fluent の Button と同じ props を受け取る（as="a" のリンクのボタンも可）。appearance は上書きできない。
 */
export const PrimaryButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function PrimaryButton(props, ref) {
  const b = useBrandStyles();
  const { className, ...rest } = props;
  return (
    <Button
      {...(rest as ButtonProps)}
      ref={ref as React.Ref<HTMLButtonElement>}
      appearance="primary"
      className={mergeClasses('brand-primary-button', b.pill, className)}
    />
  );
}) as unknown as typeof Button;
