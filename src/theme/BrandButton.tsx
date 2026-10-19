// デザイン基盤の再利用の部品（NFR-UX-004）: ピル形の主ボタンと、ブランドの面・カードのクラス。
import { forwardRef } from 'react';
import { Button, ToggleButton, makeStyles, mergeClasses, tokens, type ButtonProps, type ToggleButtonProps } from '@fluentui/react-components';
import { brandCardStyle, brandGlowBackground, brandPillStyle, brandTokens } from './theme';

/** ブランドの形のクラス（makeStyles）。各画面は自分の makeStyles に theme.ts のスタイルを広げてもよい */
export const useBrandStyles = makeStyles({
  /**
   * ピル形（キーボードでフォーカスした状態も含む）。shape の API を持たない要素（タブ・独自のトグルの項目など）の className に使う。
   * Fluent の Button・ToggleButton には使わず、PrimaryButton・BrandToggleButton（shape="circular"）を使う。
   */
  pill: brandPillStyle,
  /** 角丸・影のカード（テーマの面に追従） */
  card: brandCardStyle,
  /** 暗い面と光のグラデーションの帯（テーマによらない） */
  glowBand: brandGlowBackground,
  /** ライトのテーマの明るい面（PARAM-021）。ダークではテーマの面 */
  pageSurface: { backgroundColor: brandTokens.surfacePage },
  /** 見出しのフォント（PARAM-013）。h1〜h6 と Fluent の見出しの部品には global.css で自動で効く */
  display: { fontFamily: brandTokens.fontFamilyDisplay },
  /** トグルの選択中の項目の背景を、Fluent の選択中の色（colorBrandBackgroundSelected）ではなくテーマの主色にする */
  toggleChecked: { backgroundColor: tokens.colorBrandBackground, color: tokens.colorNeutralForegroundOnBrand },
});

/**
 * 主操作のボタン: appearance="primary"（背景がテーマの主色 PARAM-011 / PARAM-020、文字は白）で、
 * Fluent の標準の API の shape="circular" でピル形（キーボードでフォーカスした状態の角丸も circular のまま）。
 * Fluent の Button と同じ props を受け取る（as="a" のリンクのボタンも可）。appearance と shape は上書きできない。
 */
export const PrimaryButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function PrimaryButton(props, ref) {
  const { className, ...rest } = props;
  return (
    <Button
      {...(rest as ButtonProps)}
      ref={ref as React.Ref<HTMLButtonElement>}
      appearance="primary"
      shape="circular"
      className={mergeClasses('brand-primary-button', className)}
    />
  );
}) as unknown as typeof Button;

/**
 * トグルの項目（シェルのアプリの切替・言語・テーマのトグルなど）: Fluent の ToggleButton を shape="circular" でピル形にする。
 * 選択中（checked）は appearance="primary" で背景がテーマの主色（PARAM-011 / PARAM-020）、未選択は渡された appearance（既定 subtle）。
 * 選択の状態は ToggleButton の aria-pressed で支援技術に伝わる。checked を渡して制御する。
 * キーボードでフォーカスした状態の角丸も circular のまま。shape は上書きできない。
 */
export const BrandToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(function BrandToggleButton(props, ref) {
  const b = useBrandStyles();
  const { className, appearance, checked, ...rest } = props;
  return (
    <ToggleButton
      {...(rest as ToggleButtonProps)}
      ref={ref}
      checked={checked}
      appearance={checked ? 'primary' : (appearance ?? 'subtle')}
      shape="circular"
      className={mergeClasses('brand-toggle-button', checked && b.toggleChecked, className)}
    />
  );
}) as unknown as typeof ToggleButton;
