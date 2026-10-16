// 再利用できるナレーション部品: 台本（script）と言語（lang）を受け取り、再生・停止・字幕（トランスクリプト）を表示する。
// 使い方: <Narration script={getScript('valueIntro', lang)} lang={lang} />
// 契約: narration-play / narration-stop / narration-status[data-state][data-lang] / narration-transcript / narration-transcript-toggle
import { useCallback, useEffect, useRef, useState } from 'react';
import { Body1, Button, MessageBar, MessageBarBody, makeStyles, tokens } from '@fluentui/react-components';
import { Play24Regular, Stop24Regular } from '@fluentui/react-icons';
import type { Lang } from '../i18n';
import { useT } from '../i18n/useT';
import { spacing } from '../theme/theme';
import { canUseBrowserSpeech, speakWithAzure, speakWithBrowser, type Playback } from './speech';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', gap: spacing.s },
  controls: { display: 'flex', alignItems: 'center', gap: spacing.s, flexWrap: 'wrap' },
  transcript: {
    margin: 0,
    padding: spacing.m,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    whiteSpace: 'pre-wrap',
  },
});

export interface NarrationProps {
  /** 読み上げる台本（選択中の言語の本文。narrationScripts / getScript で得る） */
  script: string;
  lang: Lang;
}

type State = 'stopped' | 'playing';
type Notice = 'none' | 'fallback' | 'unavailable';

export function Narration({ script, lang }: NarrationProps) {
  const s = useStyles();
  const t = useT();
  const [state, setState] = useState<State>('stopped');
  const [notice, setNotice] = useState<Notice>('none');
  const [open, setOpen] = useState(true);
  const seq = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const playback = useRef<Playback | null>(null);

  const stop = useCallback(() => {
    seq.current += 1;
    abort.current?.abort();
    abort.current = null;
    playback.current?.stop();
    playback.current = null;
    setState('stopped');
  }, []);

  const play = useCallback(async () => {
    stop();
    const my = seq.current;
    const ac = new AbortController();
    abort.current = ac;
    setNotice('none');
    setState('playing');
    const attach = (p: Playback) => {
      if (my !== seq.current) {
        p.stop();
        return;
      }
      playback.current = p;
      void p.done.then(() => {
        if (my === seq.current) setState('stopped');
      });
    };
    try {
      attach(await speakWithAzure(script, lang, ac.signal));
    } catch {
      if (my !== seq.current) return;
      if (canUseBrowserSpeech()) {
        setNotice('fallback');
        attach(speakWithBrowser(script, lang));
      } else {
        setNotice('unavailable');
        setState('stopped');
      }
    }
  }, [script, lang, stop]);

  // AC-017: 言語が変わったら止める。AC-018: 離れる・切り替える・閉じるとき止める
  useEffect(() => {
    stop();
    setNotice('none');
  }, [lang, script, stop]);
  useEffect(() => {
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return (
    <div className={s.root}>
      <div className={s.controls}>
        <Button
          appearance="primary"
          icon={<Play24Regular />}
          disabled={state === 'playing'}
          onClick={() => void play()}
          data-testid="narration-play"
          aria-label={t('narration.playLabel')}
        >
          {t('narration.play')}
        </Button>
        <Button icon={<Stop24Regular />} onClick={stop} data-testid="narration-stop" aria-label={t('narration.stopLabel')}>
          {t('narration.stop')}
        </Button>
        <Body1 role="status" data-testid="narration-status" data-state={state} data-lang={lang}>
          {state === 'playing' ? t('narration.playing') : t('narration.stopped')}
        </Body1>
        <Button
          appearance="subtle"
          aria-expanded={open}
          aria-controls="narration-transcript"
          onClick={() => setOpen((o) => !o)}
          data-testid="narration-transcript-toggle"
        >
          {open ? t('narration.hideTranscript') : t('narration.showTranscript')}
        </Button>
      </div>
      {notice !== 'none' && (
        <MessageBar intent={notice === 'fallback' ? 'info' : 'warning'} data-testid="narration-notice" data-kind={notice}>
          <MessageBarBody>{notice === 'fallback' ? t('narration.fallback') : t('narration.unavailable')}</MessageBarBody>
        </MessageBar>
      )}
      {open && (
        <p id="narration-transcript" lang={lang} className={s.transcript} data-testid="narration-transcript">
          {script}
        </p>
      )}
    </div>
  );
}
