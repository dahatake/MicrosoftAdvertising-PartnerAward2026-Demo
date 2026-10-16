// 素材のサムネイル（AC-040）: 画像・動画の場所がない、または読み込めないときは、仮置きのプレースホルダーを表示し、壊れた画像を出さない。
import { useEffect, useState } from 'react';
import { Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { Image20Regular } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';

const useStyles = makeStyles({
  frame: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    width: '160px',
    height: '90px',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
});

export interface AssetThumbProps {
  /** 画像の場所。null・空・読み込み失敗なら仮置きを出す */
  src?: string | null;
  /** 代替テキスト（素材の名前） */
  alt: string;
}

export function AssetThumb({ src, alt }: AssetThumbProps) {
  const s = useStyles();
  const t = useT();
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className={s.frame} role="img" aria-label={`${alt}: ${t('app2.placeholder')}`} data-testid="asset-placeholder">
        <Image20Regular aria-hidden />
        <Caption1>{t('app2.placeholder')}</Caption1>
      </span>
    );
  }
  return (
    <span className={s.frame}>
      <img className={s.img} src={src} alt={alt} data-testid="asset-image" onError={() => setFailed(true)} />
    </span>
  );
}
