# Microsoft Surface Ultra 広告デモ

架空の製品「Microsoft Surface Ultra」を題材に、広告代理店向けの 2 つのアプリを 1 つの画面（シェル）から切り替えて見せるデモです。
製品・仕様・画像・動画・ロゴはすべて仮置きのダミーです。認証（ログイン）機能はありません。

| アプリ | 内容 |
|---|---|
| **App1 広告キャンペーンサイト** | クリエイターとソフトウェアエンジニア向けに Surface Ultra の価値を、3D・CG アニメーション・ナレーション・多言語（日本語・英語・韓国語ほか）で伝え、公式サイトへ誘導します。ペルソナ別の全画面プレゼンテーション、公式動画の埋め込み（任意）にも対応します。 |
| **App2 広告素材管理システム** | 企画 → 見積 → 制作 → 展開 → 利用状況の情報を、関係が分かる形で可視化します。企画の確定・見積の提出と承認、素材・チャネル展開、KPI/OKR、変更履歴、what-if（変更の影響の試算）を備えます。データはシード JSON（`src/app2/data/seed.json`）です。 |

両アプリ共通の機能: 2D/3D の表示切替、カメラワーク選択、ワークスペースのレイアウト変更、ペルソナ別の情報表現、コマンドパレット、アクセシビリティ（キーボード操作・動きの軽減）。

## 技術スタック

React 18 / TypeScript / Vite / Fluent UI / three.js（react-three-fiber）/ framer-motion / Vitest / Playwright。
Azure Speech のトークンを発行する軽量な Node.js サーバー（`server/`）を併用します。

## 前提

- Node.js（LTS 推奨）と npm
- （任意）ナレーションを使う場合は Azure Speech のキー。キーがなくても他の機能は動作します。

## 起動手順

```powershell
npm install
npm run dev
```

表示された URL（Vite の既定は <http://localhost:5173>）をブラウザーで開き、画面上部のトグルで App1 / App2 を切り替えます。

### ナレーション（Azure Speech）を使う場合

`.env.example` を `.env` にコピーして値を設定し、別のターミナルでトークン発行サーバーを起動します。

```
SPEECH_KEY=<Azure Speech のキー>
SPEECH_REGION=japaneast
PORT=8787
```

```powershell
npm run server
```

開発サーバーは `/api` をこのサーバー（既定 8787）へ中継します。キーなどの秘密情報はコミットしないでください。

## 主なコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 型チェックと本番ビルド（`dist/`） |
| `npm run preview` | ビルド成果物を 4317 番ポートで配信 |
| `npm run server` | Speech トークン発行サーバーを起動 |
| `npm test` | 単体・結合テスト（Vitest） |
| `npm run test:e2e` | System Test（Playwright。build して preview を起動して実行） |

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `src/app1/`、`src/app2/` | 各アプリ本体 |
| `src/shell/`、`src/layout/`、`src/commands/` | シェル、レイアウト、コマンドパレット |
| `src/camera/`、`src/narration/`、`src/i18n/`、`src/theme/` | カメラワーク、ナレーション、多言語、テーマ |
| `server/` | Speech トークン発行サーバー |
| `tests/system/` | System Test と台帳（`ledger.json`） |
| `docs/` | 要求定義書（`requirements-definition.md`）・カタログ・決定記録 |
| `EABK-docs/`、`EABK-Studio/` | 開発キット（Enterprise App Build Kit）の手順書と管理画面 |
| `scripts/` | 検証・採番などのスクリプト |

## 開発の進め方

要求の正本は [docs/requirements-definition.md](docs/requirements-definition.md) です。開発キットの検証は次のコマンドで行い、exit 0 が合格です。

```powershell
python scripts/verify.py
```

詳細は [EABK-docs/README.md](EABK-docs/README.md) を参照してください。

## ライセンス

[LICENSE](LICENSE) を参照してください。
