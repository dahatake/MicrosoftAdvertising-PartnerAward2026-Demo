// 公式動画の節（AC-008）: 埋め込み先が設定されている（かつ YouTube の https /embed/ の URL）ときだけ表示する。
// 未設定・不正な URL のときは、節の見出し・空の枠・壊れたリンクのどれも出さない（null を返す）。
import { useEffect, useRef, useState } from 'react';
import { Subtitle1, makeStyles, tokens } from '@fluentui/react-components';
import { useSettings } from '../settings/store';
import { spacing } from '../theme/theme';
import { isEmbeddableVideoUrl, OFFICIAL_VIDEO_URL } from './config';
import { app1Text } from './content';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.s },
  frame: { width: '100%', maxWidth: '800px', aspectRatio: '16 / 9', border: 'none', borderRadius: tokens.borderRadiusLarge },
  slot: { width: '100%', maxWidth: '800px' },
});

export function VideoSection({ url = OFFICIAL_VIDEO_URL }: { url?: string }) {
  const s = useStyles();
  const { lang } = useSettings();
  // 動画の埋め込み（第三者への通信）は、節が実際に画面に入ってから読み込む。App2 など別の画面を見ている間は通信しない（FR-027 AC-115 の方針）
  const slot = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (visible || !slot.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true));
    io.observe(slot.current);
    return () => io.disconnect();
  }, [visible]);
  if (!isEmbeddableVideoUrl(url)) return null;
  const text = app1Text[lang];
  return (
    <section className={s.root} aria-labelledby="app1-video-heading" data-testid="video-section">
      <Subtitle1 as="h3" id="app1-video-heading">
        {text.videoHeading}
      </Subtitle1>
      <div ref={slot} className={s.slot} style={visible ? undefined : { aspectRatio: '16 / 9' }}>
        {visible && (
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
        )}
      </div>
    </section>
  );
}
