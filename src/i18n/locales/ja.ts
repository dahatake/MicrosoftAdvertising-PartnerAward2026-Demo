// 辞書の「正本」は ja（キーの型もここから決まる）。
// 新しい画面・機能の文言は、この src/i18n/locales/ の 4 ファイルに同じキーを追加する（欠落は単体テストで検出される）。
// 用語は docs/requirements-definition.md §3.3 の用語表に従う（禁止同義語は使わない）。
export const ja = {
  'app.title': '広告デモ',
  'shell.appSwitch': 'アプリの切替',
  'shell.app1': 'App1 広告キャンペーンサイト',
  'shell.app2': 'App2 広告素材管理',
  'shell.language': '言語',
  'shell.viewMethod': '表示方法',
  'shell.view2d': '2D',
  'shell.view3d': '3D',
  'app1.heading': '広告キャンペーンサイト',
  'app1.lead': '製品の価値を、利用シーンに合わせてわかりやすくご紹介します。',
  'app2.heading': '広告素材管理',
  'app2.lead': 'キャンペーン、企画、見積、素材、発注を一か所で確認できます。',
  'narration.heading': 'ナレーション',
  'narration.play': '再生',
  'narration.stop': '停止',
  'narration.playing': '再生中',
  'narration.stopped': '停止中',
  'narration.showTranscript': '字幕を表示',
  'narration.hideTranscript': '字幕を隠す',
  'narration.fallback': 'Azure Speech を使えないため、ブラウザの音声合成で再生しています。',
  'narration.unavailable': '音声を再生できません。字幕でナレーションの内容を確認できます。',
} as const;

export type MessageKey = keyof typeof ja;
export type Messages = Record<MessageKey, string>;
