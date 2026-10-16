// App1（Surface Ultra 広告キャンペーンサイト）の文言。ja/en/zh/ko の 4 言語を型で必須にする（欠落は app1.test.tsx でも検出）。
// 素材（画像・動画）は仮置きのダミー。製品の仕様値は書かない（価値説明は依頼の「最強の没入感」「最高のリッチなエクスペリエンス」に沿う）。
import type { Lang } from '../i18n';

export type PersonaId = 'p1' | 'p2';
export const PERSONAS: readonly PersonaId[] = ['p1', 'p2'];
export type NodeId = 'display' | 'cpu' | 'npu' | 'memory' | 'dev' | 'cloud';
export const nodeIds: readonly NodeId[] = ['display', 'cpu', 'npu', 'memory', 'dev', 'cloud'];

export interface Scene {
  title: string;
  body: string;
}

export interface App1Text {
  heroHeading: string;
  heroLead: string;
  cta: string;
  ctaHint: string;
  valueHeading: string;
  valuePoints: { title: string; body: string }[];
  personaHeading: string;
  personaLabel: Record<PersonaId, string>;
  personaDesc: Record<PersonaId, string>;
  start: string;
  scenesHeading: string;
  scenes: Record<PersonaId, Scene[]>;
  productHeading: string;
  productDesc: string;
  product2dLabel: string;
  product3dLabel: string;
  product3dHelp: string;
  archHeading: string;
  archSummary: string;
  archCaption: string;
  archCols: [string, string, string];
  nodes: Record<NodeId, string>;
  links: { from: NodeId; to: NodeId; label: string }[];
  videoHeading: string;
  videoTitle: string;
  pres: { label: string; prev: string; next: string; stop: string; close: string; hint: string };
}

export const app1Text: Record<Lang, App1Text> = {
  ja: {
    heroHeading: 'Surface Ultra',
    heroLead: '最強の没入感と、最高のリッチなエクスペリエンスを、あなたの制作と開発に。',
    cta: '公式サイトで詳しく見る',
    ctaHint: '新しいタブで公式サイトが開きます。',
    valueHeading: 'Surface Ultra の価値',
    valuePoints: [
      { title: '最強の没入感', body: '大きく鮮やかな表示と滑らかな動きで、作品の世界に入り込めます。' },
      { title: '最高のリッチなエクスペリエンス', body: '映像・音・操作の質感がそろい、使うたびに心地よさが続きます。' },
      { title: '制作も開発も一台で', body: '創作の現場から開発の現場まで、同じ一台で切り替えずに使えます。' },
    ],
    personaHeading: 'ペルソナを選ぶ',
    personaLabel: { p1: 'クリエイター', p2: 'ソフトウェアエンジニア' },
    personaDesc: {
      p1: '映像・画像・デザインを仕上げる方向けの利用シーンです。',
      p2: 'アプリやサービスを作り、動かす方向けの利用シーンです。',
    },
    start: 'プレゼンテーションを開始',
    scenesHeading: '利用シーン',
    scenes: {
      p1: [
        { title: '発想をすぐ形にする', body: 'ペンで描いた線がそのまま画面に現れ、アイデアを逃さず形にできます。' },
        { title: '大きな画面で細部まで仕上げる', body: '色と質感を確かめながら、映像や画像の細部を納得いくまで磨けます。' },
        { title: '現場から届けまで', body: '書き出しと共有までを、場所を選ばずにその一台で進められます。' },
      ],
      p2: [
        { title: '開発環境をすぐ立ち上げる', body: '必要なツールをそろえ、コードを書き始めるまでの待ち時間を短くします。' },
        { title: 'AI 処理を手元で動かす', body: '専用の演算部で、AI を使う機能を手元で試して確かめられます。' },
        { title: '手元からクラウドまでつなぐ', body: 'ローカルでの確認から、クラウドへの展開までを一続きの流れで進められます。' },
      ],
    },
    productHeading: '製品ビュー',
    productDesc: 'Surface Ultra は、広く薄い画面と、静かで力強い本体を一つにした仮想の製品です。ここでは仮置きのモデルで外観を確かめられます。',
    product2dLabel: '製品の 2D ビュー（仮置き）',
    product3dLabel: '製品の 3D ビュー（仮置き）。ドラッグまたは矢印キーで回転、＋/− キーで拡大・縮小できます。',
    product3dHelp: 'ドラッグまたは矢印キーで回転、＋/− キーで拡大・縮小',
    archHeading: '製品の構成図',
    archSummary: '画面・プロセッサ・AI 演算部・メモリ・開発環境・クラウドが、プロセッサを中心につながります。',
    archCaption: '構成要素の関係（構成図と同じ内容）',
    archCols: ['要素', 'つながる先', '関係'],
    nodes: { display: '画面', cpu: 'プロセッサ', npu: 'AI 演算部', memory: 'メモリ', dev: '開発環境', cloud: 'クラウド' },
    links: [
      { from: 'display', to: 'cpu', label: '映像を受け取る' },
      { from: 'cpu', to: 'npu', label: 'AI 処理を任せる' },
      { from: 'cpu', to: 'memory', label: 'データを読み書きする' },
      { from: 'cpu', to: 'dev', label: 'ツールを動かす' },
      { from: 'dev', to: 'cloud', label: '展開する' },
    ],
    videoHeading: '公式動画',
    videoTitle: 'Surface Ultra の公式動画',
    pres: { label: 'プレゼンテーション', prev: '前へ', next: '次へ', stop: '停止', close: '閉じる', hint: '← → で場面を移動、Esc で閉じます。' },
  },
  en: {
    heroHeading: 'Surface Ultra',
    heroLead: 'The strongest immersion and the richest experience, for your creative and development work.',
    cta: 'Learn more on the official site',
    ctaHint: 'The official site opens in a new tab.',
    valueHeading: 'The value of Surface Ultra',
    valuePoints: [
      { title: 'The strongest immersion', body: 'A large, vivid display and smooth motion pull you into your work.' },
      { title: 'The richest experience', body: 'Visuals, sound and touch come together, so every use feels good.' },
      { title: 'Create and build on one device', body: 'From creative work to development, use the same device without switching.' },
    ],
    personaHeading: 'Choose a persona',
    personaLabel: { p1: 'Creator', p2: 'Software engineer' },
    personaDesc: {
      p1: 'Usage scenes for people who finish video, images and design.',
      p2: 'Usage scenes for people who build and run apps and services.',
    },
    start: 'Start presentation',
    scenesHeading: 'Usage scenes',
    scenes: {
      p1: [
        { title: 'Turn ideas into shape right away', body: 'Lines drawn with the pen appear on screen as you draw, so no idea is lost.' },
        { title: 'Polish details on a large screen', body: 'Check color and texture while refining every detail of video and images.' },
        { title: 'From the field to delivery', body: 'Export and share from anywhere, all on the same device.' },
      ],
      p2: [
        { title: 'Spin up a dev environment fast', body: 'Get your tools ready and shorten the wait before you start writing code.' },
        { title: 'Run AI workloads locally', body: 'A dedicated compute unit lets you try AI features right on your device.' },
        { title: 'Connect your device to the cloud', body: 'Go from local checks to cloud rollout in one continuous flow.' },
      ],
    },
    productHeading: 'Product view',
    productDesc: 'Surface Ultra is a fictional product that combines a wide, thin display with a quiet, powerful body. Here you can check its look with a placeholder model.',
    product2dLabel: '2D product view (placeholder)',
    product3dLabel: '3D product view (placeholder). Drag or use the arrow keys to rotate, and the + / - keys to zoom.',
    product3dHelp: 'Drag or use arrow keys to rotate, + / - keys to zoom',
    archHeading: 'Product architecture',
    archSummary: 'The display, processor, AI compute unit, memory, dev environment and cloud connect around the processor.',
    archCaption: 'Relations between components (same content as the diagram)',
    archCols: ['Component', 'Connects to', 'Relation'],
    nodes: { display: 'Display', cpu: 'Processor', npu: 'AI compute unit', memory: 'Memory', dev: 'Dev environment', cloud: 'Cloud' },
    links: [
      { from: 'display', to: 'cpu', label: 'Receives the video' },
      { from: 'cpu', to: 'npu', label: 'Hands off AI work' },
      { from: 'cpu', to: 'memory', label: 'Reads and writes data' },
      { from: 'cpu', to: 'dev', label: 'Runs the tools' },
      { from: 'dev', to: 'cloud', label: 'Rolls out' },
    ],
    videoHeading: 'Official video',
    videoTitle: 'Official Surface Ultra video',
    pres: { label: 'Presentation', prev: 'Previous', next: 'Next', stop: 'Stop', close: 'Close', hint: 'Use ← → to move between scenes and Esc to close.' },
  },
  zh: {
    heroHeading: 'Surface Ultra',
    heroLead: '最强的沉浸感与最丰富的体验，为您的创作与开发而生。',
    cta: '前往官方网站了解详情',
    ctaHint: '官方网站将在新标签页中打开。',
    valueHeading: 'Surface Ultra 的价值',
    valuePoints: [
      { title: '最强的沉浸感', body: '宽大鲜艳的显示与流畅的动态，让您沉浸在作品的世界里。' },
      { title: '最丰富的体验', body: '影像、声音与操作质感合一，每次使用都舒适顺心。' },
      { title: '创作与开发，一台搞定', body: '从创作现场到开发现场，无需切换设备即可使用。' },
    ],
    personaHeading: '选择角色',
    personaLabel: { p1: '创作者', p2: '软件工程师' },
    personaDesc: {
      p1: '面向完成视频、图像和设计的人群的使用场景。',
      p2: '面向开发并运行应用和服务的人群的使用场景。',
    },
    start: '开始演示',
    scenesHeading: '使用场景',
    scenes: {
      p1: [
        { title: '让灵感立刻成形', body: '用笔画下的线条即时呈现在屏幕上，不会错过任何想法。' },
        { title: '在大屏幕上打磨细节', body: '一边确认色彩与质感，一边把影像和图像的细节打磨到满意。' },
        { title: '从现场到交付', body: '导出与分享，随时随地都能在这一台设备上完成。' },
      ],
      p2: [
        { title: '快速搭建开发环境', body: '备齐所需工具，缩短开始写代码之前的等待。' },
        { title: '在本地运行 AI 处理', body: '借助专用的运算单元，可以在本机试用并验证 AI 功能。' },
        { title: '从本机连接到云端', body: '从本地验证到云端部署，一气呵成。' },
      ],
    },
    productHeading: '产品视图',
    productDesc: 'Surface Ultra 是一款虚拟产品，将宽而薄的显示屏与安静而强劲的机身合为一体。这里可以通过临时模型查看外观。',
    product2dLabel: '产品 2D 视图（临时）',
    product3dLabel: '产品 3D 视图（临时）。拖动或使用方向键旋转，使用 + / − 键缩放。',
    product3dHelp: '拖动或使用方向键旋转，+ / − 键缩放',
    archHeading: '产品构成图',
    archSummary: '显示屏、处理器、AI 运算单元、内存、开发环境和云端，以处理器为中心相互连接。',
    archCaption: '构成要素的关系（与构成图内容相同）',
    archCols: ['要素', '连接对象', '关系'],
    nodes: { display: '显示屏', cpu: '处理器', npu: 'AI 运算单元', memory: '内存', dev: '开发环境', cloud: '云端' },
    links: [
      { from: 'display', to: 'cpu', label: '接收影像' },
      { from: 'cpu', to: 'npu', label: '交由其处理 AI 任务' },
      { from: 'cpu', to: 'memory', label: '读写数据' },
      { from: 'cpu', to: 'dev', label: '运行工具' },
      { from: 'dev', to: 'cloud', label: '部署' },
    ],
    videoHeading: '官方视频',
    videoTitle: 'Surface Ultra 官方视频',
    pres: { label: '演示', prev: '上一个', next: '下一个', stop: '停止', close: '关闭', hint: '用 ← → 切换场景，按 Esc 关闭。' },
  },
  ko: {
    heroHeading: 'Surface Ultra',
    heroLead: '최강의 몰입감과 가장 풍부한 경험을, 당신의 제작과 개발에 선사합니다.',
    cta: '공식 사이트에서 자세히 보기',
    ctaHint: '공식 사이트가 새 탭에서 열립니다.',
    valueHeading: 'Surface Ultra의 가치',
    valuePoints: [
      { title: '최강의 몰입감', body: '크고 선명한 화면과 부드러운 움직임이 작품의 세계로 이끕니다.' },
      { title: '가장 풍부한 경험', body: '영상, 소리, 조작감이 어우러져 쓸 때마다 편안함이 이어집니다.' },
      { title: '제작도 개발도 한 대로', body: '창작 현장부터 개발 현장까지 기기를 바꾸지 않고 쓸 수 있습니다.' },
    ],
    personaHeading: '페르소나 선택',
    personaLabel: { p1: '크리에이터', p2: '소프트웨어 엔지니어' },
    personaDesc: {
      p1: '영상, 이미지, 디자인을 완성하는 분을 위한 사용 장면입니다.',
      p2: '앱과 서비스를 만들고 실행하는 분을 위한 사용 장면입니다.',
    },
    start: '프레젠테이션 시작',
    scenesHeading: '사용 장면',
    scenes: {
      p1: [
        { title: '아이디어를 바로 형태로', body: '펜으로 그린 선이 그대로 화면에 나타나 아이디어를 놓치지 않습니다.' },
        { title: '큰 화면에서 세부까지 완성', body: '색과 질감을 확인하며 영상과 이미지의 디테일을 만족할 때까지 다듬습니다.' },
        { title: '현장에서 전달까지', body: '내보내기와 공유까지 장소에 구애받지 않고 이 한 대로 진행합니다.' },
      ],
      p2: [
        { title: '개발 환경을 빠르게 구축', body: '필요한 도구를 갖추고 코드를 쓰기 시작하기까지의 대기 시간을 줄입니다.' },
        { title: 'AI 처리를 내 기기에서', body: '전용 연산부로 AI 기능을 내 기기에서 시험하고 확인할 수 있습니다.' },
        { title: '내 기기에서 클라우드까지', body: '로컬 확인부터 클라우드 적용까지 하나의 흐름으로 진행합니다.' },
      ],
    },
    productHeading: '제품 보기',
    productDesc: 'Surface Ultra는 넓고 얇은 화면과 조용하고 강력한 본체를 하나로 합친 가상의 제품입니다. 여기서는 임시 모델로 외관을 확인할 수 있습니다.',
    product2dLabel: '제품 2D 보기(임시)',
    product3dLabel: '제품 3D 보기(임시). 드래그하거나 화살표 키로 회전하고, + / − 키로 확대·축소합니다.',
    product3dHelp: '드래그 또는 화살표 키로 회전, + / − 키로 확대·축소',
    archHeading: '제품 구성도',
    archSummary: '화면, 프로세서, AI 연산부, 메모리, 개발 환경, 클라우드가 프로세서를 중심으로 연결됩니다.',
    archCaption: '구성 요소의 관계(구성도와 같은 내용)',
    archCols: ['요소', '연결 대상', '관계'],
    nodes: { display: '화면', cpu: '프로세서', npu: 'AI 연산부', memory: '메모리', dev: '개발 환경', cloud: '클라우드' },
    links: [
      { from: 'display', to: 'cpu', label: '영상을 받음' },
      { from: 'cpu', to: 'npu', label: 'AI 처리를 맡김' },
      { from: 'cpu', to: 'memory', label: '데이터를 읽고 씀' },
      { from: 'cpu', to: 'dev', label: '도구를 실행' },
      { from: 'dev', to: 'cloud', label: '적용' },
    ],
    videoHeading: '공식 동영상',
    videoTitle: 'Surface Ultra 공식 동영상',
    pres: { label: '프레젠테이션', prev: '이전', next: '다음', stop: '정지', close: '닫기', hint: '← →로 장면을 이동하고 Esc로 닫습니다.' },
  },
};
