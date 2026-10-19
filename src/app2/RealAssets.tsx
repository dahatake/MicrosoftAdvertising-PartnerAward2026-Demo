// 実広告素材の参照（FR-027）: YouTube・TikTok の公開動画を、サムネイル＋元 URL のリンクで表示する。
// 再生前に第三者へ通信するのはサムネイル画像の取得だけ。「再生」を選んだときだけ埋め込み（iframe）に切り替える（AC-115）。
// 読み込めないときは仮置き表示と、原因・次の行動を示す（AC-114）。
import { useState } from 'react';
import { Button, Caption1, makeStyles, tokens } from '@fluentui/react-components';
import { Image20Regular } from '@fluentui/react-icons';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { REAL_ASSETS, embedUrl, isIndividualVideo, thumbnailUrl, type RealAssetConfig } from './realAssetConfig';

const PLACEHOLDER_THUMB =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="#e6e6e6"/><text x="80" y="50" font-size="12" text-anchor="middle" fill="#505050">placeholder</text></svg>',
  );

const useStyles = makeStyles({
  stack: { display: 'flex', flexDirection: 'column', gap: spacing.s },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: spacing.xs },
  item: {
    display: 'flex',
    gap: spacing.s,
    alignItems: 'flex-start',
    padding: spacing.xs,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    minWidth: 0,
    flexGrow: 1,
    flexBasis: '100%',
  },
  frame: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '96px',
    height: '54px',
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground2,
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  embed: { width: '96px', height: '54px', border: 0 },
  info: { display: 'flex', flexDirection: 'column', gap: spacing.xs, minWidth: 0 },
});

function RealItem({ cfg }: { cfg: RealAssetConfig }) {
  const s = useStyles();
  const t = useT();
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const individual = isIndividualVideo(cfg);
  const thumb = thumbnailUrl(cfg);
  const embed = embedUrl(cfg);
  const source = cfg.provider === 'youtube' ? 'YouTube' : 'TikTok';
  const showFallback = failed || !individual;
  const reason = failed ? t('app2.real.failed') : t('app2.real.pending');
  return (
    <li className={s.item} data-testid="asset-real-item" data-provider={cfg.provider}>
      {playing && embed ? (
        <iframe className={s.embed} src={embed} title={`${source} ${t('app2.real.embed')}`} allow="autoplay; fullscreen" referrerPolicy="strict-origin-when-cross-origin" data-testid="asset-real-embed" />
      ) : (
        <span className={s.frame}>
          {failed ? (
            <Image20Regular aria-hidden />
          ) : (
            <img
              className={s.img}
              src={thumb ?? PLACEHOLDER_THUMB}
              alt={`${source} ${t('app2.real.thumbAlt')}`}
              referrerPolicy="no-referrer"
              data-testid="asset-real-thumb"
              onError={() => setFailed(true)}
            />
          )}
        </span>
      )}
      <div className={s.info}>
        <Caption1 data-testid="asset-real-source">
          {t('app2.real.source')}: {source}
        </Caption1>
        <a href={cfg.url} target="_blank" rel="noopener noreferrer" data-testid="asset-real-url">
          {individual ? t('app2.real.open') : t('app2.real.openProfile')}
        </a>
        <Caption1 data-testid="asset-real-rights">{t('app2.real.rights')}</Caption1>
        <Caption1 data-testid="asset-real-notice" style={{ fontSize: 'inherit' }}>{t('app2.real.notice')}</Caption1>
        {showFallback && (
          <div data-testid="asset-real-fallback">
            <Caption1 data-testid="asset-real-fallback-reason" role="status">
              {reason}
            </Caption1>
          </div>
        )}
        {embed && !playing && !failed && (
          <Button size="small" data-testid="asset-real-play" onClick={() => setPlaying(true)}>
            {t('app2.real.play')}
          </Button>
        )}
      </div>
    </li>
  );
}

export function RealAssets() {
  const s = useStyles();
  const t = useT();
  return (
    <section className={s.stack} aria-label={t('app2.real.title')} data-testid="asset-real">
      <ul className={s.list}>
        {REAL_ASSETS.map((c) => (
          <RealItem key={c.id} cfg={c} />
        ))}
      </ul>
    </section>
  );
}
