# Azure Well-Architected Framework 監査レポート（2026-11-03）

対象: Azure Container Apps 上の **Campaign Flow**（`rg-campaignflow` / Japan East）
基準: [Azure Well-Architected Framework](https://learn.microsoft.com/ja-jp/azure/well-architected/)（信頼性 RE / セキュリティ SE / コスト最適化 CO / オペレーショナル エクセレンス OE / パフォーマンス効率 PE の各チェックリスト、および Container Apps サービス ガイド）
監査日時: 2026-11-03 JST（証拠採取は 2026-11-02 21:22 UTC 前後）

---

## 1. 範囲・制約・方法

| 項目 | 内容 |
|---|---|
| 制約 | **コードと Azure 環境は一切変更しない**。変更したのは本レポートのみ。 |
| 実施した操作 | Azure Resource Manager / Advisor / Policy / Defender / Cost Management / Log Analytics の**読み取り**、公開 URL への **GET/HEAD のみ**、`az containerapp exec` による読み取りコマンド（`id`、Python/pip バージョン）。 |
| 実施しなかった操作 | POST/PUT/DELETE。特に `POST /api/ops/reset` は誰でもデータを消去できるため呼んでいない。負荷試験も未実施。 |
| 第三者の根拠 | Azure Advisor、Azure Policy（Azure_Security_Baseline）、Microsoft Defender for Cloud の評価結果。TLS はサーバー側の応答そのものを確認。 |
| 識別子 | Subscription `0e930937-43f5-484d-ba9e-1dd1151cf7ba` / Container App `ca-web-adsy2z` / ACR `cradsy2zpj3goda`（Basic） / Log Analytics `log-adsy2zpj3goda` / 環境 `cae-adsy2zpj3goda` |
| 想定ワークロード | 架空データのデモ（RG タグ `dataClass=fictitious-demo`）。以降の重大度は「**デモとして**」と「**本番/実データ化した場合**」を分けて示す。 |

凡例: ✅ 適合 / ⚠ 部分適合 / ❌ 不適合 / ❓ 未確認

---

## 2. エグゼクティブ サマリー

**判定: 架空データのデモとしては公開可。実データ・本番利用は不可。**

最大のリスクは1点に集約される。**認証・認可が存在せず、公開インターネットから全 API を呼べる**（ユーザーの要望で認証を削除済み）。さらに、権限判定が**クライアントが送る `X-User` ヘッダーの自己申告**に依存するため、匿名の第三者が「業務責任者」になりすまして `POST /api/ops/reset`（全データ初期化）などを実行できる。実際に匿名の `X-User: mgr1` で `/api/me` が「業務責任者」を返すことを確認した。

| 重大度 | 件数 | 主な内容 |
|---|---|---|
| 🔴 High | 3 | 認証/認可なし（クライアント申告ロール）、破壊的 API が匿名で到達可能、単一レプリカ＋揮発 SQLite（可用性・耐久性なし） |
| 🟠 Medium | 7 | ACR のパブリック公開＋脆弱性、WAF/レート制限なし、アラート/SLO なし、IaC の CI/CD なし、HEAD/OPTIONS が 501、静的資産の圧縮/キャッシュなし、予算通貨の不確実性 |
| 🟡 Low/Info | 6 | `Server` ヘッダーのバージョン露出、ログに IP/リクエスト ID なし、ログ日次上限なし、リソース ロックなし、監査ログが非永続、ゾーン冗長なし |

良い点: TLS 1.3 のみ、HSTS、CSP 等のセキュリティ ヘッダー、非 root 実行、マネージド ID による ACR Pull（シークレットなし）、正常な 3 種のプローブ、Bicep/azd による IaC、タグ、予算アラート、パラメーター化 SQL。

---

## 3. 証拠一覧（再現可能）

| # | 証拠 | 結果 |
|---|---|---|
| E1 | Container App 構成 | 外部 ingress、`allowInsecure=false`、IP 制限/CORS なし、Single revision、0.5 vCPU / 1 GiB、**min=max=1**、スケール ルールなし、シークレットなし、ボリュームなし、プローブ 3 種すべて `/healthz` |
| E2 | 実行コンテナー | `uid=10001 appuser`、Python 3.12.16、pip 25.0.1 |
| E3 | 環境 | `zoneRedundant=False`、VNet なし、パブリック ネットワーク有効、ピア間 mTLS/暗号化 無効、ログは Log Analytics |
| E4 | ACR | Basic、admin 無効、匿名 Pull 不可、**パブリック有効**、ゾーン冗長/geo レプリケーションなし、信頼/検疫/保持/ソフト削除ポリシー無効 |
| E5 | Log Analytics | PerGB2018、保持 30 日、**日次上限なし**、7 日で約 0.006 GB |
| E6 | Advisor（3 件） | ACR geo レプリケーション（High, 可用性）、ACR Premium（High, 可用性）、**Container Apps をパブリック インターネットに公開しない**（Security, High） |
| E7 | Azure Policy | Azure_Security_Baseline で非準拠 6 件、すべて ACR（脆弱性解決、Private Link、無制限ネットワーク アクセス） |
| E8 | Defender for Cloud | ContainerRegistry プラン **None**。pip 25.0.1 の CVE 6 件（Medium 5 / Low 1、修正版あり、pip ≥ 26.2.0 で解消） |
| E9 | HTTP | TLS 1.3（TLS_AES_256_GCM_SHA384）、TLS 1.0/1.1 拒否、http→https 301、証明書期限 2027-02-10 |
| E10 | 応答ヘッダー | HSTS、CSP、`nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: no-referrer`、`Server: LocalOnly/1.0 Python/3.12.16` |
| E11 | メソッド | **HEAD / OPTIONS は 501**（`do_GET`/`do_POST` のみ実装） |
| E12 | 匿名ロール詐称 | `X-User: mgr1` を付けた匿名 GET `/api/me` が業務責任者を返却 |
| E13 | 静的資産 | `/vendor/d3.min.js` 279,706 B は圧縮されず、`cache-control: no-store`。静的資産合計 約 580 KB が毎回再取得 |
| E14 | レイテンシ（GET×20, 逐次） | `/healthz` p50 63 ms / p95 81 ms、`/api/dashboard` p50 65 / p95 73、`/api/ops/board` p50 104 / p95 127、`/api/ops/resources` p50 74 / p95 98（日本からの計測、単一クライアント） |
| E15 | システム ログ | `ProbeFailed` 96 件はすべて初回プロビジョニングのプレースホルダー イメージ（2026-11-02 07:41）。現行リビジョンでは 0 件 |
| E16 | 直近 24h のリクエスト | 200: 4,352 / 404: 15 / 501: 2（healthz 除く）。5xx なし |
| E17 | 予算 | `budget-campaignflow` 月額 **100000**、実績/予測通知 50/80/100%。現在額は **0.031 USD**（単位は USD） |
| E18 | リポジトリ | `.github/workflows` なし、`requirements.txt` なし（標準ライブラリのみ） |
| E19 | コード レビュー | `X-User` を信頼（`_user()`）、権限は `PERMS`、SQL は値を `?` でバインド（f-string は許可リスト化されたテーブル名のみ）、本文 64 KB 上限、Host/Origin ガード、グローバル `RLock` |

---

## 4. 柱別の所見

### 4.1 セキュリティ（SE）

| コード | 観点 | 状態 | 所見 / 根拠 | 重大度 |
|---|---|---|---|---|
| SE:01 | セキュリティ ベースライン | ⚠ | Azure_Security_Baseline で ACR のみ非準拠（E7）。アプリ側に脅威モデルは未文書（本書 §5 で簡易 STRIDE を作成）。 | Med |
| SE:02 | セキュアな開発ライフサイクル | ❌ | CI/CD なし、依存関係/イメージ スキャンの自動化なし（E18）。pip CVE 6 件（E8）。 | Med |
| SE:04 | セグメント化 | ❌ | VNet なし、ACR/環境ともパブリック（E3, E4）。Advisor が公開を High 指摘（E6）。 | Med |
| SE:05 | ID とアクセス管理 | ❌ | **認証なし**。ロールはクライアント申告の `X-User`（E12, E19）。 | **High** |
| SE:06 | ネットワーク制御 | ❌ | WAF/Front Door なし、IP 制限なし、レート制限なし（E1）。 | Med |
| SE:07 | データ分類/暗号化 | ⚠ | 転送中は TLS 1.3（E9）。保存時は SQLite がコンテナー内（暗号化なし）だが、架空データのため許容。ピア間暗号化は無効（E3）。 | Low |
| SE:08 | 堅牢化 | ⚠ | 非 root、CSP 等あり（E2, E10）。一方 `Server` ヘッダーでバージョン露出、pip CVE（E8, E10）。 | Low |
| SE:09 | シークレット | ✅ | シークレットなし、ACR はマネージド ID で Pull、admin 無効（E1, E4）。 | — |
| SE:10 | 監視と脅威検出 | ⚠ | Defender ContainerRegistry プラン None（E8）。アプリ ログに IP/リクエスト ID なし（E5）。不正アクセスの追跡が困難。 | Med |
| SE:11 | セキュリティ テスト | ❓ | ペネトレーション/DAST の実施記録なし。 | Low |
| SE:12 | インシデント対応 | ❌ | 手順書・連絡先なし（予算通知先のみ）。 | Low |

**主要リスク（認証なし＋自己申告ロール）の悪用シナリオ**
1. 公開 URL を知る者が `X-User: mgr1` を付けて `POST /api/ops/reset` を実行 → 全デモ データが初期状態へ。可用性・完全性の毀損。
2. 案件・タスク・承認の API を匿名で更新 → 画面上の業務データを改ざん。
3. 低コストだが大量リクエスト（単一レプリカ・グローバル ロック）→ 事実上の DoS。

### 4.2 信頼性（RE）

| コード | 観点 | 状態 | 所見 / 根拠 | 重大度 |
|---|---|---|---|---|
| RE:01 | 重要フローの設計 | ⚠ | 重要フローは「画面表示と案件更新」のみで明文化されていない。 | Low |
| RE:02 | 冗長性 | ❌ | min=max=1、`zoneRedundant=False`（E1, E3）。 | **High**（本番時） |
| RE:03 | 障害モード分析 | ❌ | 未実施。単一障害点: レプリカ、ACR、SQLite。 | Med |
| RE:04 | 信頼性目標 | ❌ | SLO/SLA 未定義。 | Med |
| RE:05 | 復旧/冗長（リージョン） | ❌ | 単一リージョン。ACR geo レプリケーションなし（E4, E6）。 | Med |
| RE:06 | スケーラビリティ | ❌ | スケール ルールなし、max=1（E1）。 | Med |
| RE:07 | 自己修復 | ✅ | Startup/Liveness/Readiness 3 種が `/healthz`。現行リビジョンでプローブ失敗 0（E1, E15）。 | — |
| RE:08 | テスト | ⚠ | 単体テスト 35 件あり。障害注入/負荷試験なし。 | Low |
| RE:09 | 災害復旧 | ❌ | **SQLite は `/tmp`（揮発）**。再起動で再シード（E1）。バックアップ/復元手順なし。デモとしては設計通り。 | **High**（本番時） |
| RE:10 | 監視と対処 | ⚠ | ログとプローブはあるがアラート ルールなし（§4.3）。 | Med |

補足: E15 のプローブ失敗はプレースホルダー イメージ時の初回のみで、現行の安定性とは無関係。

### 4.3 オペレーショナル エクセレンス（OE）

| コード | 観点 | 状態 | 所見 / 根拠 | 重大度 |
|---|---|---|---|---|
| OE:01 | DevOps 文化/責任 | ❓ | 単独運用。ランブックなし。 | Low |
| OE:02 | 運用手順 | ⚠ | `deploy.ps1` と README に手順あり。復旧/障害対応の手順なし。 | Low |
| OE:03 | IaC | ✅ | Bicep + azd（`infra/`）。タグ、パラメーター化。 | — |
| OE:04 | ビルド/リリース パイプライン | ❌ | CI/CD なし、what-if/テストのゲートなし（E18）。 | Med |
| OE:05 | 構成の標準化 | ⚠ | 環境変数のみ。構成の検証なし。 | Low |
| OE:07 | 監視 | ⚠ | Log Analytics にコンソール ログは到達（E5）。メトリクス アラート/可用性テスト/ダッシュボードなし。 | Med |
| OE:08 | インシデント管理 | ❌ | 通知経路は予算のみ。 | Low |
| OE:10 | 自動化 | ⚠ | デプロイは自動化。運用（アラート対応、スケール）は手動。 | Low |
| OE:11 | 安全なデプロイ | ⚠ | Single revision で段階的リリース/ロールバック手順なし。 | Low |

### 4.4 コスト最適化（CO）

| コード | 観点 | 状態 | 所見 / 根拠 | 重大度 |
|---|---|---|---|---|
| CO:01 | 財務責任 | ✅ | タグ（`workload`, `azd-env-name`, `dataClass`）あり。 | — |
| CO:02 | コスト モデル | ❓ | Pricing Calculator による試算は未実施。月初来の実績は 0.031 USD（E17）で極小。 | Low |
| CO:03 | コスト データ収集 | ✅ | Cost Management で RG 単位の確認が可能。 | — |
| CO:04 | 予算とアラート | ⚠ | 予算とアラートあり。**金額 100000 の通貨が USD の可能性**があり、意図（月 10 万円 ≒ 約 660 USD）の約 150 倍（≒ 1,500 万円相当）になっていないか要確認（E17）。 | Med |
| CO:05 | 最適なサイズ/SKU | ✅ | 0.5 vCPU / 1 GiB、Consumption、ACR Basic。デモに適切。 | — |
| CO:07 | コンポーネント コスト | ✅ | 構成は最小。 | — |
| CO:09 | リソースのスケール | ⚠ | min=1 の常時稼働。min=0 でさらに削減できるが、コールド スタートでデモ体験が悪化するため意図的なトレードオフ。 | Low |
| CO:13 | 利用状況/無駄 | ⚠ | Log Analytics の日次上限なし（E5）。取り込み量は極小で、実害は小さい。 | Low |
| CO:14 | 他柱とのトレードオフ | — | 可用性向上（複数レプリカ、Premium ACR、ゾーン冗長）は Basic/最小構成より高コスト。§6 を参照。 | — |

### 4.5 パフォーマンス効率（PE）

| コード | 観点 | 状態 | 所見 / 根拠 | 重大度 |
|---|---|---|---|---|
| PE:01 | パフォーマンス目標 | ❌ | 目標未定義。参考値: p95 は 73〜127 ms（E14）。 | Low |
| PE:02 | 容量計画 | ❌ | 未実施。 | Low |
| PE:03 | サービス選択 | ✅ | Container Apps は適切。 | — |
| PE:04 | 収集 | ⚠ | 応答時間ログは JSON ログにあるが、メトリクス/ダッシュボードなし。 | Low |
| PE:05 | スケーリング | ❌ | スケール ルールなし、max=1（E1）。単一スレッドのグローバル `RLock`（E19）がスループットを制限。 | Med |
| PE:06 | テスト | ❓ | 負荷試験は未実施。上記の逐次レイテンシのみ。 | Med |
| PE:07 | コード/インフラ最適化 | ⚠ | **静的資産が非圧縮かつ `no-store`**（d3 約 280 KB、合計約 580 KB が毎回再取得）（E13）。gzip/ETag/長期キャッシュで大幅削減可能。 | Med |
| PE:08 | データ使用 | ✅ | SQLite は小規模データに十分。 | — |
| PE:10 | 重要でない処理 | ✅ | — | — |
| PE:12 | 継続的最適化 | ❌ | 計測基盤なし。 | Low |

### 4.6 関連する機能面の所見

- **HEAD/OPTIONS が 501**（E11）: 外部の可用性監視やリンク チェッカーが HEAD を使うと失敗に見える。CORS 事前検証（OPTIONS）も使えない。現状の単一オリジン構成では実害はないが、監視導入時に障害となる。
- **`Server: LocalOnly/1.0 Python/3.12.16`**（E10）: ランタイム バージョンを露出。
- **ログ**: IP・リクエスト ID・ユーザーを記録せず、インシデント時に誰が何をしたか追跡できない（E5）。監査ログも SQLite 内で再起動により消失。

---

## 5. 簡易 STRIDE

| 脅威 | シナリオ | 現状の緩和 | 残存リスク |
|---|---|---|---|
| Spoofing | `X-User` の偽装（E12） | なし | **High** |
| Tampering | 匿名での POST による案件/タスク改ざん | ロール判定（自己申告のため無効） | **High** |
| Repudiation | 誰が操作したか追えない | 監査ログは SQLite（揮発）、IP なし | Med |
| Information disclosure | 全データを匿名で GET 可能 | 架空データ | 実データなら High |
| Denial of service | 大量リクエスト、`/api/ops/reset` | 本文 64 KB 上限のみ | Med〜High |
| Elevation of privilege | 一般ロールが管理者ロールを自称 | なし | **High** |

---

## 6. 柱間のトレードオフ

| 改善案 | 向上する柱 | 悪化する柱 |
|---|---|---|
| 認証（Entra ID）の再導入 | SE | OE（運用）、デモ体験の摩擦。※以前、組み込み認証サイドカー経由で間欠 500 が発生した経緯あり |
| 複数レプリカ + SQLite 廃止（Azure SQL / Cosmos DB / PostgreSQL） | RE, PE | CO, OE（アプリ改修・移行が必要） |
| Front Door + WAF / Private Link / Premium ACR | SE, RE | CO（固定費が桁違いに増加） |
| min=0（ゼロスケール） | CO | PE（コールド スタート）, RE |

---

## 7. 前回評価（`docs/WAF-Analytics.md`）との差分

| 項目 | 前回 | 今回 |
|---|---|---|
| 認証 | Entra 組み込み認証（導入後に削除） | **なし**（アプリ登録・authConfigs とも削除済み、匿名 200 を確認） |
| 起動安定性 | ブランク画面の不具合を記録 | `boot.js` と HTTP/1.1 keep-alive で解消。現行リビジョンでプローブ失敗 0、直近 24h で 5xx なし |
| 予算 | 未設定 | 設定済み（ただし通貨に疑義、E17） |
| 第三者評価 | なし | Advisor / Policy / Defender の結果を取得（E6〜E8） |
| 認可モデル | 認証前提 | 認証を外した結果、**自己申告ロールの危険性が顕在化** |

---

## 8. 優先度付き是正ロードマップ（実施はしていない）

| 優先 | 対応 | 柱 | 工数目安 |
|---|---|---|---|
| **P0** | 公開範囲の限定（`ipSecurityRestrictions` で関係者の IP に限定）、または Entra ID 認証の再導入。ロールはサーバー側のセッション/クレームから決定し、`X-User` を信頼しない。 | SE | S〜M |
| **P0** | `POST /api/ops/reset` を本番では無効化、またはデモ用に別の管理キー/環境フラグで保護。 | SE, RE | S |
| **P0** | 予算の通貨を確認し、意図が JPY 10 万円なら金額を調整（Cost Management の請求通貨を確認）。 | CO | S |
| P1 | pip を ≥ 26.2.0 に更新（Dockerfile で `pip` 更新、または実行イメージから pip を削除）、イメージ再ビルド。 | SE | S |
| P1 | Azure Monitor アラート（再起動、5xx、レプリカ数、プローブ失敗）と可用性テスト、アクション グループを追加。 | RE, OE | S |
| P1 | HEAD/OPTIONS を実装、`Server` ヘッダーを最小化、ログに `X-Forwarded-For` とリクエスト ID を追加。 | SE, OE | S |
| P1 | 静的資産に gzip と ETag/`Cache-Control`（バージョン付き URL）を適用。 | PE | S |
| P1 | GitHub Actions で `unittest`、Bicep what-if、イメージ スキャンを自動化。 | OE, SE | M |
| P2 | 実データ化する場合: 永続 DB（Azure SQL 等）、複数レプリカ + ゾーン冗長、バックアップ/DR、Front Door + WAF、ACR Premium + Private Link、Defender for Containers。 | RE, SE | L |
| P2 | Log Analytics の日次上限、リソース ロック、SLO 定義、負荷試験（Azure Load Testing）。 | CO, OE, PE | M |

---

## 9. 未確認事項と限界

- 負荷試験は実施していない（PE:06 は未確認。レイテンシは単一クライアントの逐次 GET のみ）。
- コスト試算（Pricing Calculator）は未実施。RG 単位の月初来実績の詳細内訳（サービス別）は、クエリが失敗したため取得できていない。
- 予算金額 100000 の通貨は、現在額が USD 表記であることから USD の可能性があるが、請求通貨の最終確認は未了。
- Defender for Containers が無効（プラン None）にもかかわらず pip の脆弱性評価が出ている理由（別のスキャン経路の可能性）は未確定。pip は実行時に使われないため、悪用可能性は低いと推定する。
- アラート ルール/アクション グループの一覧は取得していない（アプリ側のログ解析結果と、構成に定義がないことから「なし」と判断）。
- 本書は 2026-11-03 JST 時点の状態のみを反映する。
- 本レポート作成中に、コード、Azure のデプロイ、データの変更は行っていない。
