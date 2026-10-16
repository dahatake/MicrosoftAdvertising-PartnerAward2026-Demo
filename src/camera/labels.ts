// カメラワークの文言（日/英/中/韓）。画面には平易な言葉だけを出し、英語の専門名は TECH_NAMES（詳細・ツールチップ）にだけ置く（AC-032）。
import type { Lang } from '../i18n';
import type { Angle, Character, CameraPart, Motion, Size } from './model';

export interface CameraLabels {
  title: string;
  simple: string;
  detail: string;
  slider: string;
  calm: string;
  flashy: string;
  now: string;
  nowCustom: string;
  preview: string;
  partNames: Record<CameraPart, string>;
  presets: readonly string[];
  size: Record<Size, string>;
  angle: Record<Angle, string>;
  motion: Record<Motion, string>;
  character: Record<Character, string>;
  only3d: string;
  unavailable: string;
  reducedNote: string;
  fallbackNote: string;
}

export const CAMERA_LABELS: Record<Lang, CameraLabels> = {
  ja: {
    title: 'カメラワーク',
    simple: 'かんたん選択',
    detail: 'くわしく選択',
    slider: '雰囲気',
    calm: '落ち着き',
    flashy: '派手',
    now: 'いま',
    nowCustom: 'いま',
    preview: '動きの見本',
    partNames: { size: '大きさ', angle: '角度', motion: '動き', character: '動きの性格' },
    presets: [
      'じっくり説明',
      '製品をきれいに見せる',
      '映画のように',
      'その場にいる感じ',
      'テンポよく見せる',
      '広告らしく印象的に',
      '非現実的な視点',
      '音楽に合わせて激しく',
      '迫力のゲーム風',
    ],
    size: { medium: 'ふつう', wide: '広く', close: '寄り', extreme: 'ぐっと寄り' },
    angle: { level: '正面', high: '上から', low: '下から', tilt: '斜め' },
    motion: { still: '動かない', orbit: 'ぐるっと回る', flythrough: '奥へ進む', pan: '横に動く', zoom: '近づく' },
    character: { gentle: 'ゆっくり', smooth: 'なめらか', snappy: 'きびきび', bouncy: '弾むように', shaky: '揺れる' },
    only3d: '2D では使えません（奥行きが必要なため）',
    unavailable: '2D では表現できない選択肢はグレーで表示しています。3D に切り替えると選べます。',
    reducedNote: '「動きを減らす」設定のため、動かさずに表示しています。',
    fallbackNote: '2D では近い動きに置き換えて表示しています。',
  },
  en: {
    title: 'Camera movement',
    simple: 'Easy choice',
    detail: 'Detailed choice',
    slider: 'Mood',
    calm: 'Calm',
    flashy: 'Flashy',
    now: 'Now',
    nowCustom: 'Now',
    preview: 'Motion sample',
    partNames: { size: 'Size', angle: 'Angle', motion: 'Movement', character: 'Feel of movement' },
    presets: [
      'Explain at a steady pace',
      'Show the product beautifully',
      'Cinematic',
      'Feels like being there',
      'Quick and rhythmic',
      'Striking, ad-style',
      'Surreal viewpoint',
      'Intense, to the music',
      'Powerful, game-style',
    ],
    size: { medium: 'Normal', wide: 'Wide', close: 'Close', extreme: 'Very close' },
    angle: { level: 'Straight on', high: 'From above', low: 'From below', tilt: 'Slanted' },
    motion: { still: 'Stay still', orbit: 'Circle around', flythrough: 'Move forward', pan: 'Slide sideways', zoom: 'Move closer' },
    character: { gentle: 'Slow', smooth: 'Smooth', snappy: 'Brisk', bouncy: 'Bouncy', shaky: 'Shaky' },
    only3d: 'Not available in 2D (needs depth)',
    unavailable: 'Choices that 2D cannot show are grayed out. Switch to 3D to use them.',
    reducedNote: 'Shown without motion because "reduce motion" is on.',
    fallbackNote: 'In 2D, a similar movement is shown instead.',
  },
  zh: {
    title: '镜头运动',
    simple: '简单选择',
    detail: '详细选择',
    slider: '氛围',
    calm: '沉稳',
    flashy: '华丽',
    now: '当前',
    nowCustom: '当前',
    preview: '动作示例',
    partNames: { size: '大小', angle: '角度', motion: '动作', character: '动作风格' },
    presets: [
      '从容讲解',
      '美观展示产品',
      '电影感',
      '身临其境',
      '节奏明快',
      '广告般醒目',
      '超现实视角',
      '随音乐激烈变化',
      '震撼的游戏风',
    ],
    size: { medium: '适中', wide: '广阔', close: '近景', extreme: '特写' },
    angle: { level: '正面', high: '从上方', low: '从下方', tilt: '倾斜' },
    motion: { still: '不动', orbit: '绕着转', flythrough: '向里前进', pan: '横向移动', zoom: '靠近' },
    character: { gentle: '缓慢', smooth: '流畅', snappy: '利落', bouncy: '弹跳', shaky: '晃动' },
    only3d: '2D 中无法使用（需要纵深）',
    unavailable: '2D 无法表现的选项显示为灰色。切换到 3D 后即可选择。',
    reducedNote: '由于开启了“减少动态效果”，将不加动作地显示。',
    fallbackNote: '在 2D 中以相近的动作代替显示。',
  },
  ko: {
    title: '카메라 움직임',
    simple: '간단 선택',
    detail: '자세히 선택',
    slider: '분위기',
    calm: '차분함',
    flashy: '화려함',
    now: '현재',
    nowCustom: '현재',
    preview: '움직임 예시',
    partNames: { size: '크기', angle: '각도', motion: '움직임', character: '움직임의 성격' },
    presets: [
      '차근차근 설명',
      '제품을 예쁘게 보여주기',
      '영화처럼',
      '현장에 있는 느낌',
      '경쾌하게 보여주기',
      '광고처럼 인상적으로',
      '비현실적인 시점',
      '음악에 맞춰 격렬하게',
      '박력 있는 게임 스타일',
    ],
    size: { medium: '보통', wide: '넓게', close: '가까이', extreme: '아주 가까이' },
    angle: { level: '정면', high: '위에서', low: '아래에서', tilt: '비스듬히' },
    motion: { still: '움직이지 않음', orbit: '빙 돌기', flythrough: '안으로 나아가기', pan: '옆으로 이동', zoom: '다가가기' },
    character: { gentle: '느리게', smooth: '부드럽게', snappy: '민첩하게', bouncy: '통통 튀듯', shaky: '흔들림' },
    only3d: '2D에서는 사용할 수 없습니다(깊이가 필요함)',
    unavailable: '2D로 표현할 수 없는 선택지는 회색으로 표시됩니다. 3D로 전환하면 선택할 수 있습니다.',
    reducedNote: '"동작 줄이기" 설정이 켜져 있어 움직임 없이 표시합니다.',
    fallbackNote: '2D에서는 비슷한 움직임으로 대체해 표시합니다.',
  },
};

/** 英語の専門名。詳細・ツールチップ（title）にだけ出す */
export const TECH_NAMES = {
  size: { medium: 'Medium Shot', wide: 'Wide Shot', close: 'Close-up', extreme: 'Extreme Close-up' },
  angle: { level: 'Eye Level', high: 'High Angle', low: 'Low Angle', tilt: 'Dutch Angle' },
  motion: { still: 'Static', orbit: 'Orbit', flythrough: 'Fly-through', pan: 'Pan', zoom: 'Zoom' },
  character: { gentle: 'Slow ease', smooth: 'Ease-in-out', snappy: 'Ease-out fast', bouncy: 'Bounce', shaky: 'Handheld shake' },
} as const;

export function nowText(l: CameraLabels, preset: number | null, parts: { size: Size; angle: Angle; motion: Motion; character: Character }): string {
  if (preset !== null) return `${l.now}: ${l.presets[preset]}`;
  return `${l.nowCustom}: ${l.size[parts.size]}・${l.angle[parts.angle]}・${l.motion[parts.motion]}・${l.character[parts.character]}`;
}
