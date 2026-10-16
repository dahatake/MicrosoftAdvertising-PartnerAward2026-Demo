import { describe, expect, it } from 'vitest';
import { ja } from './locales/ja';

// 用語表（docs/requirements-definition.md §3.3）の禁止同義語。画面文言（ja）に出してはならない。
// 「クライアント」は顧客の意味でのみ禁止だが、画面文言では使わない。
export const FORBIDDEN_JA = [
  'モード',
  'ビューモード',
  '視点設定',
  'ユーザーロール',
  '画面構成',
  'クライアント',
  '案件',
  'プラン',
  '見積書',
  '制作案件',
  '外注',
  'ベンダー',
  'アセット',
  '媒体',
  '配信',
  '指標',
  '実績',
];

// NFR-UX-003 AC-066 禁止同義語が画面文言（ja）に現れない
describe('NFR-UX-003 AC-066 用語の一貫性', () => {
  it.each(FORBIDDEN_JA)('ja の文言に「%s」が含まれない', (word) => {
    for (const [key, text] of Object.entries(ja)) {
      expect(text, `${key} に禁止同義語「${word}」`).not.toContain(word);
    }
  });
  it('「アプリ」「表示方法」の用語を使う', () => {
    expect(ja['shell.appSwitch']).toContain('アプリ');
    expect(ja['shell.viewMethod']).toBe('表示方法');
  });
});
