# 元のPrompt(全文)

要求定義書のメモを作成して`/work/rd-draft.md`に保存をします。
- 2つのアプリを画面上部のトグル切り替えられる
- 認証なし
- 1) 広告キャンペーンのWebサイト。題材は、Microsoft Surface Ultraの一般コンシューマー向け。ターゲットは、いつでもどこでもCopilotとPromptをしてアプリやWebコンテンツや動画コンテンツなどの制作を楽しみたいクリエイターやソフトウェアエンジニア。最強の没入感と最高のリッチなエクスペリエンス。価値の説明と公式サイトへの誘導。YouTubeにMicrosoft公式動画があればそれも埋め込む。Microsoft Surface Ultraの利用シーンをイメージさせるユースケースと、CGアニメーション。2D/3Dの体験。Azure Speech連携でのナレーション。Azure Speechのキーは添付。ログインしたユーザーの言語によって、日本語/英語/中国語/韓国語での表示と、言語切り替え機能。レンダリングの品質を最高品質に。全てのコンテンツ内の情報が有機的にかつ体系的に構造化され関連付けられていて、それを2Dの場合はメニューや、動的にスムーズに変化する画面内の動きで表現を試みて、3Dの場合は、Microsoft Surface Ultraのブランドイメージでの空間を作成して表現をする。ペルソナ毎のリッチな全画面での商品の価値説明のプレゼンテーション機能つき。Microsoft Surface Ultraのブランドイメージを厳守

- 2) 広告コンテンツ素材の管理システム。ダミーとしてのMicrosoft Advertizing Tokyo - 畠山支店。広告代理店の広告企画から、予算見積もり、制作(外部への発注も含む)、マルチチャネルへの展開と、展開後の利用状況(KPI設定された顧客サイトへの誘導など)。それぞれ2D/3Dでビジネスエンティティを関連付けて表現。コンテンツはMicrosoft Surface Ultraを使用。YouTubeや公式サイトからデータを入手。不足している場合は画像/動画などを私が後で提示します。各制作プロジェクトの進捗状況・予算の消化状況・成果物やKPIなどの可視化がされている。企画や見積もりや、制作途中での変更を許容して、それぞれ結果としてのKPIやOKRのシミュレーションができる。Microsoft Designにのベストプラクティスに基づいたモダンで落ち着いたデザイン。

このオリジナルのPromptの全文も、ファイルに保存をしてください。

(添付: `AzureSpeech.txt`(Azure Speechキー、3行)。機密のため本ファイルには内容を転記しない。)


---

# 追加Prompt 1(カメラワーク)全文

2D/3DのUIや、プレゼンテーションにカメラワークの選択ができるオプションを入れてください。私はカメラワークに詳しくないので、画面上では私がその設定で何がどう変わるのかを理解が出来る端的な言葉で選択肢を表現してください。

---
# カメラワーク分類

カメラワークは基本的に、次の4要素の組み合わせとして記述できる。

> **Shot Size × Camera Angle × Camera Movement × Motion Character**

## 1. Shot Size：被写体をどの大きさで捉えるか

- Extreme Wide Shot (EWS): 環境・世界観を主役にする
- Wide Shot (WS): 人物と周囲の関係を見せる
- Full Shot (FS): 人物・製品の全体を見せる
- Medium Shot (MS): 上半身中心。プレゼンや会話向き
- Medium Close-Up (MCU): 表情と話の内容に集中
- Close-Up (CU): 表情・製品ディテールを強調
- Extreme Close-Up (ECU): 目、ロゴ、質感など一点を強調

## 2. Camera Angle：どの角度から見るか

- Eye Level: 自然・中立・信頼感
- Low Angle: 力強さ・威厳・ヒーロー感
- High Angle: 全体把握・客観性
- Bird's Eye: 真上から。構造や配置を見せる
- Worm's Eye: 極端な下から。巨大さを演出
- Dutch Angle: 傾いた構図。不安定さ・スピード感
- Over-the-Shoulder: 会話・対話・視点共有
- POV: 登場人物本人の視点

## 3. Camera Movement：カメラをどう動かすか

- Static / Locked-off: 完全固定
- Pan: 左右に回転
- Tilt: 上下に回転
- Dolly / Push In: カメラ自体が前進
- Dolly / Pull Out: カメラ自体が後退
- Truck / Tracking: 左右・横方向に移動
- Pedestal: カメラ全体を上下移動
- Orbit / Arc: 被写体の周囲を回り込む
- Crane / Jib: 大きな上下・前後移動
- Handheld: 手持ちカメラ的な動き
- Gimbal / Steadicam: 滑らかな追従移動
- Whip Pan: 高速なPan
- Zoom In / Out: レンズによる画角変化
- Dolly Zoom: DollyとZoomを組み合わせる
- Roll: カメラ自体を回転
- FPV / Fly-through: 空間を飛び抜けるような移動

## 4. Motion Character：どんな「性格」で動かすか

- Locked: 完全に静止
- Slow / Gentle: 非常にゆっくり
- Smooth: 滑らかで機械的
- Floating: 浮遊するような動き
- Natural / Organic: 人間が操作しているような微細な揺れ
- Energetic: テンポの良い動き
- Snappy: 素早く明確な加減速
- Aggressive: 激しくカメラの存在を主張
- Hyperdynamic: 非現実的な高速移動
- Impossible: 物理カメラでは不可能な動き


# 演出スタイル別の典型

## Corporate / Keynote
**目的:** 信頼感・安定感・内容への集中

- Static
- Slow Pan
- Very Slow Dolly In
- Gentle Tracking
- Eye Level
- Medium / Medium Close-Up
- Locked / Smooth / Gentle

例:
`Medium Wide + Eye Level + Slow Dolly In + Smooth`

---

## Product / Tech Keynote
**目的:** 製品をプレミアムかつ魅力的に見せる

- Slow Orbit
- Dolly In
- Macro Close-Up
- Tracking
- Reveal
- Rack Focus
- Smooth / Floating

例:
`Close-Up + Low Angle + Slow Orbit + Floating`

---

## Cinematic / Film
**目的:** ストーリーや心理状態をカメラで補強する

- Motivated Dolly
- Tracking
- Crane
- Pull Out
- Push In
- Natural Handheld
- Smooth / Natural / Organic

例:
`Medium Close-Up + Eye Level + Slow Push In + Natural`

---

## Documentary
**目的:** 「撮影者がその場にいる」感覚を出す

- Handheld
- Follow
- Reframe
- Small Pan Correction
- Shoulder Camera
- Imperfect Composition
- Organic / Natural

例:
`Medium Shot + Eye Level + Handheld Follow + Organic`

---

## YouTube
**目的:** 視聴者の注意を維持し、テンポを作る

- Static Talking Head
- Punch In
- Digital Zoom
- Reframe
- B-roll Cut
- Close / Medium / Wide の切り替え
- Energetic

例:
`Medium → Punch In → Medium → B-roll → Close-Up`

---

## Commercial / Advertisement
**目的:** 短時間で強い印象を作る

- Dolly
- Orbit
- Macro
- Crane
- Speed Ramp
- Dynamic Transition
- Smooth / Energetic

例:
`Macro Close-Up + Fast Dolly Out + Smooth-to-Energetic`

---

## Music Video / MV
**目的:** 音楽・ビートと映像の動きを同期させる

- Whip Pan
- Crash Zoom
- Fast Dolly
- Orbit
- Roll
- Handheld
- FPV
- Speed Ramp
- Dutch Angle
- Aggressive / Snappy / Hyperdynamic

例:
`Medium Close-Up + Low Angle + Fast Orbit + Aggressive`

---

## Anime / Stylized 3D
**目的:** 現実のカメラでは不可能な視点変化を作る

- Extreme Dolly
- 360° Orbit
- Roll
- Fly-through
- Object Pass-through
- Extreme Perspective Change
- Impossible Camera
- Hyperdynamic

例:
`Extreme Close-Up → 360° Orbit → Extreme Wide + Impossible`

---

## Game Trailer
**目的:** スケール・速度・没入感を最大化する

- FPV
- Chase Camera
- Fast Tracking
- Crane
- Orbit
- Fly-through
- Camera Shake
- Hyperdynamic

例:
`Wide + Low Angle + Fast Tracking + Hyperdynamic`


# 落ち着き ↔ 派手さ

おおまかなスペクトラム:

`Corporate Keynote`
→ `Interview`
→ `Documentary`
→ `Cinematic Film`
→ `Product Launch`
→ `Commercial`
→ `Anime`
→ `Music Video`
→ `Game Trailer / FPV`

左ほど「カメラの存在を感じさせない」。
右ほど「カメラそのものが演出になる」。


# カメラワーク記述フォーマット

基本形:

`[Shot Size] + [Camera Angle] + [Camera Movement] + [Motion Character]`

例:

- Keynote:
  `Medium Wide + Eye Level + Slow Dolly In + Smooth`

- Premium Product:
  `Close-Up + Low Angle + Slow Orbit + Floating`

- Cinematic:
  `Medium Close-Up + Eye Level + Slow Push In + Natural`

- Documentary:
  `Medium Shot + Eye Level + Handheld Follow + Organic`

- MV:
  `Medium Close-Up + Low Angle + Fast Orbit + Aggressive`

- Anime:
  `Extreme Close-Up → Extreme Wide + 360° Orbit + Hyperdynamic`

- Game Trailer:
  `Wide + Low Angle + FPV Tracking + Hyperdynamic`


---

# 追加Prompt 2(2D/3Dの扱い)全文

2D/3Dは、単なる表示方法の切り替えなので、独立したセクションは作らないでくだし。情報デザイン高額に基づいた表現方法で行うようにします。
