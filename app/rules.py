"""Deterministic reconciliation, KPI and change-impact logic (no external calls, no ML)."""
import re
import statistics
from datetime import date, timedelta

from .db import rows, row

BILLING_GRACE_DAYS = 5
SEVERITY_DAYS = {"high": 3, "medium": 7, "low": 14}

KIND_LABEL = {
    "UNBILLED": "検収済み未請求",
    "INVOICE_BEFORE_ACCEPTANCE": "検収前請求",
    "OVERBILLED": "契約額超過請求",
    "DUPLICATE_INVOICE": "重複請求の疑い",
    "ACCEPT_EXCEEDS_DELIVERY": "納品数量超過の検収",
    "COST_OVERRUN": "原価超過",
    "UNAPPROVED_CHANGE": "未承認変更の実行",
    "EMERGENCY_APPROVAL_OVERDUE": "緊急変更の事後承認期限超過",
    "UNAPPROVED_ASSET_USED": "未承認素材の使用",
    "RIGHTS_EXPIRY": "権利期限の超過・不足",
    "UNORDERED": "原価見込みに対する発注なし",
}
KIND_OWNER = {
    "UNBILLED": "finance", "INVOICE_BEFORE_ACCEPTANCE": "finance", "OVERBILLED": "finance",
    "DUPLICATE_INVOICE": "finance", "ACCEPT_EXCEEDS_DELIVERY": "media", "COST_OVERRUN": "media",
    "UNAPPROVED_CHANGE": "sales", "EMERGENCY_APPROVAL_OVERDUE": "sales",
    "UNAPPROVED_ASSET_USED": "production", "RIGHTS_EXPIRY": "legal", "UNORDERED": "media",
}
BILLING_KINDS = ("UNBILLED", "INVOICE_BEFORE_ACCEPTANCE", "OVERBILLED", "DUPLICATE_INVOICE")


def _d(s):
    return date.fromisoformat(s[:10])


def _fmt(n):
    return f"{n:,.0f}"


def line_state(conn, line):
    """Aggregates for one contract line. Approved changes adjust the effective contract amount and budget."""
    lid = line["id"]
    agg = lambda sql: row(conn, sql, (lid,))
    dl = agg("SELECT COALESCE(SUM(qty),0) q, COUNT(*) n FROM deliveries WHERE line_id=?")
    ac = agg("SELECT COALESCE(SUM(qty),0) q, COUNT(*) n, MAX(accepted_at) last, MIN(accepted_at) first FROM acceptances WHERE line_id=?")
    iv = agg("SELECT COALESCE(SUM(qty),0) q, COALESCE(SUM(amount),0) a, COUNT(*) n FROM invoices WHERE line_id=?")
    po = agg("SELECT COALESCE(SUM(amount),0) a, COUNT(*) n FROM purchase_orders WHERE line_id=?")
    ch = agg("SELECT COALESCE(SUM(amount_delta),0) a, COALESCE(SUM(cost_delta),0) c FROM changes WHERE line_id=? AND status='approved'")
    return {
        "contract_amount": line["qty"] * line["unit_price"] + ch["a"],
        "cost_budget": line["cost_budget"] + ch["c"],
        "delivered_qty": dl["q"], "deliveries": dl["n"],
        "accepted_qty": ac["q"], "acceptances": ac["n"], "last_accept": ac["last"], "first_accept": ac["first"],
        "invoiced_qty": iv["q"], "invoiced_amount": iv["a"], "invoices": iv["n"],
        "po_amount": po["a"], "pos": po["n"],
    }


def detect(conn, today):
    """Returns {fingerprint: exception dict} for every currently detectable discrepancy."""
    found = {}

    def add(case_id, line_id, kind, severity, detail, key):
        fp = f"{kind}:{case_id}:{line_id or 0}:{key}"
        found[fp] = {"case_id": case_id, "line_id": line_id, "kind": kind, "severity": severity,
                     "detail": detail, "fingerprint": fp}

    for line in rows(conn, "SELECT l.*, c.start_date, c.end_date, c.status cstatus FROM lines l JOIN cases c ON c.id=l.case_id"):
        s = line_state(conn, line)
        cid, lid, name = line["case_id"], line["id"], line["description"]
        if s["accepted_qty"] > s["invoiced_qty"] and s["last_accept"] and (today - _d(s["last_accept"])).days > BILLING_GRACE_DAYS:
            add(cid, lid, "UNBILLED", "medium",
                f"『{name}』検収{s['accepted_qty']:g}に対し請求{s['invoiced_qty']:g}（検収から{(today - _d(s['last_accept'])).days}日経過）",
                f"{s['accepted_qty']:g}/{s['invoiced_qty']:g}")
        if s["invoiced_qty"] > s["accepted_qty"]:
            add(cid, lid, "INVOICE_BEFORE_ACCEPTANCE", "high",
                f"『{name}』請求{s['invoiced_qty']:g}が検収{s['accepted_qty']:g}を超過",
                f"{s['invoiced_qty']:g}/{s['accepted_qty']:g}")
        if s["invoiced_amount"] > s["contract_amount"] + 0.5:
            add(cid, lid, "OVERBILLED", "high",
                f"『{name}』請求額{_fmt(s['invoiced_amount'])}が契約額{_fmt(s['contract_amount'])}を超過",
                f"{s['invoiced_amount']:.0f}")
        for dup in rows(conn, "SELECT amount, invoiced_at, COUNT(*) n FROM invoices WHERE line_id=? GROUP BY amount, invoiced_at HAVING n>1", (lid,)):
            add(cid, lid, "DUPLICATE_INVOICE", "high",
                f"『{name}』同日・同額（{_fmt(dup['amount'])}）の請求が{dup['n']}件", f"{dup['amount']:.0f}:{dup['invoiced_at']}")
        if s["accepted_qty"] > s["delivered_qty"]:
            add(cid, lid, "ACCEPT_EXCEEDS_DELIVERY", "medium",
                f"『{name}』検収{s['accepted_qty']:g}が納品実績{s['delivered_qty']:g}を超過",
                f"{s['accepted_qty']:g}/{s['delivered_qty']:g}")
        if s["po_amount"] > s["cost_budget"] + 0.5:
            add(cid, lid, "COST_OVERRUN", "medium",
                f"『{name}』発注額{_fmt(s['po_amount'])}が原価予算{_fmt(s['cost_budget'])}を超過", f"{s['po_amount']:.0f}")
        if (line["cstatus"] == "active" and s["pos"] == 0 and line["cost_budget"] > 0
                and (today - _d(line["start_date"])).days > 14):
            add(cid, lid, "UNORDERED", "low", f"『{name}』原価予算{_fmt(line['cost_budget'])}に対し発注が未登録", "none")

    for ch in rows(conn, "SELECT * FROM changes"):
        label = ch["description"]
        if ch["executed_at"] and ch["status"] != "approved" and not ch["emergency"]:
            add(ch["case_id"], ch["line_id"], "UNAPPROVED_CHANGE", "high", f"変更#{ch['id']}『{label}』が承認前に実行済み", f"chg{ch['id']}")
        if ch["emergency"] and ch["status"] != "approved" and ch["post_approval_due"] and _d(ch["post_approval_due"]) < today:
            add(ch["case_id"], ch["line_id"], "EMERGENCY_APPROVAL_OVERDUE", "high",
                f"緊急変更#{ch['id']}『{label}』の事後承認期限（{ch['post_approval_due'][:10]}）を超過", f"chg{ch['id']}")
    for po in rows(conn, "SELECT p.*, c.status cstatus FROM purchase_orders p JOIN changes c ON c.id=p.change_id WHERE c.status!='approved' AND c.emergency=0"):
        add(po["case_id"], po["line_id"], "UNAPPROVED_CHANGE", "high",
            f"発注#{po['id']}（{po['vendor']}）が未承認の変更#{po['change_id']}に紐づく", f"po{po['id']}")

    for a in rows(conn, "SELECT a.*, c.end_date FROM assets a JOIN cases c ON c.id=a.case_id"):
        if a["used_at"] and not a["approved"]:
            add(a["case_id"], None, "UNAPPROVED_ASSET_USED", "high", f"素材『{a['name']}』(v{a['version']})が未承認のまま使用", f"asset{a['id']}")
        if a["rights_expiry"] and _d(a["rights_expiry"]) < _d(a["end_date"]):
            add(a["case_id"], None, "RIGHTS_EXPIRY", "high" if a["used_at"] else "medium",
                f"素材『{a['name']}』の権利期限{a['rights_expiry'][:10]}が案件終了日{a['end_date'][:10]}より前", f"asset{a['id']}")
    return found


def reconcile(conn, today=None):
    today = today or date.today()
    found = detect(conn, today)
    now = today.isoformat()
    closed = created = 0
    accepted = {r["fingerprint"] for r in rows(conn, "SELECT fingerprint FROM exceptions WHERE status='accepted'")}
    openx = {r["fingerprint"]: r for r in rows(conn, "SELECT * FROM exceptions WHERE status='open'")}
    for fp, r in openx.items():
        if fp not in found:
            conn.execute("UPDATE exceptions SET status='resolved', resolved_at=?, resolution='自動: 条件解消' WHERE id=?", (now, r["id"]))
            closed += 1
    for fp, e in found.items():
        if fp in openx or fp in accepted:
            continue
        due = (today + timedelta(days=SEVERITY_DAYS[e["severity"]])).isoformat()
        conn.execute(
            "INSERT INTO exceptions(case_id,line_id,kind,severity,detail,owner,due,status,created_at,fingerprint) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (e["case_id"], e["line_id"], e["kind"], e["severity"], e["detail"], KIND_OWNER[e["kind"]], due, "open", now, fp))
        created += 1
    return {"created": created, "auto_resolved": closed, "open": len(found) - len([f for f in found if f in accepted])}


def kpis(conn, today=None, case_ids=None):
    today = today or date.today()
    in_scope = lambda cid: case_ids is None or cid in case_ids

    required = linked = 0
    for line in rows(conn, "SELECT l.*, c.start_date, c.status cstatus FROM lines l JOIN cases c ON c.id=l.case_id"):
        if not in_scope(line["case_id"]):
            continue
        s = line_state(conn, line)
        stages = [("po", s["pos"]), ("delivery", s["deliveries"]), ("acceptance", s["acceptances"]), ("invoice", s["invoices"])]
        for i, (name, n) in enumerate(stages):
            later = any(m for _, m in stages[i + 1:])
            po_due = name == "po" and line["cost_budget"] > 0 and _d(line["start_date"]) <= today
            if later or po_due:
                required += 1
                linked += 1 if n else 0

    executed = [c for c in rows(conn, "SELECT * FROM changes WHERE executed_at IS NOT NULL") if in_scope(c["case_id"])]
    compliant = 0
    for c in executed:
        ok = c["status"] == "approved" and c["approved_at"] and (
            c["approved_at"] <= c["executed_at"] or (c["emergency"] and c["post_approval_due"] and c["approved_at"][:10] <= c["post_approval_due"][:10]))
        compliant += 1 if ok else 0

    gaps = []
    for inv in rows(conn, "SELECT i.invoiced_at, l.case_id, (SELECT MIN(accepted_at) FROM acceptances a WHERE a.line_id=i.line_id) fa FROM invoices i JOIN lines l ON l.id=i.line_id"):
        if inv["fa"] and in_scope(inv["case_id"]):
            gaps.append((_d(inv["invoiced_at"]) - _d(inv["fa"])).days)
    gaps.sort()
    p90 = gaps[min(len(gaps) - 1, int(len(gaps) * 0.9))] if gaps else None

    ex = [e for e in rows(conn, "SELECT * FROM exceptions WHERE status='open'") if in_scope(e["case_id"])]
    sev = {k: sum(1 for e in ex if e["severity"] == k) for k in ("high", "medium", "low")}
    return {
        "trace_rate": {"value": (linked / required) if required else None, "linked": linked, "required": required, "target": 0.95},
        "change_compliance": {"value": (compliant / len(executed)) if executed else None, "compliant": compliant, "executed": len(executed), "target": 0.95},
        "acceptance_to_invoice_days": {"median": statistics.median(gaps) if gaps else None, "p90": p90, "n": len(gaps)},
        "billing_exceptions_open": sum(1 for e in ex if e["kind"] in BILLING_KINDS),
        "exceptions_open": len(ex), "exceptions_by_severity": sev,
        "exceptions_overdue": sum(1 for e in ex if _d(e["due"]) < today),
        "note": "ローカル集計の参考値。目標値は提案値であり、現状値・実績ではありません。",
    }


def case_summary(conn, case_id):
    lines = rows(conn, "SELECT * FROM lines WHERE case_id=? ORDER BY id", (case_id,))
    contract = invoiced = po = 0.0
    unordered = False
    for line in lines:
        s = line_state(conn, line)
        contract += s["contract_amount"]
        invoiced += s["invoiced_amount"]
        po += s["po_amount"]
        if s["pos"] == 0 and line["cost_budget"] > 0:
            unordered = True
    return {
        "contract_amount": contract, "invoiced_amount": invoiced, "po_amount": po,
        "expected_margin": contract - po, "margin_complete": not unordered,
        "margin_note": "未発注の明細があり、原価が未確定のため採算は暫定値です" if unordered else "発注済み原価に基づく見込み",
    }


def _bigrams(text):
    t = re.sub(r"\s+", "", text.lower())
    return {t[i:i + 2] for i in range(len(t) - 1)}


def change_impact(conn, case_id, description, days_delta=0):
    """Candidate impact list with evidence. Candidates only: a person must confirm before approval."""
    q = _bigrams(description)
    cands = []
    for line in rows(conn, "SELECT l.*, p.name pname FROM lines l JOIN products p ON p.id=l.product_id WHERE l.case_id=?", (case_id,)):
        target = _bigrams(line["description"] + line["pname"])
        common = q & target
        score = len(common) / len(q | target) if (q | target) else 0
        if score > 0.04:
            s = line_state(conn, line)
            basis = [f"説明文との一致語句: {'・'.join(sorted(common))[:40]}"]
            if s["invoices"]:
                basis.append(f"既に請求{_fmt(s['invoiced_amount'])}あり。増額は追加請求の扱いを確認")
            if s["acceptances"]:
                basis.append(f"検収済み{s['accepted_qty']:g}あり。再検収の要否を確認")
            if s["pos"]:
                basis.append(f"発注{_fmt(s['po_amount'])}あり。原価予算{_fmt(s['cost_budget'])}")
            cands.append({"line_id": line["id"], "description": line["description"], "score": round(score, 3), "basis": basis})
    cands.sort(key=lambda c: -c["score"])
    notes = []
    case = row(conn, "SELECT * FROM cases WHERE id=?", (case_id,))
    if days_delta:
        notes.append(f"納期影響: 案件終了日{case['end_date']}に対し{days_delta:+d}日")
    if re.search(r"素材|差替|差し替え|権利|期限|音源|肖像", description):
        for a in rows(conn, "SELECT * FROM assets WHERE case_id=?", (case_id,)):
            notes.append(f"素材『{a['name']}』v{a['version']} 権利期限{a['rights_expiry'] or '未設定'}を確認")
    return {"candidates": cands[:3], "notes": notes,
            "disclaimer": "ルールによる候補です。金額・承認条件は担当者が確定してください。"}


def portfolio(conn, case_ids):
    """Chart-ready aggregates for the dashboard, limited to the cases the user may see."""
    ids = sorted(case_ids)
    if not ids:
        return {"stages": {}, "exceptions": [], "finance": [], "daily": [], "flights": []}
    ph = ",".join("?" * len(ids))
    stages = {r["stage"]: r["n"] for r in rows(conn, f"SELECT stage, COUNT(*) n FROM cases WHERE id IN ({ph}) AND status='active' GROUP BY stage", ids)}
    exc = rows(conn, f"SELECT kind, severity, COUNT(*) n FROM exceptions WHERE status='open' AND case_id IN ({ph}) GROUP BY kind, severity", ids)
    finance = []
    for c in rows(conn, f"SELECT id, name FROM cases WHERE id IN ({ph}) ORDER BY id", ids):
        s = case_summary(conn, c["id"])
        finance.append({"id": c["id"], "name": c["name"], "contract": s["contract_amount"], "cost": s["po_amount"], "invoiced": s["invoiced_amount"]})
    daily = rows(conn, f"SELECT day, SUM(impressions) impressions, SUM(clicks) clicks, SUM(conversions) conversions, SUM(spend) spend FROM metrics WHERE case_id IN ({ph}) GROUP BY day ORDER BY day", ids)
    flights = rows(conn, f"SELECT f.id, f.case_id, c.name case_name, f.channel, f.kind, f.start_date, f.end_date, f.budget, f.status FROM flights f JOIN cases c ON c.id=f.case_id WHERE f.case_id IN ({ph}) ORDER BY f.start_date", ids)
    return {"stages": stages, "exceptions": exc, "finance": finance, "daily": daily, "flights": flights}
