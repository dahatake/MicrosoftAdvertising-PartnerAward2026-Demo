// App1 のペルソナごとの既定のレイアウト（FR-021、要求定義書 §7）。
// パネル ID: visual=製品ビュー（P-1）・構成図（P-2）、scenes=説明・利用シーン、values=価値説明、video=公式動画、narration=ナレーション。
import type { LayoutDefaults } from '../layout/model';
import type { PersonaId } from './content';

/** 画面（要求定義書 §7）のペルソナ ID（P-1・P-2）への対応 */
export const PERSONA_LABEL: Record<PersonaId, string> = { p1: 'P-1', p2: 'P-2' };

export const APP1_PANEL_IDS = ['visual', 'scenes', 'values', 'video', 'narration'] as const;

export const APP1_PERSONA_LAYOUT: Record<string, LayoutDefaults> = {
  // 製品ビュー大・説明小
  'P-1': { order: ['visual', 'scenes', 'values', 'video', 'narration'], sizes: { visual: 3, scenes: 1 } },
  // 説明大・構成図小
  'P-2': { order: ['scenes', 'visual', 'values', 'narration', 'video'], sizes: { scenes: 3, visual: 1 } },
};
