"""Ad-campaign lifecycle workflow: stages, per-department task templates and gate checks.

Deterministic and local. A stage can only be advanced when every gate check passes; the
checks read the same data every department edits, so each department's input moves the flow.
"""
from datetime import date

from .db import row, rows
from .rules import BILLING_KINDS, line_state

STAGES = [
    {"key": "plan", "label": "企画・提案", "owner": "sales", "desc": "顧客の目的・ターゲット・予算を確定し、提案の骨子をつくる"},
    {"key": "contract", "label": "見積・契約", "owner": "sales", "desc": "商材と金額を明細化し、契約・権利・請求条件を固める"},
    {"key": "produce", "label": "制作", "owner": "production", "desc": "コンセプトから広告作品（Web・動画・画像など）を制作・登録する"},
    {"key": "review", "label": "審査・承認", "owner": "legal", "desc": "表現・権利を確認し、社内承認と顧客承認を得る"},
    {"key": "deploy", "label": "展開・配信", "owner": "media", "desc": "媒体・期間・予算を設計し、承認済み作品を配信する"},
    {"key": "bill", "label": "検収・請求", "owner": "finance", "desc": "履行証跡を確定し、検収と請求・原価を照合する"},
    {"key": "measure", "label": "効果測定", "owner": "analyst", "desc": "成果を測定し、顧客へ報告して次回提案につなげる"},
]
STAGE_KEYS = [s["key"] for s in STAGES]
ADVANCE_ROLES = {"plan": {"sales"}, "contract": {"sales"}, "produce": {"production"}, "review": {"legal", "sales"},
                 "deploy": {"media"}, "bill": {"finance"}, "measure": {"analyst"}}

TASKS = {
    "plan": [("sales", "顧客ヒアリングとブリーフの確定"), ("analyst", "市場・ターゲット分析の共有")],
    "contract": [("sales", "見積の提示と顧客合意"), ("legal", "契約・権利条件のレビュー"), ("finance", "与信・請求条件の確認")],
    "produce": [("production", "コンセプトと絵コンテの作成"), ("production", "制作物の初稿納品"), ("sales", "初稿の社内レビュー")],
    "review": [("legal", "表現・権利の確認"), ("sales", "顧客承認の取得"), ("production", "修正の反映")],
    "deploy": [("media", "配信設計と入稿"), ("media", "配信開始の確認")],
    "bill": [("media", "履行証跡の確定"), ("sales", "検収の取得"), ("finance", "請求書の発行")],
    "measure": [("analyst", "効果レポートの作成"), ("sales", "顧客報告と次回提案")],
}


def create_tasks(conn, case_id, current="plan", done_in_current=0, by="system", today=None):
    stamp = (today or date.today()).isoformat()
    cur = STAGE_KEYS.index(current)
    for i, key in enumerate(STAGE_KEYS):
        for n, (dept, title) in enumerate(TASKS[key]):
            done = i < cur or (i == cur and n < done_in_current)
            conn.execute("INSERT INTO tasks(case_id,stage,dept,title,status,done_by,done_at) VALUES(?,?,?,?,?,?,?)",
                         (case_id, key, dept, title, "done" if done else "todo", by if done else None, stamp if done else None))


def _chk(key, label, ok, detail=""):
    return {"key": key, "label": label, "ok": bool(ok), "detail": detail}


def checks(conn, case):
    cid = case["id"]
    lines = rows(conn, "SELECT * FROM lines WHERE case_id=?", (cid,))
    assets = rows(conn, "SELECT * FROM assets WHERE case_id=?", (cid,))
    flights = rows(conn, "SELECT * FROM flights WHERE case_id=?", (cid,))
    tasks = rows(conn, "SELECT * FROM tasks WHERE case_id=?", (cid,))
    states = [(ln, line_state(conn, ln)) for ln in lines]
    contract = sum(s["contract_amount"] for _, s in states)
    out = {}

    def task_check(stage):
        t = [x for x in tasks if x["stage"] == stage]
        done = sum(1 for x in t if x["status"] == "done")
        return _chk("tasks", "必須タスクがすべて完了", t and done == len(t), f"{done}/{len(t)}")

    out["plan"] = [
        _chk("objective", "目的が入力済み", case["objective"].strip()),
        _chk("target", "ターゲットが入力済み", case["target"].strip()),
        _chk("budget", "予算が設定済み", case["budget"] > 0, f"{case['budget']:,.0f}円"),
        _chk("dates", "期間が妥当（開始 ≤ 終了）", case["start_date"] <= case["end_date"], f"{case['start_date']}〜{case['end_date']}"),
        task_check("plan")]
    out["contract"] = [
        _chk("lines", "契約明細が1件以上", lines, f"{len(lines)}件"),
        _chk("within", "契約額が予算以内", lines and contract <= case["budget"], f"契約{contract:,.0f} / 予算{case['budget']:,.0f}円"),
        task_check("contract")]
    out["produce"] = [_chk("assets", "広告作品が1件以上登録済み", assets, f"{len(assets)}件"), task_check("produce")]
    unapproved = [a for a in assets if not a["approved"]]
    expired = [a for a in assets if a["rights_expiry"] and a["rights_expiry"] < case["end_date"]]
    out["review"] = [
        _chk("approved", "全作品が承認済み", assets and not unapproved, f"未承認{len(unapproved)}件"),
        _chk("rights", "権利期限が案件終了日以降", assets and not expired, f"不足{len(expired)}件"),
        task_check("review")]
    approved_ids = {a["id"] for a in assets if a["approved"]}
    nolink = [f for f in flights if f["kind"] == "digital" and f["creative_id"] not in approved_ids]
    unordered = [ln for ln, s in states if ln["cost_budget"] > 0 and s["pos"] == 0]
    out["deploy"] = [
        _chk("flights", "配信計画が1件以上", flights, f"{len(flights)}件"),
        _chk("creative", "デジタル配信に承認済み作品を紐づけ", flights and not nolink, f"未紐づけ{len(nolink)}件"),
        _chk("po", "原価予算のある明細に発注が登録済み", lines and not unordered, f"未発注{len(unordered)}件"),
        task_check("deploy")]
    acc = sum(s["accepted_qty"] for _, s in states)
    inv = sum(s["invoiced_qty"] for _, s in states)
    open_bill = row(conn, f"SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open' AND kind IN ({','.join('?' * len(BILLING_KINDS))})",
                    (cid, *BILLING_KINDS))["n"]
    live = [f for f in flights if f["status"] == "live"]
    out["bill"] = [
        _chk("match", "検収数量と請求数量が一致", acc > 0 and acc == inv, f"検収{acc:g} / 請求{inv:g}"),
        _chk("exc", "請求関連の未対応例外がない", open_bill == 0, f"{open_bill}件"),
        _chk("live", "配信中の計画がない", not live, f"配信中{len(live)}件"),
        task_check("bill")]
    mcount = row(conn, "SELECT COUNT(DISTINCT day) n FROM metrics WHERE case_id=?", (cid,))["n"]
    out["measure"] = [
        _chk("metrics", "成果データが記録済み", mcount > 0, f"{mcount}日分"),
        _chk("kpi", "KPI目標が設定済み", case["kpi_target"] is not None and case["kpi_name"].strip(), case["kpi_name"] or "未設定"),
        task_check("measure")]
    return out


def can_advance_role(stage, role):
    return role == "manager" or role in ADVANCE_ROLES[stage]
