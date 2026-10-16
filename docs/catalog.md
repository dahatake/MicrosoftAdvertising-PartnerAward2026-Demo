# カタログ

既存の機能・API・テーブル・共通部品の対応表です。1 行 1 項目の短い表にし、詳細はリンク先のファイルに任せます。
機能の表は rd-author（要求 ID・題名・決定状態）と implementer（実装ファイル・テスト・共通部品）が更新します。
未実装の要求は、実装ファイルとテストの欄を「未実装」とします。

## 機能

| 要求 ID | 題名 | 決定状態 | 実装ファイル | テスト | 使っている共通部品 |
|---|---|---|---|---|---|
| FR-001 | アプリ切替シェル | 承認済み | src/shell/Shell.tsx, src/apps/registry.ts, src/apps/App1.tsx, src/apps/App2.tsx | src/i18n/i18n.test.ts, tests/system/shell-app1.spec.ts | デザイン基盤, 設定ストア, アプリ登録簿 |
| FR-002 | 多言語（ja/en/zh/ko）と言語の切替 | 承認済み | src/i18n/index.ts, src/i18n/useT.ts, src/i18n/locales/ja.ts, src/i18n/locales/en.ts, src/i18n/locales/zh.ts, src/i18n/locales/ko.ts, src/shell/Shell.tsx | src/i18n/i18n.test.ts, tests/system/shell-app1.spec.ts | i18n 辞書, 設定ストア |
| FR-003 | 価値説明・公式サイト誘導・公式動画 | 承認済み | 未実装 | 未実装 | - |
| FR-004 | 利用シーンとペルソナ別全画面プレゼンテーション | 承認済み | 未実装 | 未実装 | - |
| FR-005 | 製品の 3D/CG 表現 | 承認済み | 未実装 | 未実装 | - |
| FR-006 | ナレーション（Azure Speech とフォールバック） | 承認済み | 未実装 | 未実装 | - |
| FR-007 | Speech トークン発行バックエンド | 承認済み | 未実装 | 未実装 | - |
| FR-008 | 2D/3D の表示方法の切替（共通） | 承認済み | src/view/DualView.tsx, src/view/Scene3D.tsx, src/view/ViewModeSwitch.tsx, src/view/useViewMode.ts, src/view/support.ts, src/view/kinds.ts, src/shell/Shell.tsx | src/view/view.test.tsx, tests/system/shell-app1.spec.ts | 表示方法, 設定ストア, デザイン基盤, i18n 辞書 |
| FR-009 | カメラワーク選択 | 承認済み | 未実装 | 未実装 | - |
| FR-010 | ワークスペースのレイアウト変更（共通） | 承認済み | src/layout/model.ts, src/layout/store.ts, src/layout/Workspace.tsx, src/commands/registry.ts, src/commands/CommandPalette.tsx, src/commands/shellCommands.ts, src/apps/App2.tsx | src/layout/layout.test.ts, tests/system/shell-app1.spec.ts | ワークスペース, コマンドの検索, デザイン基盤, i18n 辞書 |
| FR-011 | App2 のデータモデルとシードデータ | 承認済み | 未実装 | 未実装 | - |
| FR-012 | エンティティの関連の可視化 | 承認済み | 未実装 | 未実装 | - |
| FR-013 | 制作プロジェクトの進捗・予算・成果物・KPI の可視化 | 承認済み | 未実装 | 未実装 | - |
| FR-014 | 企画・見積の変更と版の履歴 | 承認済み | 未実装 | 未実装 | - |
| FR-015 | KPI/OKR の what-if シミュレーション | 承認済み | 未実装 | 未実装 | - |
| FR-016 | 素材管理 | 承認済み | 未実装 | 未実装 | - |
| FR-017 | 外部発注の管理 | 承認済み | 未実装 | 未実装 | - |
| FR-018 | ペルソナ別の既定の情報表現と表現の切替（App2） | 承認済み | 未実装 | 未実装 | - |
| NFR-A11Y-001 | キーボード操作と代替手段 | 承認済み | 未実装 | 未実装 | - |
| NFR-A11Y-002 | 動きの軽減（reduced-motion） | 承認済み | 未実装 | 未実装 | - |
| NFR-A11Y-003 | ナレーションの字幕・トランスクリプト | 承認済み | 未実装 | 未実装 | - |
| NFR-PERF-001 | 初期表示と描画の性能 | 承認済み | 未実装 | 未実装 | - |
| NFR-PERF-002 | 低性能端末のフォールバック | 承認済み | 未実装 | 未実装 | - |
| NFR-SEC-001 | Speech キーの保護 | 承認済み | 未実装 | 未実装 | - |
| NFR-UX-001 | 画面サイズ・設定への追従 | 承認済み | 未実装 | 未実装 | - |
| NFR-UX-002 | 状態表示とエラーからの復旧 | 承認済み | 未実装 | 未実装 | - |
| NFR-UX-003 | 用語と操作の一貫性 | 承認済み | src/i18n/locales/ja.ts | src/i18n/terminology.test.ts | i18n 辞書 |
| FR-019 | 素材の展開と KPI・利用状況の登録・更新 | 承認済み | 未実装 | 未実装 | - |

## API・イベント

| 名前 | 定義ファイル | 関連する要求 ID |
|---|---|---|

## テーブル

| テーブル名 | 定義ファイル | 正本のシステム | 関連する要求 ID |
|---|---|---|---|

## 共通部品

| 部品名 | ファイル | 用途 | 使っている要求 ID |
|---|---|---|---|
| デザイン基盤 | src/theme/theme.ts, src/theme/ThemeProvider.tsx | Fluent 2 テーマ（OS のライト/ダークに追従）とトークン（kindPalette: 種類の色）。以降の画面はこれを再利用する | FR-001, FR-008, FR-010 |
| i18n 辞書 | src/i18n/index.ts, src/i18n/useT.ts, src/i18n/locales/ja.ts, src/i18n/locales/en.ts, src/i18n/locales/zh.ts, src/i18n/locales/ko.ts | 文言は ja.ts にキーを足し、他 3 言語に同じキーを足す（欠落はテストで検出）。画面は useT() で参照 | FR-002, FR-008, FR-010, NFR-UX-003 |
| 設定ストア | src/settings/store.ts | 言語・表示方法・アプリを持ち localStorage（lang, viewMethod）に保存。useSettings()/updateSettings() | FR-001, FR-002, FR-008 |
| アプリ登録簿 | src/apps/registry.ts | シェルのトグルと画面の対応。新しいアプリはここに 1 行足す | FR-001 |
| 表示方法 | src/view/index.ts, src/view/DualView.tsx, src/view/Scene3D.tsx, src/view/ViewModeSwitch.tsx, src/view/useViewMode.ts, src/view/support.ts, src/view/kinds.ts | DualView（items・kinds・selectedId・onSelect。同じ項目を 2D 一覧/3D 空間配置＋共通の凡例で表示）、useViewMode()（既定 2D・3D 不可なら 2D 固定）、ViewModeSwitch、set3dSupport()。three/R3F は遅延読み込み | FR-008 |
| ワークスペース | src/layout/index.ts, src/layout/model.ts, src/layout/store.ts, src/layout/Workspace.tsx | Workspace（screenId・panels[{id,title,content}]・defaults）。移動・方向・サイズ・タブ・表示/非表示・最大化、localStorage（layout:<screenId>）保存・復元・既定に戻す。panel の data-testid は layout-panel-<id>/layout-menu-<id> | FR-010 |
| コマンドの検索 | src/commands/registry.ts, src/commands/CommandPalette.tsx, src/commands/shellCommands.ts | registerCommands(owner, [{id,label,keywords,run}])で画面がコマンドを登録。Ctrl+K で開く | FR-010 |
