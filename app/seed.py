"""Synthetic demo data. All names, amounts and dates are fictitious and relative to the run date."""
import math
from datetime import date, timedelta

from .db import tx
from .ops_data import seed_ops
from .biz_data import seed_biz
from .rules import reconcile
from .workflow import create_tasks

SEED_VERSION = "6"
ROLES = {
    "sales": "営業", "media": "媒体・運用", "production": "制作", "finance": "経理",
    "legal": "法務", "analyst": "分析", "manager": "業務責任者", "auditor": "監査",
}
WIPE_ORDER = ["kpi_series", "milestones", "risks", "contacts", "opportunities", "deals", "financials", "customer_profiles", "decisions", "allocations", "team_work", "resources", "payments", "invoices", "acceptances", "deliveries", "metrics", "flights", "tasks", "assets", "purchase_orders", "changes",
              "exceptions", "lines", "cases", "user_access", "users", "products", "customers",
              "audit_log", "meta"]


def _metrics(conn, case_id, flight_id, start, end, today, base, ctr, cvr, cpm, phase, budget):
    """Deterministic synthetic daily series (no randomness) so the demo looks the same on every run.

    Spend is scaled so a flight has consumed roughly its elapsed share of budget (about 93% pacing).
    """
    day, i, rows_ = start, 0, []
    last = min(end, today)
    while day <= last:
        wave = 1 + 0.28 * math.sin(i * 0.55 + phase) + 0.12 * math.sin(i * 1.7 + phase)
        ramp = min(1.0, 0.35 + i / 8)
        imp = int(base * wave * ramp)
        clicks = int(imp * ctr * (1 + 0.15 * math.cos(i * 0.9 + phase)))
        conv = int(clicks * cvr * (1 + 0.2 * math.sin(i * 0.4 + phase)))
        rows_.append((day.isoformat(), imp, clicks, conv))
        day += timedelta(days=1)
        i += 1
    elapsed = (last - start).days + 1
    target = budget * min(1.0, elapsed / ((end - start).days + 1)) * 0.93
    total_imp = sum(r[1] for r in rows_) or 1
    for d_, imp, clicks, conv in rows_:
        conn.execute("INSERT INTO metrics(case_id,flight_id,day,impressions,clicks,conversions,spend) VALUES(?,?,?,?,?,?,?)",
                     (case_id, flight_id, d_, imp, clicks, conv, round(target * imp / total_imp)))


def seed(conn, today=None):
    today = today or date.today()
    d = lambda n: (today - timedelta(days=n)).isoformat()
    ts = lambda n: (today - timedelta(days=n)).isoformat() + "T10:00:00"
    dd = lambda n: today - timedelta(days=n)

    with tx(conn):
        ver = conn.execute("SELECT value FROM meta WHERE key='seed_version'").fetchone()
        if ver and ver[0] == SEED_VERSION:
            return False
        if conn.execute("SELECT 1 FROM meta WHERE key='seeded'").fetchone():
            for t in WIPE_ORDER:  # older demo data: replace with the current demo set
                conn.execute(f"DELETE FROM {t}")
        conn.executemany("INSERT INTO customers VALUES (?,?,?)", [(1, "デモ消費財株式会社", "G-A"), (2, "デモ自動車株式会社", "G-B")])
        conn.executemany("INSERT INTO users VALUES (?,?,?)", [
            ("sales1", "営業 山田", "sales"), ("sales2", "営業 佐藤（A社のみ）", "sales"),
            ("media1", "媒体運用 鈴木", "media"), ("prod1", "制作 高橋", "production"),
            ("fin1", "経理 田中", "finance"), ("legal1", "法務 伊藤", "legal"),
            ("ana1", "分析 木村", "analyst"),
            ("mgr1", "業務責任者 中村", "manager"), ("audit1", "監査 小林", "auditor")])
        for u in ("sales1", "media1", "prod1", "fin1", "legal1", "ana1", "mgr1", "audit1"):
            conn.executemany("INSERT INTO user_access VALUES (?,?)", [(u, 1), (u, 2)])
        conn.execute("INSERT INTO user_access VALUES ('sales2',1)")
        conn.executemany("INSERT INTO products VALUES (?,?,?,?,?)", [
            (1, "動画制作", "production", 2, "納品物の顧客承認をもって検収"),
            (2, "運用型広告", "managed_media", 1, "月次実績確定をもって検収"),
            (3, "効果分析レポート", "analytics", 1, "レポート受領をもって検収"),
            (4, "テレビスポット", "reserved_media", 1, "放送確認書をもって検収"),
            (5, "デジタル動画配信", "managed_media", 1, "配信完了報告をもって検収"),
            (6, "Webサイト制作", "production", 1, "公開前の顧客承認をもって検収")])

        cases = [
            (1, 1, "新商品ローンチ動画キャンペーン", "active", d(60), d(-30), "sales1", "bill",
             "新商品AQUA-LUXの認知拡大と初回購入の促進", "20〜34歳の都市部生活者", 15_000_000, "キャンペーンサイト経由の購入申込", 6_000),
            (2, 1, "秋季 テレビ×デジタル統合出稿", "active", d(45), d(-10), "sales1", "deploy",
             "秋の味覚フェアへの来店・購入の促進", "30〜49歳の家族世帯", 12_000_000, "来店予約", 3_500),
            (3, 2, "新型車 発表動画（変更多発案件）", "active", d(40), d(-20), "sales1", "review",
             "新型EV「EV-X」の発表と試乗予約の獲得", "35〜54歳の購入検討層", 9_000_000, "試乗予約", 8_000),
            (4, 2, "ブランドサイト全面リニューアル", "active", d(-10), d(-90), "sales1", "plan",
             "ブランド体験の刷新と販売導線の統合", "30〜49歳の購入検討層", 0, "", None)]
        conn.executemany("INSERT INTO cases(id,customer_id,name,status,start_date,end_date,owner,stage,objective,target,budget,kpi_name,kpi_target) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", cases)
        for cid, stage, done in ((1, "bill", 1), (2, "deploy", 1), (3, "review", 1), (4, "plan", 1)):
            create_tasks(conn, cid, stage, done, "seed", today)

        conn.executemany("INSERT INTO lines VALUES (?,?,?,?,?,?,?,?,?)", [
            (1, 1, 1, 2, "ローンチ動画制作 一式", 1, 5_000_000, 3_500_000, None),
            (2, 1, 2, 1, "運用型動画広告 運用", 1, 8_000_000, 7_000_000, None),
            (3, 1, 3, 1, "効果分析レポート", 1, 1_000_000, 600_000, None),
            (4, 2, 4, 1, "テレビスポット 15秒", 10, 1_000_000, 800_000, None),
            (5, 2, 5, 1, "デジタル動画配信 秋季", 1, 6_000_000, 4_800_000, None),
            (6, 3, 1, 2, "発表動画制作 3本", 3, 2_000_000, 2_400_000, None),
            (7, 3, 2, 1, "運用型動画広告 発表期", 1, 5_000_000, 4_000_000, None)])

        # Case 1: clean flow on lines 1-2; analytics accepted 20 days ago and never billed.
        conn.execute("INSERT INTO purchase_orders VALUES (1,1,1,'制作スタジオA(架空)',3400000,?,NULL,'PO-DEMO-001')", (d(55),))
        conn.execute("INSERT INTO purchase_orders VALUES (2,1,2,'配信プラットフォームB(架空)',6900000,?,NULL,'PO-DEMO-002')", (d(50),))
        conn.execute("INSERT INTO purchase_orders VALUES (3,1,3,'分析パートナーC(架空)',550000,?,NULL,'PO-DEMO-003')", (d(40),))
        for lid, n, amt in ((1, 30, 5_000_000), (2, 20, 8_000_000)):
            conn.execute("INSERT INTO deliveries(line_id,qty,delivered_at,evidence,external_ref) VALUES(?,?,?,?,?)", (lid, 1, d(n + 3), "納品書", f"DL-DEMO-{lid}"))
            conn.execute("INSERT INTO acceptances(line_id,qty,accepted_at,accepted_by,evidence,external_ref) VALUES(?,?,?,?,?,?)", (lid, 1, d(n + 2), "顧客担当", "承認メール", f"AC-DEMO-{lid}"))
            conn.execute("INSERT INTO invoices(line_id,qty,amount,invoiced_at,external_ref) VALUES(?,?,?,?,?)", (lid, 1, amt, d(n), f"INV-DEMO-{lid}"))
        conn.execute("INSERT INTO deliveries(line_id,qty,delivered_at,evidence,external_ref) VALUES(3,1,?,?,?)", (d(21), "レポートPDF", "DL-DEMO-3"))
        conn.execute("INSERT INTO acceptances(line_id,qty,accepted_at,accepted_by,evidence,external_ref) VALUES(3,1,?,?,?,?)", (d(20), "顧客担当", "受領確認", "AC-DEMO-3"))
        conn.execute("INSERT INTO payments VALUES (1,1,5000000,?)", (d(5),))

        # Case 2: invoice before acceptance, duplicate invoice, cost overrun.
        conn.execute("INSERT INTO purchase_orders VALUES (4,2,4,'放送局D(架空)',8800000,?,NULL,'PO-DEMO-004')", (d(40),))
        conn.execute("INSERT INTO purchase_orders VALUES (5,2,5,'配信プラットフォームB(架空)',4700000,?,NULL,'PO-DEMO-005')", (d(38),))
        conn.execute("INSERT INTO deliveries(line_id,qty,delivered_at,evidence,external_ref) VALUES(4,8,?,?,?)", (d(12), "放送確認書", "DL-DEMO-4"))
        conn.execute("INSERT INTO acceptances(line_id,qty,accepted_at,accepted_by,evidence,external_ref) VALUES(4,8,?,?,?,?)", (d(10), "顧客担当", "放送確認書承認", "AC-DEMO-4"))
        conn.execute("INSERT INTO invoices(line_id,qty,amount,invoiced_at,external_ref) VALUES(4,10,10000000,?,?)", (d(4), "INV-DEMO-4"))
        conn.execute("INSERT INTO deliveries(line_id,qty,delivered_at,evidence,external_ref) VALUES(5,1,?,?,?)", (d(9), "配信完了報告", "DL-DEMO-5"))
        conn.execute("INSERT INTO acceptances(line_id,qty,accepted_at,accepted_by,evidence,external_ref) VALUES(5,1,?,?,?,?)", (d(8), "顧客担当", "完了報告承認", "AC-DEMO-5"))
        conn.executemany("INSERT INTO invoices(line_id,qty,amount,invoiced_at,external_ref) VALUES(5,1,6000000,?,?)", [(d(2), "INV-DEMO-5A"), (d(2), "INV-DEMO-5B")])

        # Case 3: changes, assets.
        conn.execute("INSERT INTO changes VALUES (1,3,6,'発表動画に4本目の短尺版を追加',1500000,1000000,5,0,'approved','sales1',?,'mgr1',?,?,NULL)", (ts(25), ts(24), ts(22)))
        conn.execute("INSERT INTO changes VALUES (2,3,6,'ナレーション音源の差し替え（権利期限対応）',300000,250000,2,0,'pending','sales1',?,NULL,NULL,?,NULL)", (ts(6), ts(3)))
        conn.execute("INSERT INTO changes VALUES (3,3,7,'配信期間の緊急延長',0,400000,0,1,'pending','sales1',?,NULL,NULL,?,?)", (ts(9), ts(9), ts(2)))
        conn.execute("INSERT INTO purchase_orders VALUES (6,3,6,'制作スタジオA(架空)',2300000,?,NULL,'PO-DEMO-006')", (d(30),))
        conn.execute("INSERT INTO purchase_orders VALUES (7,3,6,'制作スタジオA(架空)',1000000,?,1,'PO-DEMO-007')", (d(22),))
        conn.execute("INSERT INTO purchase_orders VALUES (8,3,7,'配信プラットフォームB(架空)',3900000,?,NULL,'PO-DEMO-008')", (d(30),))

        far = d(-400)
        conn.executemany("INSERT INTO assets(id,case_id,name,version,rights_expiry,approved,used_at,kind,sample_key) VALUES (?,?,?,?,?,?,?,?,?)", [
            (1, 1, "AQUA-LUX 15秒ブランドムービー", 2, far, 1, ts(45), "video", "video-aqualux15"),
            (2, 1, "AQUA-LUX 新発売キャンペーンサイト", 1, far, 1, ts(45), "web", "lp-aqualux"),
            (3, 2, "秋の味覚フェア ディスプレイバナーセット", 1, far, 1, ts(18), "image", "banner-set"),
            (4, 2, "秋の味覚フェア 縦型ストーリー", 1, far, 1, ts(18), "social", "story-autumn"),
            (5, 3, "新型EV「EV-X」インタラクティブ体験", 1, far, 0, None, "interactive", "car-configurator"),
            (6, 3, "ナレーション音源 v1", 1, d(-5), 1, ts(3), "audio", None),
            (7, 3, "エンディング音楽", 1, d(-90), 0, ts(1), "audio", None)])

        conn.executemany("INSERT INTO flights(id,case_id,line_id,channel,kind,start_date,end_date,budget,creative_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)", [
            (1, 1, 2, "動画プラットフォーム プレロール(架空)", "digital", d(50), d(20), 4_000_000, 1, "done"),
            (2, 1, 2, "SNS 縦型動画(架空)", "digital", d(40), d(5), 3_000_000, 1, "done"),
            (3, 2, 4, "地上波TV 関東 スポット(架空)", "broadcast", d(30), d(8), 8_800_000, None, "done"),
            (4, 2, 5, "デジタル動画配信(架空)", "digital", d(20), d(-10), 3_000_000, 4, "live"),
            (5, 2, 5, "ディスプレイ配信(架空)", "digital", d(20), d(-10), 1_500_000, 3, "live"),
            (6, 3, 7, "動画プラットフォーム 発表期(架空)", "digital", d(-5), d(-20), 3_900_000, 5, "planned")])
        budgets = {1: 4_000_000, 2: 3_000_000, 3: 8_800_000, 4: 3_000_000, 5: 1_500_000}
        for fid, cid, s, e, base, ctr, cvr, cpm, ph in (
                (1, 1, 50, 20, 120_000, 0.012, 0.045, 1500, 0.0), (2, 1, 40, 5, 95_000, 0.018, 0.05, 1200, 1.3),
                (3, 2, 30, 8, 260_000, 0.002, 0.04, 2800, 0.6), (4, 2, 20, -10, 85_000, 0.016, 0.06, 1700, 2.1),
                (5, 2, 20, -10, 140_000, 0.006, 0.05, 900, 0.9)):
            _metrics(conn, cid, fid, dd(s), dd(e), today, base, ctr, cvr, cpm, ph, budgets[fid])

        conn.execute("INSERT INTO audit_log(ts,user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?)", (ts(0), "system", "seed", "meta", "seeded", "架空のデモデータを投入"))
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('seeded', ?)", (today.isoformat(),))
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('seed_version', ?)", (SEED_VERSION,))
        seed_ops(conn, today)
        seed_biz(conn, today)
        reconcile(conn, today)
    return True
