// 公式動画の節（AC-008）: 埋め込み先が設定されている（かつ YouTube の https /embed/ の URL）ときだけ表示する。
// 未設定・不正な URL のときは、節の見出し・空の枠・壊れたリンクのどれも出さない（null を返す）。
import { Subtitle1, makeStyles, tokens } from '@fluentui/react-components';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { isEmbeddableVideoUrl, OFFICIAL_VIDEO_URL } from './config';
import { app1Text } from './content';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.s },
  frame: { width: '100%', maxWidth: '800px', aspectRatio: '16 / 9', border: 'none', borderRadius: tokens.borderRadiusLarge },
});

export function VideoSection({ url = OFFICIAL_VIDEO_URL }: { url?: string }) {
  const s = useStyles();
  const { lang } = useSettings();
  if (!isEmbeddableVideoUrl(url)) return null;
  const text = app1Text[lang];
  return (
    <section className={s.root} aria-labelledby="app1-video-heading" data-testid="video-section">
      <Subtitle1 as="h3" id="app1-video-heading">
        {text.videoHeading}
      </Subtitle1>
      <iframe
        className={s.frame}
        src={url}
        title={text.videoTitle}
        loading="lazy"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        data-testid="official-video"
      />
    </section>
  );
}
