// ナレーション台本の辞書。
// 追加方法: ScriptId に ID を足し、narrationScripts に ja/en/zh/ko の 4 言語の台本を同時に足す（型で欠落を防ぎ、単体テストでも検出する）。
// 台本は Narration コンポーネントの script に渡す: <Narration script={getScript('valueIntro', lang)} lang={lang} />
import type { Lang } from '../i18n';

export type ScriptId = 'valueIntro';

export const narrationScripts: Record<ScriptId, Record<Lang, string>> = {
  valueIntro: {
    ja: 'この製品は、広告キャンペーンの企画から制作、配信までを一か所で見渡せるようにします。利用シーンに合わせて、素材や進捗、予算の状況をわかりやすく確認できます。',
    en: 'This product lets you oversee advertising campaigns from planning to production in one place. For each usage scene, you can clearly check assets, progress and budget.',
    zh: '本产品让您在一个地方纵览广告活动从策划到制作的全过程。根据不同的使用场景，您可以清楚地查看素材、进度和预算情况。',
    ko: '이 제품은 광고 캠페인의 기획부터 제작까지를 한곳에서 살펴볼 수 있게 해 줍니다. 사용 장면에 맞춰 소재, 진행 상황, 예산을 알기 쉽게 확인할 수 있습니다.',
  },
};

/** 台本を言語別に取り出す（その言語が空なら ja に戻す） */
export function getScript(id: ScriptId, lang: Lang): string {
  return narrationScripts[id][lang]?.trim() || narrationScripts[id].ja;
}
