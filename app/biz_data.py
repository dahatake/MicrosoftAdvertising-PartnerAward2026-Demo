"""Synthetic customer (trading partner), project-risk and KPI-history data. All names and figures are fictitious."""
import math
from datetime import timedelta

OKU = 1e8

# id, name, group, industry, hq, employees, status, grade, score, terms, delay, share, since, note
CUSTOMERS = [
    (1, "デモ消費財株式会社", "G-A", "飲料・消費財", "東京", 8200, "active", "A", 88, 60, 3, 18, 2018, "主力顧客。動画と運用型広告の取引が中心"),
    (2, "デモ自動車株式会社", "G-B", "自動車", "愛知", 21500, "active", "A", 92, 45, 5, 9, 2020, "EV新型車の発表で関係が拡大中"),
    (3, "サンプル食品株式会社", "G-C", "食品", "大阪", 3400, "dormant", "B", 74, 60, 12, 4, 2016, "2年前の競合負けを機に取引が停滞"),
    (4, "サンプル小売ホールディングス", "G-D", "小売", "東京", 15000, "prospect", "B", 70, 90, 0, 0, None, "会員アプリの拡販を検討中の新規見込み"),
    (5, "サンプル通信株式会社", "G-E", "通信", "東京", 6200, "active", "A", 90, 45, 2, 2, 2022, "デジタル広告の単発取引。拡大余地が大きい"),
    (6, "サンプル銀行", "G-F", "金融", "東京", 4100, "prospect", "A", 95, 60, 0, 0, None, "若年層向け施策を検討。審査・コンプライアンスが厳格"),
    (7, "サンプル製薬株式会社", "G-G", "医薬品", "大阪", 5400, "dormant", "B", 78, 60, 8, 3, 2019, "啓発動画の実績あり。規制対応の知見が必要"),
    (8, "サンプル旅行株式会社", "G-H", "旅行・観光", "東京", 1800, "active", "C", 55, 45, 25, 6, 2021, "業績回復中。入金遅延があり与信条件に注意"),
]
# customer, revenue[5], op_profit[5], ad_spend[5] (oku-yen, last five fiscal years, oldest first)
FIN = {
    1: ([320, 340, 365, 380, 400], [29, 31, 36, 38, 42], [9.6, 10.2, 11.0, 11.4, 12.0]),
    2: ([5200, 5350, 5800, 6000, 6300], [310, 300, 380, 420, 470], [62, 60, 66, 70, 74]),
    3: ([900, 920, 880, 910, 960], [45, 40, 30, 41, 52], [18, 17.5, 15, 16, 19]),
    4: ([3100, 3200, 3350, 3500, 3700], [95, 100, 115, 125, 140], [40, 41, 44, 47, 50]),
    5: ([4800, 4900, 5000, 5150, 5300], [820, 830, 850, 870, 900], [95, 96, 99, 102, 105]),
    6: ([2600, 2650, 2700, 2800, 2900], [620, 630, 640, 680, 720], [28, 27, 27.5, 28, 30]),
    7: ([1500, 1560, 1500, 1620, 1700], [260, 270, 240, 300, 330], [22, 23, 20, 24, 26]),
    8: ([420, 510, 590, 640, 700], [-12, 8, 22, 35, 48], [9, 10, 12, 14, 16]),
}
# customer, years-ago, title, media, amount(oku), margin%, outcome, competitor, satisfaction
DEALS = [
    (1, 3, "春のブランドキャンペーン", "TV+デジタル", 1.8, 14, "won", "", 4), (1, 2, "新フレーバー発売ムービー", "動画制作", 0.9, 22, "won", "", 5),
    (1, 2, "年間運用型広告", "運用型広告", 1.2, 9, "partial", "他社A", 3), (1, 1, "夏季OOH", "屋外広告", 0.6, 0, "lost", "他社B", None),
    (1, 1, "AQUA-LUX 予告キャンペーン", "動画+デジタル", 1.1, 16, "won", "", 4), (1, 0, "新商品ローンチ動画キャンペーン", "動画制作", 0.15, 30, "won", "", 4),
    (2, 2, "EV試乗促進キャンペーン", "デジタル", 2.4, 11, "won", "", 4), (2, 1, "ブランドサイト運用", "Web", 0.8, 18, "won", "", 4),
    (2, 1, "全国TVCM", "TV", 3.5, 0, "lost", "他社A", None), (2, 0, "新型車 発表動画", "動画制作", 0.09, 24, "won", "", 3),
    (3, 4, "年末商戦TV", "TV", 1.5, 12, "won", "", 4), (3, 3, "新商品サンプリング", "プロモーション", 0.7, 10, "won", "", 3),
    (3, 2, "リニューアル広告", "TV+デジタル", 1.0, 0, "lost", "他社C", None), (3, 2, "商品紹介動画", "動画制作", 0.4, 0, "lost", "他社C", None),
    (4, 1, "ポイント施策の提案", "統合", 0.0, 0, "lost", "他社A", None),
    (5, 1, "デジタル広告 初回取引", "デジタル", 0.5, 8, "won", "", 3), (5, 0, "新料金プラン告知", "デジタル", 0.2, 10, "partial", "他社B", 3),
    (6, 1, "キャンペーンサイト制作", "Web", 0.3, 20, "won", "", 4),
    (7, 3, "啓発動画シリーズ", "動画制作", 1.1, 18, "won", "", 4), (7, 2, "デジタル運用", "運用型広告", 0.6, 0, "lost", "他社C", None),
    (8, 2, "夏旅キャンペーン", "TV+デジタル", 0.8, 12, "won", "", 3), (8, 1, "インバウンド向け動画", "動画制作", 0.7, 15, "won", "", 4),
]
# customer, title, stage, amount(oku), probability, days to close, competitor, next step
OPPS = [
    (1, "年末商戦 統合キャンペーン", "proposal", 1.5, 50, 60, "他社B", "企画書の再提出"), (1, "AQUA-LUX 来期 運用型更新", "negotiation", 1.2, 70, 35, "", "見積条件の調整"),
    (2, "EV-X 全国TV展開", "proposal", 2.8, 35, 75, "他社A", "役員向け提案会の設定"), (3, "春季リブランディング", "lead", 1.2, 15, 120, "他社C", "関係再構築の面談"),
    (4, "会員アプリ拡販 統合施策", "proposal", 2.5, 30, 90, "他社A", "現状調査ヒアリング"), (4, "店舗DX 動画シリーズ", "lead", 0.6, 20, 60, "", "担当部署の紹介依頼"),
    (5, "新料金プラン告知", "negotiation", 1.8, 55, 45, "他社B", "条件確認と契約書案の送付"), (6, "若年層口座開設キャンペーン", "lead", 1.0, 20, 100, "他社A", "予算サイクルの確認"),
    (7, "疾患啓発プログラム", "lead", 0.9, 25, 150, "他社C", "コンプライアンス確認"), (8, "冬季旅行キャンペーン", "proposal", 1.0, 60, 50, "", "日程確定と前払い条件の提示"),
]
# customer, name, role, decision role, gender, age, last contact days ago, sentiment
CONTACTS = [
    (1, "宮本 圭一", "マーケティング本部長", "決裁者", "m", 52, 6, 5), (1, "青山 真由", "ブランドマネージャー", "推進者", "f", 36, 2, 4), (1, "岡田 拓", "調達担当", "影響者", "m", 44, 20, 3),
    (2, "三浦 久美子", "宣伝部長", "決裁者", "f", 49, 9, 4), (2, "田村 亮", "デジタル施策リード", "推進者", "m", 33, 4, 5),
    (3, "石川 正人", "広報部長", "決裁者", "m", 58, 140, 2), (3, "松田 里奈", "商品企画", "影響者", "f", 29, 200, 3),
    (4, "後藤 彰", "CMO", "決裁者", "m", 47, 30, 3), (4, "山崎 玲奈", "CRM推進", "推進者", "f", 34, 12, 4),
    (5, "高木 修", "マーケ統括", "決裁者", "m", 54, 11, 4), (5, "平野 沙織", "デジタル担当", "推進者", "f", 31, 3, 4),
    (6, "福田 浩二", "広報・宣伝部長", "決裁者", "m", 56, 45, 3), (6, "西村 結衣", "リテール企画", "推進者", "f", 27, 15, 4),
    (7, "大塚 智子", "広報部長", "決裁者", "f", 53, 120, 3), (7, "小松 剛", "メディカル担当", "影響者", "m", 41, 160, 3),
    (8, "金子 稔", "経営企画", "決裁者", "m", 61, 8, 4), (8, "野口 愛", "マーケティング", "推進者", "f", 30, 5, 5),
]
# case, title, probability, impact, team, mitigation, status, due(days)
RISKS = [
    (1, "未請求の長期化によるキャッシュ遅延", 3, 3, "finance", "請求依頼を今週中に実施する", "mitigating", 5),
    (1, "素材の権利期限の見落とし", 2, 4, "legal", "期限カレンダーと配信計画を連携する", "open", 20),
    (2, "請求差異の拡大", 4, 3, "finance", "重複請求を取消して再発行する", "mitigating", 4),
    (2, "TV枠の確定遅延", 2, 4, "media", "代替枠を確保する", "open", 8),
    (2, "原価超過", 3, 3, "production", "追加発注を承認制にする", "open", 10),
    (3, "撮影・CG・音声の同時ピーク", 4, 5, "production", "外注枠の拡大を判断する（判断 #7）", "open", 3),
    (3, "ナレーション権利期限", 3, 5, "legal", "権利確認を最優先にする（判断 #5）", "open", 5),
    (3, "変更の事後承認漏れ", 3, 3, "sales", "緊急変更の承認フローを徹底する", "open", 2),
    (4, "要件未確定によるスコープ増大", 4, 4, "sales", "ブリーフ合意と変更管理を先行する", "open", 14),
    (4, "制作リソースの競合", 4, 3, "production", "着手時期を判断する（判断 #8）", "open", 7),
]
# case, name, day, status, stage
MILESTONES = [
    (1, "キックオフ", -60, "done", "plan"), (1, "納品完了", -30, "done", "produce"), (1, "検収", -20, "done", "review"), (1, "請求完了", 3, "at_risk", "bill"), (1, "効果測定の報告", 25, "upcoming", "measure"),
    (2, "契約締結", -45, "done", "contract"), (2, "TV放送", -8, "done", "deploy"), (2, "デジタル配信完了", 10, "upcoming", "deploy"), (2, "請求差異の解消", 4, "at_risk", "bill"),
    (3, "契約・変更合意", -25, "done", "contract"), (3, "審査・承認", 4, "at_risk", "review"), (3, "発表動画の納品", 12, "at_risk", "produce"), (3, "配信開始", 20, "upcoming", "deploy"),
    (4, "提案提出", 9, "upcoming", "plan"), (4, "契約締結", 30, "upcoming", "contract"), (4, "制作着手", 40, "upcoming", "produce"), (4, "公開", 90, "upcoming", "deploy"),
]
# synthetic (not derived from case data) KPI histories: id -> (start, end, noise)
SYNTH = {"manual": (100, 83, 1.6), "adoption": (0.38, 0.69, 0.025)}


def seed_biz(conn, today):
    y = today.year
    d = lambda n: (today + timedelta(days=n)).isoformat()
    for c in CUSTOMERS:
        cid, name, grp = c[0], c[1], c[2]
        if cid > 2:
            conn.execute("INSERT INTO customers VALUES (?,?,?)", (cid, name, grp))
            for u in ("sales1", "media1", "prod1", "fin1", "legal1", "ana1", "mgr1", "audit1"):
                conn.execute("INSERT INTO user_access VALUES (?,?)", (u, cid))
        conn.execute("INSERT INTO customer_profiles VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (cid, c[3], c[4], c[5], c[6], c[7], c[8], c[9], c[10], c[11], c[12], c[13]))
        rev, op, ad = FIN[cid]
        for i in range(5):
            conn.execute("INSERT INTO financials VALUES (?,?,?,?,?)", (cid, y - 4 + i, rev[i] * OKU, op[i] * OKU, ad[i] * OKU))
    conn.executemany("INSERT INTO deals(customer_id,year,title,media,amount,margin,outcome,competitor,satisfaction) VALUES (?,?,?,?,?,?,?,?,?)",
                     [(c, y - ago, t, m, a * OKU, mg, o, comp, s) for c, ago, t, m, a, mg, o, comp, s in DEALS])
    conn.executemany("INSERT INTO opportunities(customer_id,title,stage,amount,probability,close_day,competitor,next_step) VALUES (?,?,?,?,?,?,?,?)",
                     [(c, t, st, a * OKU, p, d(cl), comp, ns) for c, t, st, a, p, cl, comp, ns in OPPS])
    conn.executemany("INSERT INTO contacts(customer_id,name,role,decision_role,gender,age,last_contact,sentiment) VALUES (?,?,?,?,?,?,?,?)",
                     [(c, n, r, dr, g, a, d(-lc), s) for c, n, r, dr, g, a, lc, s in CONTACTS])
    conn.executemany("INSERT INTO risks(case_id,title,probability,impact,team,mitigation,status,due_day) VALUES (?,?,?,?,?,?,?,?)",
                     [(c, t, p, i, tm, m, s, d(du)) for c, t, p, i, tm, m, s, du in RISKS])
    conn.executemany("INSERT INTO milestones(case_id,name,day,status,stage) VALUES (?,?,?,?,?)", [(c, n, d(dy), s, st) for c, n, dy, s, st in MILESTONES])
    for kpi, (a, b, noise) in SYNTH.items():
        for i in range(14):
            k = i / 13
            conn.execute("INSERT INTO kpi_series VALUES (?,?,?)", (kpi, i - 13, round(a + (b - a) * (3 * k * k - 2 * k ** 3) + noise * math.sin(i * 1.9), 4)))
    conn.execute("INSERT OR REPLACE INTO meta VALUES ('program_start', ?)", ((today - timedelta(days=70)).isoformat(),))
