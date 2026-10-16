// ナレーションの音声出力: Azure Speech（トークンは POST /api/speech/token）を試し、失敗したらブラウザの SpeechSynthesis に切り替える。
// キーはブラウザに置かない（NFR-SEC-001）。ブラウザが受け取るのは短命のトークンだけ。
import type { Lang } from '../i18n';

export const SPEECH_LANG: Record<Lang, string> = { ja: 'ja-JP', en: 'en-US', zh: 'zh-CN', ko: 'ko-KR' };
const AZURE_VOICE: Record<Lang, string> = {
  ja: 'ja-JP-NanamiNeural',
  en: 'en-US-JennyNeural',
  zh: 'zh-CN-XiaoxiaoNeural',
  ko: 'ko-KR-SunHiNeural',
};
const AZURE_TIMEOUT_MS = 8000;

export interface SpeechToken {
  token: string;
  region: string;
}

export async function fetchSpeechToken(signal?: AbortSignal): Promise<SpeechToken> {
  const res = await fetch('/api/speech/token', { method: 'POST', signal });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const body = (await res.json()) as { token?: string; region?: string };
  if (!body.token || !body.region) throw new Error('token invalid');
  return { token: body.token, region: body.region };
}

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** 再生のハンドル。stop() で音声を止める */
export interface Playback {
  stop(): void;
  /** 再生が終わる（または stop された）とき解決 */
  done: Promise<void>;
  /** true なら Azure Speech ではなくブラウザの音声合成で再生している */
  fallback: boolean;
}

export function canUseBrowserSpeech(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function speakWithBrowser(text: string, lang: Lang): Playback {
  const synth = window.speechSynthesis;
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG[lang];
  u.onend = finish;
  u.onerror = finish;
  synth.cancel();
  synth.speak(u);
  return {
    fallback: true,
    done,
    stop() {
      synth.cancel();
      finish();
    },
  };
}

/** Azure Speech の REST（短い音声の合成）で再生する。トークン取得・合成・再生のどこで失敗しても reject する */
export async function speakWithAzure(text: string, lang: Lang, signal: AbortSignal): Promise<Playback> {
  const { token, region } = await fetchSpeechToken(signal);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), AZURE_TIMEOUT_MS);
  const abort = () => timeout.abort();
  signal.addEventListener('abort', abort);
  try {
    const ssml = `<speak version="1.0" xml:lang="${SPEECH_LANG[lang]}"><voice name="${AZURE_VOICE[lang]}">${escapeXml(text)}</voice></speak>`;
    const res = await fetch(`https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: timeout.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    });
    if (!res.ok) throw new Error(`azure ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    let finish!: () => void;
    const done = new Promise<void>((r) => (finish = r));
    const release = () => {
      URL.revokeObjectURL(url);
      finish();
    };
    audio.onended = release;
    audio.onerror = release;
    await audio.play();
    return {
      fallback: false,
      done,
      stop() {
        audio.pause();
        release();
      },
    };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
