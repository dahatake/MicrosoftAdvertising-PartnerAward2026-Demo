"""Business layer: trading-partner (customer) intelligence, project management (EVM, risks, milestones),
KPI/OKR monitoring, task/resource analytics, entity hover-cards and the business relationship graph."""
import math
from datetime import date, timedelta

from . import ops
from .db import row, rows
from .ops_data import ROLE_TEAM, TEAM_LABEL, TEAMS
from .rules import case_summary, kpis
from .workflow import STAGES

FIN_ROLES = {"sales", "finance", "manager", "auditor", "analyst"}
OKU = 1e8
STATUS_LABEL = {"active": "取引中", "dormant": "休眠", "prospect": "新規見込み"}
STAGE_LABEL = {"lead": "リード", "proposal": "提案", "negotiation": "商談", "verbal": "内諾"}
OUTCOME_LABEL = {"won": "受注", "lost": "失注", "partial": "一部受注"}
HEALTH_LABEL = {"green": "順調", "amber": "注意", "red": "危険"}
STAGE_NAME = {s["key"]: s["label"] for s in STAGES}


class BizError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def ym(n):
    return "¥" + (f"{n / 1e9:,.1f}B" if abs(n) >= 1e9 else f"{n / 1e6:,.1f}M" if abs(n) >= 1e6 else f"{n:,.0f}")


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


# ------------------------------------------------------------------ customers
def customer_ids(conn, user):
    return [r["customer_id"] for r in rows(conn, "SELECT customer_id FROM user_access WHERE user_id=? ORDER BY customer_id", (user["id"],))]


def score_customer(prof, fin, deals, opps, today):
    y = today.year
    rev, op, ad = [f["revenue"] for f in fin], [f["op_profit"] for f in fin], [f["ad_spend"] for f in fin]
    growth = (rev[-1] / rev[0]) ** (1 / max(1, len(rev) - 1)) - 1 if rev[0] > 0 else 0
    margin = op[-1] / rev[-1] if rev[-1] else 0
    fin_s = clamp(35 + growth * 350 + margin * 250, 0, 100)
    ad_growth = (ad[-1] / ad[0]) ** (1 / max(1, len(ad) - 1)) - 1 if ad[0] > 0 else 0
    ratio = ad[-1] / rev[-1] if rev[-1] else 0
    appetite = clamp(ratio * 1500, 0, 60) + clamp(ad_growth * 350, 0, 40)
    decided = [d for d in deals if d["outcome"] in ("won", "lost", "partial") and d["amount"] > 0]
    win = (sum(1 for d in decided if d["outcome"] != "lost") / len(decided)) if decided else 0.3
    sats = [d["satisfaction"] for d in deals if d["satisfaction"]]
    sat = (sum(sats) / len(sats)) if sats else 3.0
    last = max((d["year"] for d in deals if d["outcome"] != "lost"), default=None)
    recency = 0.2 if last is None else {0: 1.0, 1: 0.8, 2: 0.5}.get(y - last, 0.25)
    rel = 40 * win + 30 * (sat / 5) + 20 * recency + 10 * min(prof["our_share"] / 20, 1)
    weighted = sum(o["amount"] * o["probability"] / 100 for o in opps)
    pipe = clamp(weighted / (ad[-1] * 0.08) * 100, 0, 100) if ad[-1] else 0
    risk = {"A": 0, "B": 10, "C": 25}.get(prof["credit_grade"], 10) + (10 if prof["pay_delay"] > 10 else 0)
    total = clamp(0.28 * fin_s + 0.22 * appetite + 0.25 * rel + 0.25 * pipe - risk, 0, 100)
    potential = ad[-1] * (1 - prof["our_share"] / 100) * 0.2 * total / 100
    return {"total": round(total), "fin": round(fin_s), "appetite": round(appetite), "relation": round(rel), "pipeline": round(pipe), "risk": risk,
            "growth": round(growth, 4), "margin": round(margin, 4), "ad_ratio": round(ratio, 4), "win_rate": round(win, 3), "satisfaction": round(sat, 2),
            "weighted_pipeline": weighted, "potential": potential,
            "band": "高" if total >= 70 else "中" if total >= 50 else "低"}


def recommend(prof, sc, opps, deals):
    out = []
    if prof["credit_grade"] == "C" or prof["pay_delay"] > 15:
        out.append({"title": "与信条件を見直したうえで提案する（前払い・分割）", "why": f"与信グレード{prof['credit_grade']}・平均入金遅延{prof['pay_delay']}日のため、回収リスクを先に下げる"})
    if prof["status"] == "dormant":
        out.append({"title": "休眠顧客を再活性化する：直近の成果レポートを添えて役員面談を設定", "why": f"直近の最終取引から時間が空いており、関係スコアは{sc['relation']}点"})
    top = max(opps, key=lambda o: o["amount"] * o["probability"], default=None)
    if top and top["probability"] >= 50:
        out.append({"title": f"進行中の商談「{top['title']}」のクロージングを優先する", "why": f"確度{top['probability']}%・金額{ym(top['amount'])}で、加重パイプラインの最大案件"})
    if prof["our_share"] < 5 and sc["appetite"] >= 50:
        out.append({"title": "シェア拡大の余地が大きい：運用型広告から入り、統合提案へ拡張する", "why": f"広告費比率{sc['ad_ratio'] * 100:.1f}%で投資意欲が高く、当社シェアは{prof['our_share']:.0f}%"})
    if sc["satisfaction"] < 3.5 and prof["status"] != "prospect":
        out.append({"title": "満足度を先に改善する（納期・品質の振り返りを共有）", "why": f"過去案件の満足度が平均{sc['satisfaction']:.1f}/5と低め"})
    if not out:
        out.append({"title": "定期的な成果共有で関係を維持し、次期予算の前倒し提案を行う", "why": "大きなリスクはなく、関係・財務ともに良好"})
    return out[:3]


def _cust_bundle(conn, cid, today):
    prof = row(conn, "SELECT p.*, c.name, c.brand_group FROM customer_profiles p JOIN customers c ON c.id=p.customer_id WHERE p.customer_id=?", (cid,))
    fin = rows(conn, "SELECT * FROM financials WHERE customer_id=? ORDER BY fy", (cid,))
    deals = rows(conn, "SELECT * FROM deals WHERE customer_id=? ORDER BY year, id", (cid,))
    opps = rows(conn, "SELECT * FROM opportunities WHERE customer_id=? ORDER BY id", (cid,))
    return prof, fin, deals, opps


def customers_view(conn, user, acc, today):
    show = user["role"] in FIN_ROLES
    out = []
    for cid in customer_ids(conn, user):
        prof, fin, deals, opps = _cust_bundle(conn, cid, today)
        if not prof:
            continue
        sc = score_customer(prof, fin, deals, opps, today)
        cases = rows(conn, "SELECT id,name,stage FROM cases WHERE customer_id=?", (cid,))
        out.append({"id": cid, "name": prof["name"], "industry": prof["industry"], "status": prof["status"], "employees": prof["employees"],
                    "our_share": prof["our_share"], "cases": len([c for c in cases if c["id"] in acc]),
                    "revenue": fin[-1]["revenue"] if show else None, "ad_spend": fin[-1]["ad_spend"] if show else None,
                    "credit_grade": prof["credit_grade"] if show else None,
                    "score": sc["total"] if show else None, "band": sc["band"] if show else None, "weighted_pipeline": sc["weighted_pipeline"] if show else None,
                    "potential": sc["potential"] if show else None, "since": prof["since"], "restricted": not show})
    return {"customers": out, "restricted": not show, "today": today.isoformat()}


def customer_view(conn, user, acc, cid, today):
    if cid not in customer_ids(conn, user):
        raise BizError(404, "取引先が見つかりません")
    prof, fin, deals, opps = _cust_bundle(conn, cid, today)
    show = user["role"] in FIN_ROLES
    contacts = rows(conn, "SELECT * FROM contacts WHERE customer_id=? ORDER BY id", (cid,))
    for c in contacts:
        c["last_days"] = (today - date.fromisoformat(c["last_contact"])).days
    cases = []
    for c in rows(conn, "SELECT * FROM cases WHERE customer_id=? ORDER BY id", (cid,)):
        if c["id"] in acc:
            s = case_summary(conn, c["id"])
            cases.append({"id": c["id"], "name": c["name"], "stage": c["stage"], "stage_label": STAGE_NAME.get(c["stage"], c["stage"]), "budget": c["budget"],
                          "contract": s["contract_amount"], "invoiced": s["invoiced_amount"], "margin": s["expected_margin"],
                          "open_exceptions": row(conn, "SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open'", (c["id"],))["n"]})
    base = {"id": cid, "name": prof["name"], "group": prof["brand_group"], "industry": prof["industry"], "hq": prof["hq"], "employees": prof["employees"],
            "status": prof["status"], "since": prof["since"], "note": prof["note"], "contacts": contacts, "cases": cases, "restricted": not show, "today": today.isoformat()}
    if not show:
        return base
    sc = score_customer(prof, fin, deals, opps, today)
    for d in deals:
        d["ago"] = today.year - d["year"]
    for o in opps:
        o["weighted"] = o["amount"] * o["probability"] / 100
        o["close_in"] = (date.fromisoformat(o["close_day"]) - today).days
    won = sum(d["amount"] for d in deals if d["outcome"] != "lost")
    base.update({"credit": {"grade": prof["credit_grade"], "score": prof["credit_score"], "terms": prof["payment_terms"], "delay": prof["pay_delay"]},
                 "our_share": prof["our_share"], "financials": fin, "deals": deals, "opportunities": opps, "score": sc, "lifetime_revenue": won,
                 "recommendations": recommend(prof, sc, opps, deals),
                 "wallet": {"ad_spend": fin[-1]["ad_spend"], "ours": fin[-1]["ad_spend"] * prof["our_share"] / 100}})
    return base


# ------------------------------------------------------------------ projects
def _smooth(x):
    x = clamp(x, 0, 1)
    return 3 * x * x - 2 * x ** 3


def project_calc(conn, S, case, today):
    cid = case["id"]
    lines = rows(conn, "SELECT * FROM lines WHERE case_id=?", (cid,))
    cost_budget = sum(l["cost_budget"] for l in lines)
    po = (row(conn, "SELECT COALESCE(SUM(amount),0) s FROM purchase_orders WHERE case_id=?", (cid,)) or {"s": 0})["s"]
    plan_labor = act_labor = 0.0
    for a in S["allocs"]:
        r = S["res"][a["rid"]]
        if a["case"] != cid or r["kind"] != "person":
            continue
        plan_labor += r["rate"] * a["load"] * (a["e"] - a["s"] + 1)
        act_labor += r["rate"] * a["load"] * max(0, min(a["e"], 0) - a["s"] + 1)
    bac = cost_budget + plan_labor
    start, end = date.fromisoformat(case["start_date"]), date.fromisoformat(case["end_date"])
    s_off, e_off = (start - today).days, (end - today).days
    span = max(1, e_off - s_off)
    f_now = clamp((0 - s_off) / span, 0, 1)
    tws = [t for t in S["tws"] if t["case"] == cid]
    t_prog = (sum(100 if t["status"] == "done" else t["progress"] for t in tws) / len(tws) / 100) if tws else 0
    idx = [s["key"] for s in STAGES].index(case["stage"]) if case["stage"] in [s["key"] for s in STAGES] else 0
    progress = clamp(0.5 * (idx / (len(STAGES) - 1)) + 0.5 * t_prog, 0, 1) if case["status"] != "completed" else 1.0
    pv, ev, ac = bac * _smooth(f_now), bac * progress, po * clamp(progress * 1.08, 0, 1) + act_labor
    spi = ev / pv if pv > 1 else (1.0 if ev == 0 else 1.2)
    cpi = ev / ac if ac > 1 and ev > 0 else 1.0
    eac = bac / cpi if cpi > 0 else bac
    return {"bac": bac, "pv": pv, "ev": ev, "ac": ac, "spi": round(spi, 2), "cpi": round(cpi, 2), "eac": eac, "vac": bac - eac, "progress": progress,
            "s_off": s_off, "e_off": e_off, "f_now": f_now, "labor_plan": plan_labor, "po": po, "cost_budget": cost_budget}


def evm_series(c):
    s_off, e_off, now = c["s_off"], c["e_off"], 0
    span = max(1, e_off - s_off)
    fc_end = now + max(1, (e_off - now)) / max(c["spi"], 0.3) if e_off > now else now + 1
    lo, hi = min(s_off, -1), max(e_off, int(fc_end))
    step = max(1, (hi - lo) // 24)
    pts = []
    f_now_s = max(_smooth(c["f_now"]), 1e-6)
    for t in range(lo, hi + step, step):
        f = _smooth((t - s_off) / span)
        pv = c["bac"] * f
        if t <= now:
            ev, ac = c["ev"] * f / f_now_s, c["ac"] * f / f_now_s
            pts.append({"d": t, "pv": pv, "ev": ev, "ac": ac, "evf": None, "acf": None})
        else:
            frac = clamp((t - now) / max(1, fc_end - now), 0, 1)
            evf = c["ev"] + (c["bac"] - c["ev"]) * frac
            pts.append({"d": t, "pv": pv, "ev": None, "ac": None, "evf": evf, "acf": evf / max(c["cpi"], 0.1)})
    return pts


def risk_rows(conn, cid, today):
    out = []
    for r in rows(conn, "SELECT * FROM risks WHERE case_id=? ORDER BY id", (cid,)):
        r["score"] = r["probability"] * r["impact"]
        r["due_in"] = (date.fromisoformat(r["due_day"]) - today).days
        out.append(r)
    return out


def health(calc, risks, open_ex):
    worst = max((r["score"] for r in risks if r["status"] != "closed"), default=0)
    if calc["spi"] < 0.8 or calc["cpi"] < 0.7 or worst >= 20 or open_ex >= 5:
        return "red"
    if calc["spi"] < 0.95 or calc["cpi"] < 0.9 or worst >= 12 or open_ex >= 2:
        return "amber"
    return "green"


def projects_view(conn, user, acc, today):
    S = ops.load_state(conn, today)
    out = []
    for cid in sorted(acc):
        case = row(conn, "SELECT c.*, cu.name customer_name FROM cases c JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?", (cid,))
        calc = project_calc(conn, S, case, today)
        risks = risk_rows(conn, cid, today)
        ex = row(conn, "SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open'", (cid,))["n"]
        nxt = row(conn, "SELECT name, day FROM milestones WHERE case_id=? AND status!='done' ORDER BY day LIMIT 1", (cid,))
        out.append({"id": cid, "name": case["name"], "customer_id": case["customer_id"], "customer_name": case["customer_name"], "stage": case["stage"], "stage_label": STAGE_NAME.get(case["stage"]),
                    "start": case["start_date"], "end": case["end_date"], "bac": calc["bac"], "ev": calc["ev"], "ac": calc["ac"], "pv": calc["pv"], "spi": calc["spi"], "cpi": calc["cpi"],
                    "eac": calc["eac"], "progress": calc["progress"], "open_exceptions": ex, "risk_max": max((r["score"] for r in risks if r["status"] != "closed"), default=0),
                    "risks": len([r for r in risks if r["status"] != "closed"]), "health": health(calc, risks, ex),
                    "next_milestone": {"name": nxt["name"], "in": (date.fromisoformat(nxt["day"]) - today).days} if nxt else None})
    return {"projects": out, "today": today.isoformat()}


def project_view(conn, user, acc, cid, today):
    if cid not in acc:
        raise BizError(404, "案件が見つかりません")
    S = ops.load_state(conn, today)
    case = row(conn, "SELECT c.*, cu.name customer_name FROM cases c JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?", (cid,))
    calc = project_calc(conn, S, case, today)
    risks = risk_rows(conn, cid, today)
    ex = row(conn, "SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open'", (cid,))["n"]
    ms = rows(conn, "SELECT * FROM milestones WHERE case_id=? ORDER BY day", (cid,))
    for m in ms:
        m["in"] = (date.fromisoformat(m["day"]) - today).days
        m["stage_label"] = STAGE_NAME.get(m["stage"], m["stage"])
    sim = ops.simulate(S, 28)
    wbs = []
    for t in S["tws"]:
        if t["case"] != cid:
            continue
        late = sim["lat"].get(t["id"], 0) if t["status"] != "done" else 0
        wbs.append({"id": t["id"], "team": t["team"], "title": t["title"], "status": t["status"], "progress": 100 if t["status"] == "done" else t["progress"],
                    "start": (today + timedelta(days=t["s"])).isoformat(), "end": (today + timedelta(days=t["e"])).isoformat(), "late": late})
    team_pd = {}
    res_rows = []
    for a in S["allocs"]:
        if a["case"] != cid:
            continue
        r = S["res"][a["rid"]]
        days = a["e"] - a["s"] + 1
        team_pd[r["team"]] = team_pd.get(r["team"], 0) + days * a["load"]
        res_rows.append({"resource_id": r["id"], "name": r["name"], "kind": r["kind"], "team": r["team"], "gender": r["gender"], "age": r["age"], "work": a["work"], "load": a["load"], "days": days})
    decs = [{"id": d["id"], "title": d["title"], "severity": d["severity"], "status": d["status"], "due": d["due_day"]} for d in S["decs"] if d["case_id"] == cid]
    changes = rows(conn, "SELECT id, description, status, amount_delta, days_delta FROM changes WHERE case_id=? ORDER BY id", (cid,))
    summary = case_summary(conn, cid)
    return {"case": {k: case[k] for k in ("id", "name", "customer_id", "customer_name", "stage", "start_date", "end_date", "objective", "budget", "kpi_name")},
            "stage_label": STAGE_NAME.get(case["stage"]), "evm": {k: calc[k] for k in ("bac", "pv", "ev", "ac", "spi", "cpi", "eac", "vac", "progress", "po", "labor_plan", "cost_budget")},
            "series": evm_series(calc), "health": health(calc, risks, ex), "open_exceptions": ex, "milestones": ms, "risks": risks, "wbs": wbs,
            "team_load": [{"team": k, "person_days": round(v, 1)} for k, v in sorted(team_pd.items(), key=lambda kv: -kv[1])], "resources": res_rows,
            "decisions": decs, "changes": changes, "summary": summary, "today": today.isoformat()}


# ------------------------------------------------------------------ KPI / OKR
# id, objective, name, definition, unit, baseline, target, direction, source, link, requirements
KRS = [
    ("trace", "O1", "案件明細の追跡率", "到来済み必須工程に有効な対応がある明細の割合", "pct", 0.70, 0.95, "up", "live", "#/exceptions", "FR-INT-01, FR-DX-02"),
    ("explain", "O1", "成果と採算の説明可能性", "契約範囲・原価・成果指標を提示できる案件の割合", "pct", 0.50, 0.90, "up", "live", "#/projects", "FR-VIEW-02"),
    ("a2i", "O1", "検収→請求確定（90パーセンタイル）", "検収から請求確定までの日数", "days", 30, 24, "down", "live", "#/exceptions", "FR-FUL-04"),
    ("manual", "O2", "手作業時間（指数）", "転記・探索・照合時間の指数（基準=100）", "idx", 100, 70, "down", "series", "#/tasks", "FR-VIEW-01, FR-FUL-02"),
    ("change", "O2", "変更承認遵守率", "影響のある変更のうち実行前に承認を得た割合", "pct", 0.60, 0.95, "up", "live", "#/cases", "FR-CHG-03"),
    ("leak", "O2", "請求漏れ・重複（未処理件数）", "未処理または重複した請求の件数", "count", 6, 0, "down", "live", "#/exceptions", "FR-FUL-02"),
    ("incident", "O2", "事故・統制違反", "未承認変更・未承認素材の使用などの未解決件数", "count", 5, 0, "down", "live", "#/exceptions", "NFR-SEC, FR-OPS-04"),
    ("adoption", "O3", "利用定着", "対象者のうち週次で必要業務を完了した割合", "pct", 0.35, 0.80, "up", "series", "#/analytics", "NFR-UX-01"),
    ("util", "O4", "稼働率の適正度", "人材のうち稼働率60〜105%に収まる人の割合", "pct", 0.40, 0.80, "up", "live", "#/resources", "運用拡張"),
    ("overload", "O4", "将来の過負荷（リソース日）", "今後28日間の過負荷リソース日数", "count", 80, 10, "down", "live", "#/resources", "運用拡張"),
    ("decision", "O4", "判断の滞留件数", "未決の例外・判断タスクの件数", "count", 8, 2, "down", "live", "#/tasks", "運用拡張"),
    ("spi", "O4", "プロジェクト進捗指数（SPI平均）", "EV/PVの平均（1.0で計画どおり）", "idx2", 0.80, 0.95, "up", "live", "#/projects", "運用拡張"),
    ("pipeline", "O5", "加重パイプライン（百万円）", "確度で加重した商談金額の合計", "yenM", 300, 800, "up", "live", "#/customers", "営業拡張"),
]
OBJECTIVES = [("O1", "案件ライフサイクルを一つのデータでつなぐ"), ("O2", "業務の効率と統制を高める"), ("O3", "現場に定着させる"),
              ("O4", "リソースとタスクの判断を最適化する"), ("O5", "取引先との事業機会を広げる")]
DAY_LEN = 100


def _live_values(conn, user, acc, today):
    k = kpis(conn, today, acc)
    S = ops.load_state(conn, today)
    sim = ops.simulate(S, 28)
    people = [r for r in S["res"].values() if r["kind"] == "person"]
    ok = sum(1 for r in people if 0.6 <= sim["util"][r["id"]][0 - ops.LO] <= 1.05)
    cases = [row(conn, "SELECT * FROM cases WHERE id=?", (c,)) for c in acc]
    expl = sum(1 for c in cases if case_summary(conn, c["id"])["margin_complete"] and c["kpi_name"]) / len(cases) if cases else 0
    inc =  sum(1 for e in rows(conn, "SELECT kind, case_id FROM exceptions WHERE status='open'") if e["case_id"] in acc and e["kind"] in ("UNAPPROVED_ASSET_USED", "UNAPPROVED_CHANGE"))
    spis = [project_calc(conn, S, c, today)["spi"] for c in cases]
    weighted = 0.0
    for cid in customer_ids(conn, user):
        weighted += sum(o["amount"] * o["probability"] / 100 for o in rows(conn, "SELECT amount, probability FROM opportunities WHERE customer_id=?", (cid,)))
    return {"trace": k["trace_rate"]["value"], "explain": expl, "a2i": k["acceptance_to_invoice_days"]["p90"], "change": k["change_compliance"]["value"],
            "leak": k["billing_exceptions_open"], "incident": inc, "util": (ok / len(people)) if people else 0, "overload": sim["totals"]["overload_days"],
            "decision": sum(1 for d in S["decs"] if d["status"] == "open"), "spi": round(sum(spis) / len(spis), 2) if spis else 1.0, "pipeline": weighted / 1e6}


def _gen_series(base, value, key):
    seed = sum(map(ord, key))
    amp = abs(value - base) * 0.07
    out = []
    for i in range(14):
        x = i / 13
        v = base + (value - base) * (3 * x * x - 2 * x ** 3) + amp * math.sin(i * 1.3 + seed)
        out.append(value if i == 13 else v)
    return out


def okr_view(conn, user, acc, today):
    live = _live_values(conn, user, acc, today)
    ps = row(conn, "SELECT value FROM meta WHERE key='program_start'")
    day = (today - date.fromisoformat(ps["value"])).days if ps else 70
    krs, by_obj = [], {}
    for kid, obj, name, definition, unit, base, target, direction, source, link, req in KRS:
        if source == "series":
            ser = [r["value"] for r in rows(conn, "SELECT value FROM kpi_series WHERE kpi=? ORDER BY wk", (kid,))]
            value = ser[-1] if ser else base
        else:
            value = live.get(kid)
            value = base if value is None else value
            ser = _gen_series(base, value, kid)
        att = (value - base) / (target - base) if target != base else 1.0
        met = value >= target if direction == "up" else value <= target
        n = 6
        xs = list(range(n))
        ys = ser[-n:]
        mx, my = sum(xs) / n, sum(ys) / n
        slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
        remain = max(0, DAY_LEN - day) / 7
        proj = value + slope * remain
        patt = (proj - base) / (target - base) if target != base else 1.0
        pmet = proj >= target if direction == "up" else proj <= target
        status = "met" if met else "on_track" if att >= 0.8 else "at_risk" if att >= 0.5 else "off_track"
        kr = {"id": kid, "objective": obj, "name": name, "definition": definition, "unit": unit, "baseline": base, "target": target, "direction": direction, "value": value,
              "attain": round(clamp(att, 0, 1.2), 3), "status": status, "series": [round(v, 4) for v in ser],
              "proj": round(proj, 4), "proj_attain": round(clamp(patt, 0, 1.2), 3), "proj_met": pmet, "source": source, "link": link, "req": req}
        krs.append(kr)
        by_obj.setdefault(obj, []).append(kr)
    objs = [{"id": oid, "title": title, "krs": by_obj.get(oid, []),
             "attain": round(sum(min(k["attain"], 1) for k in by_obj.get(oid, [])) / max(1, len(by_obj.get(oid, []))), 3)} for oid, title in OBJECTIVES]
    overall = sum(min(k["attain"], 1) for k in krs) / len(krs)
    counts = {s: sum(1 for k in krs if k["status"] == s) for s in ("met", "on_track", "at_risk", "off_track")}
    return {"day": day, "len": DAY_LEN, "overall": round(overall, 3), "counts": counts, "objectives": objs, "today": today.isoformat(),
            "note": "目標値は提案値で、実績ではありません。一部の系列は模擬データです（手作業時間・利用定着）。"}


# ------------------------------------------------------------------ analytics
def analytics_tasks(conn, user, acc, today):
    S = ops.load_state(conn, today)
    sim = ops.simulate(S, 28)
    tws = [t for t in S["tws"] if t["case"] is None or t["case"] in acc]
    teams = []
    for key in TEAMS:
        mine = [t for t in tws if t["team"] == key]
        late = [t for t in mine if t["status"] != "done" and sim["lat"].get(t["id"], 0) > 0]
        teams.append({"key": key, "label": TEAM_LABEL[key], "todo": sum(1 for t in mine if t["status"] == "todo"), "doing": sum(1 for t in mine if t["status"] == "doing"),
                      "done": sum(1 for t in mine if t["status"] == "done"), "late": len(late), "avg_progress": round(sum(100 if t["status"] == "done" else t["progress"] for t in mine) / len(mine), 1) if mine else 0,
                      "peak": max(s["util"][key] for s in sim["series"])})
    cfd = []
    for d in range(-21, 29):
        done = prog = todo = 0
        for t in tws:
            end = t["e"] + (sim["lat"].get(t["id"], 0) if t["status"] != "done" else 0)
            if t["status"] == "done" and t["e"] <= d or (t["status"] != "done" and end < d):
                done += 1
            elif t["s"] <= d:
                prog += 1
            else:
                todo += 1
        cfd.append({"d": d, "done": done, "doing": prog, "todo": todo})
    scatter = [{"id": t["id"], "title": t["title"], "team": t["team"], "due": t["e"], "progress": 100 if t["status"] == "done" else t["progress"], "late": sim["lat"].get(t["id"], 0), "status": t["status"]}
               for t in tws if t["status"] != "done"]
    ex_kinds = {}
    for e in rows(conn, "SELECT kind, severity, case_id FROM exceptions WHERE status='open'"):
        if e["case_id"] in acc:
            ex_kinds[e["kind"]] = ex_kinds.get(e["kind"], 0) + 1
    decs = [d for d in S["decs"] if d["case_id"] is None or d["case_id"] in acc]
    return {"teams": teams, "cfd": cfd, "scatter": scatter, "exception_kinds": [{"kind": k, "n": n} for k, n in ex_kinds.items()],
            "decisions": {"open": sum(1 for d in decs if d["status"] == "open"), "red": sum(1 for d in decs if d["status"] == "open" and d["severity"] == "red"),
                          "decided": sum(1 for d in decs if d["status"] != "open"), "avg_due": round(sum(d["due"] for d in decs if d["status"] == "open") / max(1, sum(1 for d in decs if d["status"] == "open")), 1)},
            "totals": sim["totals"], "forecast": sim["series"]}


def analytics_resources(conn, user, acc, today):
    S = ops.load_state(conn, today)
    sim = ops.simulate(S, 28)
    show_rate = user["role"] in ("manager", "finance", "auditor")
    res = S["res"]
    kinds = ("person", "vendor", "studio", "equipment")
    cap = {k: sum(r["capacity"] for r in res.values() if r["kind"] == k) for k in kinds}
    sd = []
    for d in range(0, 29):
        row_ = {"d": d, "cap": dict(cap)}
        row_["demand"] = {k: round(sum(sim["util"][r["id"]][d - ops.LO] * r["capacity"] for r in res.values() if r["kind"] == k), 2) for k in kinds}
        sd.append(row_)
    hist = [0] * 8
    for r in res.values():
        u = sim["util"][r["id"]]
        avg = sum(u[d - ops.LO] for d in range(0, 28)) / 28
        hist[min(7, int(avg / 0.25))] += 1
    skills = {}
    for r in res.values():
        for s in r["skills"].split(" / "):
            e = skills.setdefault(s, {"skill": s, "supply": 0.0, "demand": 0.0})
            e["supply"] += r["capacity"] * 28
            e["demand"] += sum(sim["util"][r["id"]][d - ops.LO] * r["capacity"] for d in range(0, 28))
    cost = {}
    if show_rate:
        for a in S["allocs"]:
            r = res[a["rid"]]
            days = sum(1 for d in range(0, 28) if a["s"] <= d <= a["e"])
            cost[r["team"]] = cost.get(r["team"], 0) + r["rate"] * a["load"] * days
    bench = sorted(({"id": r["id"], "name": r["name"], "kind": r["kind"], "team": r["team"], "gender": r["gender"], "age": r["age"],
                     "spare": round(sum(max(0.0, 1 - sim["util"][r["id"]][d - ops.LO]) * r["capacity"] for d in range(0, 28)), 1)} for r in res.values()), key=lambda x: -x["spare"])[:8]
    pd = {k: 0.0 for k in kinds}
    for a in S["allocs"]:
        days = sum(1 for d in range(0, 28) if a["s"] <= d <= a["e"])
        pd[res[a["rid"]]["kind"]] += days * a["load"]
    return {"supply_demand": sd, "hist": hist, "skills": sorted(skills.values(), key=lambda e: -(e["demand"] / max(1, e["supply"]))), "cost": [{"team": k, "value": v} for k, v in cost.items()] if show_rate else None,
            "bench": bench, "mix": [{"kind": k, "value": round(v, 1)} for k, v in pd.items()], "totals": sim["totals"], "show_rate": show_rate}


# ------------------------------------------------------------------ entity hover cards
def _card(type_, id_, title, sub, facts, link, art=None, tags=None, spark=None):
    return {"type": type_, "id": id_, "title": title, "sub": sub, "facts": [[k, v] for k, v in facts if v not in (None, "")], "link": link, "art": art, "tags": tags or [], "spark": spark}


def entity(conn, user, acc, type_, id_, today):
    show = user["role"] in FIN_ROLES
    if type_ == "customer":
        cid = int(id_)
        if cid not in customer_ids(conn, user):
            raise BizError(404, "取引先が見つかりません")
        prof, fin, deals, opps = _cust_bundle(conn, cid, today)
        facts = [("業種", prof["industry"]), ("本社", prof["hq"]), ("従業員数", f"{prof['employees']:,}"), ("取引状況", STATUS_LABEL[prof["status"]])]
        spark = None
        if show:
            sc = score_customer(prof, fin, deals, opps, today)
            facts += [("売上高（直近）", ym(fin[-1]["revenue"])), ("与信グレード", prof["credit_grade"]), ("営業ポテンシャル", f"{sc['total']}（{sc['band']}）"), ("加重パイプライン", ym(sc["weighted_pipeline"]))]
            spark = [f["revenue"] for f in fin]
        return _card("customer", cid, prof["name"], prof["industry"], facts, f"#/customer/{cid}", {"kind": "customer", "id": cid}, [STATUS_LABEL[prof["status"]]], spark)
    if type_ == "alloc":
        S = ops.load_state(conn, today)
        a = next((x for x in S["allocs"] if x["id"] == int(id_)), None)
        if not a or (a["case"] is not None and a["case"] not in acc):
            raise BizError(404, "配分が見つかりません")
        r = S["res"][a["rid"]]
        iso = lambda n: (today + timedelta(days=n)).isoformat()
        return _card("alloc", a["id"], a["work"], r["name"], [("案件", (S["cases"].get(a["case"]) or {}).get("name", "社内業務")), ("期間", f"{iso(a['s'])} 〜 {iso(a['e'])}"), ("納期", iso(a["due"])), ("負荷", f"{round(a['load'] * 100)}%")],
                     f"#/case/{a['case']}" if a["case"] else f"#/resource/{r['id']}", {"kind": "resource", "id": r["id"], "rkind": r["kind"], "gender": r["gender"], "age": r["age"]})
    if type_ == "project":
        c = entity(conn, user, acc, "case", id_, today)
        calc = project_calc(conn, ops.load_state(conn, today), row(conn, "SELECT * FROM cases WHERE id=?", (int(id_),)), today)
        c["type"], c["link"] = "project", f"#/project/{int(id_)}"
        c["facts"] += [["SPI / CPI", f"{calc['spi']} / {calc['cpi']}"], ["完成時総コスト（EAC）", ym(calc["eac"])]]
        return c
    if type_ == "case":
        cid = int(id_)
        if cid not in acc:
            raise BizError(404, "案件が見つかりません")
        c = row(conn, "SELECT c.*, cu.name cn FROM cases c JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?", (cid,))
        s = case_summary(conn, cid)
        n = row(conn, "SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open'", (cid,))["n"]
        return _card("case", cid, c["name"], c["cn"], [("ステージ", STAGE_NAME.get(c["stage"])), ("期間", f"{c['start_date']} 〜 {c['end_date']}"), ("予算", ym(c["budget"])), ("契約額", ym(s["contract_amount"])),
                                                       ("請求額", ym(s["invoiced_amount"])), ("見込採算", ym(s["expected_margin"])), ("未対応の例外", f"{n}")], f"#/case/{cid}", {"kind": "customer", "id": c["customer_id"]})
    if type_ == "resource":
        S = ops.load_state(conn, today)
        r = S["res"].get(int(id_))
        if not r:
            raise BizError(404, "リソースが見つかりません")
        u = ops.simulate(S, 28)["util"][r["id"]]
        series = [round(u[d - ops.LO], 3) for d in range(0, 29)]
        kind = {"person": "人材", "vendor": "外部パートナー", "studio": "スタジオ", "equipment": "機材"}[r["kind"]]
        return _card("resource", r["id"], r["name"], r["title"], [("種別", kind), ("チーム", TEAM_LABEL.get(r["team"], r["team"])), ("今日の稼働率", f"{round(series[0] * 100)}%"),
                                                                 ("今後28日のピーク", f"{round(max(series) * 100)}%"), ("スキル", r["skills"]), ("備考", r["note"])], f"#/resource/{r['id']}",
                     {"kind": "resource", "id": r["id"], "rkind": r["kind"], "gender": r["gender"], "age": r["age"]}, [kind], series)
    if type_ == "team":
        S = ops.load_state(conn, today)
        sim = ops.simulate(S, 28)
        key = str(id_)
        if key not in TEAMS:
            raise BizError(404, "チームが見つかりません")
        mem = [r for r in S["res"].values() if r["team"] == key]
        mine = [t for t in S["tws"] if t["team"] == key and t["status"] != "done"]
        decs = [d for d in S["decs"] if d["team"] == key and d["status"] == "open"]
        return _card("team", key, TEAM_LABEL[key], "チーム", [("メンバー（人材）", f"{sum(1 for r in mem if r['kind'] == 'person')}"), ("外部・設備", f"{sum(1 for r in mem if r['kind'] != 'person')}"), ("未完了の作業", f"{len(mine)}"),
                                                           ("判断待ち", f"{len(decs)}"), ("今後28日のピーク負荷", f"{round(max(s['util'][key] for s in sim['series']) * 100)}%")], "#/tasks", {"kind": "team", "id": key},
                     [], [s["util"][key] for s in sim["series"]])
    if type_ == "task":
        S = ops.load_state(conn, today)
        t = next((x for x in S["tws"] if x["id"] == int(id_)), None)
        if not t or (t["case"] is not None and t["case"] not in acc):
            raise BizError(404, "タスクが見つかりません")
        late = ops.simulate(S, 28)["lat"].get(t["id"], 0)
        case = S["cases"].get(t["case"]) or {}
        st = {"todo": "未着手", "doing": "進行中", "done": "完了"}[t["status"]]
        return _card("task", t["id"], t["title"], TEAM_LABEL.get(t["team"]), [("案件", case.get("name")), ("期間", f"{(today + timedelta(days=t['s'])).isoformat()} 〜 {(today + timedelta(days=t['e'])).isoformat()}"),
                                                                              ("状態", st), ("進捗", f"{100 if t['status'] == 'done' else t['progress']}%"), ("遅延見込み", f"{late}日" if late and t["status"] != "done" else "なし")],
                     f"#/case/{t['case']}" if t["case"] else "#/tasks", {"kind": "team", "id": t["team"]}, [st])
    if type_ == "decision":
        S = ops.load_state(conn, today)
        d = next((x for x in S["decs"] if x["id"] == int(id_)), None)
        if not d or (d["case_id"] is not None and d["case_id"] not in acc):
            raise BizError(404, "判断が見つかりません")
        ai = ops.analyse_decision(S, d, 28)
        best = next(o for o in d["options"] if o["key"] == ai["best"])
        return _card("decision", d["id"], d["title"], "会社としての例外" if d["scope"] == "company" else "チームの例外: " + TEAM_LABEL.get(d["team"], ""),
                     [("重大度", "レッド" if d["severity"] == "red" else "アンバー"), ("期限", d["due_day"]), ("状態", "未決" if d["status"] == "open" else "決定済み"), ("AI推奨", best["label"]), ("信頼度", f"{ai['confidence']}%")],
                     "#/tasks", {"kind": "tile", "name": "warn", "hue": 355 if d["severity"] == "red" else 40})
    if type_ == "kpi":
        okr = okr_view(conn, user, acc, today)
        kr = next((k for o in okr["objectives"] for k in o["krs"] if k["id"] == id_), None)
        if not kr:
            raise BizError(404, "KPIが見つかりません")
        lab = {"met": "目標達成", "on_track": "順調", "at_risk": "要注意", "off_track": "未達の恐れ"}[kr["status"]]
        return _card("kpi", id_, kr["name"], kr["definition"], [("現在値", fmt_kpi(kr["unit"], kr["value"])), ("目標", fmt_kpi(kr["unit"], kr["target"])), ("基準", fmt_kpi(kr["unit"], kr["baseline"])),
                                                           ("達成率", f"{round(kr['attain'] * 100)}%"), ("Day100予測", fmt_kpi(kr["unit"], kr["proj"])), ("判定", lab), ("対応要件", kr["req"])],
                     kr["link"], {"kind": "tile", "name": "gauge", "hue": 215}, [lab], kr["series"])
    if type_ == "product":
        p = row(conn, "SELECT * FROM products WHERE id=?", (int(id_),))
        if not p:
            raise BizError(404, "商材が見つかりません")
        n = row(conn, "SELECT COUNT(DISTINCT case_id) n FROM lines WHERE product_id=?", (p["id"],))["n"]
        return _card("product", p["id"], p["name"], "商材", [("版", f"v{p['version']}"), ("検収ルール", p["acceptance_rule"]), ("取扱案件数", f"{n}")], "#/relations", {"kind": "product", "id": p["id"]})
    if type_ == "risk":
        r = row(conn, "SELECT * FROM risks WHERE id=?", (int(id_),))
        if not r or r["case_id"] not in acc:
            raise BizError(404, "リスクが見つかりません")
        return _card("risk", r["id"], r["title"], TEAM_LABEL.get(r["team"]), [("確率 × 影響", f"{r['probability']} × {r['impact']} = {r['probability'] * r['impact']}"), ("対策", r["mitigation"]),
                                                                          ("状態", {"open": "未対応", "mitigating": "対策中", "closed": "解消"}[r["status"]]), ("期限", r["due_day"])], f"#/project/{r['case_id']}",
                     {"kind": "tile", "name": "warn", "hue": 25})
    if type_ == "milestone":
        m = row(conn, "SELECT * FROM milestones WHERE id=?", (int(id_),))
        if not m or m["case_id"] not in acc:
            raise BizError(404, "マイルストーンが見つかりません")
        return _card("milestone", m["id"], m["name"], "マイルストーン", [("日付", m["day"]), ("状態", {"done": "完了", "upcoming": "予定", "at_risk": "遅延リスク"}[m["status"]]), ("関連ステージ", STAGE_NAME.get(m["stage"]))],
                     f"#/project/{m['case_id']}", {"kind": "tile", "name": "flag", "hue": 160})
    if type_ in ("deal", "opportunity", "contact"):
        tbl = {"deal": "deals", "opportunity": "opportunities", "contact": "contacts"}[type_]
        r = row(conn, f"SELECT * FROM {tbl} WHERE id=?", (int(id_),))
        if not r or r["customer_id"] not in customer_ids(conn, user):
            raise BizError(404, "データが見つかりません")
        if type_ == "deal":
            return _card("deal", r["id"], r["title"], f"{r['year']}年", [("商材", r["media"]), ("金額", ym(r["amount"])), ("結果", OUTCOME_LABEL[r["outcome"]]), ("粗利率", f"{r['margin']}%"), ("競合", r["competitor"] or "なし"),
                                                                     ("満足度", f"{r['satisfaction']}/5" if r["satisfaction"] else "")], f"#/customer/{r['customer_id']}", {"kind": "customer", "id": r["customer_id"]})
        if type_ == "opportunity":
            return _card("opportunity", r["id"], r["title"], STAGE_LABEL[r["stage"]], [("金額", ym(r["amount"])), ("確度", f"{r['probability']}%"), ("加重金額", ym(r["amount"] * r["probability"] / 100)), ("受注見込日", r["close_day"]),
                                                                                  ("競合", r["competitor"] or "なし"), ("次のアクション", r["next_step"])], f"#/customer/{r['customer_id']}", {"kind": "customer", "id": r["customer_id"]})
        return _card("contact", r["id"], r["name"], r["role"], [("決裁区分", r["decision_role"]), ("最終接点", f"{(today - date.fromisoformat(r['last_contact'])).days}日前"), ("関係の温度", f"{r['sentiment']}/5")],
                     f"#/customer/{r['customer_id']}", {"kind": "person", "id": 900 + r["id"], "gender": r["gender"], "age": r["age"]})
    if type_ == "asset":
        a = row(conn, "SELECT * FROM assets WHERE id=?", (int(id_),))
        if not a or a["case_id"] not in acc:
            raise BizError(404, "広告作品が見つかりません")
        return _card("asset", a["id"], a["name"], "広告作品", [("案件", row(conn, "SELECT name FROM cases WHERE id=?", (a["case_id"],))["name"]), ("承認", "承認済み" if a["approved"] else "未承認"), ("権利期限", a["rights_expiry"] or "—")],
                     f"#/case/{a['case_id']}", {"kind": "tile", "name": "creative", "hue": 310})
    if type_ == "exception":
        e = row(conn, "SELECT * FROM exceptions WHERE id=?", (int(id_),))
        if not e or e["case_id"] not in acc:
            raise BizError(404, "例外が見つかりません")
        return _card("exception", e["id"], e["detail"], "例外", [("重大度", {"high": "高", "medium": "中", "low": "低"}[e["severity"]]), ("期限", e["due"]), ("状態", e["status"])], "#/exceptions", {"kind": "tile", "name": "alert", "hue": 355})
    if type_ == "vendor":
        name = vendor_names(conn).get(str(id_))
        pos = rows(conn, "SELECT case_id, amount FROM purchase_orders WHERE vendor=?", (name,)) if name else []
        pos = [p for p in pos if p["case_id"] in acc]
        if not pos:
            raise BizError(404, "発注先が見つかりません")
        return _card("vendor", id_, name, "発注先", [("発注件数", f"{len(pos)}"), ("発注額の合計", ym(sum(p["amount"] for p in pos))), ("関連案件数", f"{len({p['case_id'] for p in pos})}")], "#/relations",
                     {"kind": "resource", "id": 7, "rkind": "vendor"})
    raise BizError(404, "not found")


def fmt_kpi(unit, v):
    if unit == "pct":
        return f"{v * 100:.1f}%"
    if unit == "days":
        return f"{v:.0f}日"
    if unit == "idx2":
        return f"{v:.2f}"
    if unit == "yenM":
        return f"¥{v:,.0f}M"
    return f"{v:.0f}" if unit == "idx" else f"{v:.0f}件"


# ------------------------------------------------------------------ business relationship graph
REL_LABEL = {"order": "受注（契約）", "deal": "商談（見込み）", "product": "商材を提供", "team": "担当チーム", "staff": "要員を配置", "vendor": "外部へ発注", "asset": "制作物", "kpi": "成果指標"}


def vendor_names(conn):
    return {f"v{i + 1}": r["vendor"] for i, r in enumerate(rows(conn, "SELECT DISTINCT vendor FROM purchase_orders ORDER BY vendor"))}


def graph_view(conn, user, acc, today):
    S = ops.load_state(conn, today)
    nodes, links = {}, []
    add = lambda nid, col, label, type_, ref, extra=None: nodes.setdefault(nid, {"id": nid, "col": col, "label": label, "type": type_, "ref": ref, **(extra or {})})
    link = lambda a, b, rel, w, label=None: links.append({"source": a, "target": b, "rel": rel, "value": max(w, 0.01), "label": label or REL_LABEL[rel]})
    custs = set(customer_ids(conn, user))
    for cid in custs:
        c = row(conn, "SELECT name FROM customers WHERE id=?", (cid,))
        add(f"customer:{cid}", 0, c["name"], "customer", cid)
        for o in rows(conn, "SELECT * FROM opportunities WHERE customer_id=?", (cid,)):
            if user["role"] in FIN_ROLES:
                add(f"opportunity:{o['id']}", 1, o["title"], "opportunity", o["id"], {"sub": "商談"})
                link(f"customer:{cid}", f"opportunity:{o['id']}", "deal", o["amount"] * o["probability"] / 100 / 1e6, f"商談（確度{o['probability']}%）")
    for cid in sorted(acc):
        c = row(conn, "SELECT * FROM cases WHERE id=?", (cid,))
        add(f"case:{cid}", 1, c["name"], "case", cid, {"sub": STAGE_NAME.get(c["stage"])})
        link(f"customer:{c['customer_id']}", f"case:{cid}", "order", max(c["budget"], 1e6) / 1e6, "受注（契約）" + (f" {ym(c['budget'])}" if c["budget"] else ""))
        for l in rows(conn, "SELECT l.*, p.name pname FROM lines l JOIN products p ON p.id=l.product_id WHERE l.case_id=?", (cid,)):
            add(f"product:{l['product_id']}", 2, l["pname"], "product", l["product_id"])
            link(f"case:{cid}", f"product:{l['product_id']}", "product", l["qty"] * l["unit_price"] / 1e6, f"商材を提供 {ym(l['qty'] * l['unit_price'])}")
        for t in {t["team"] for t in S["tws"] if t["case"] == cid}:
            add(f"team:{t}", 3, TEAM_LABEL[t], "team", t)
            link(f"case:{cid}", f"team:{t}", "team", sum(1 for x in S["tws"] if x["case"] == cid and x["team"] == t), "担当チーム")
        for a in S["allocs"]:
            if a["case"] != cid:
                continue
            r = S["res"][a["rid"]]
            add(f"resource:{r['id']}", 4, r["name"], "resource", r["id"], {"rkind": r["kind"], "gender": r["gender"], "age": r["age"]})
            pd = (a["e"] - a["s"] + 1) * a["load"]
            add(f"team:{r['team']}", 3, TEAM_LABEL.get(r["team"], r["team"]), "team", r["team"]) if r["team"] in TEAMS else None
            if r["team"] in TEAMS:
                existing = next((l for l in links if l["source"] == f"team:{r['team']}" and l["target"] == f"resource:{r['id']}"), None)
                if existing:
                    existing["value"] += pd
                else:
                    link(f"team:{r['team']}", f"resource:{r['id']}", "staff" if r["kind"] == "person" else "vendor", pd, "要員を配置" if r["kind"] == "person" else "外部リソースを手配")
        for po in rows(conn, "SELECT vendor, SUM(amount) s FROM purchase_orders WHERE case_id=? GROUP BY vendor", (cid,)):
            add(f"vendor:{po['vendor']}", 4, po["vendor"], "vendor", po["vendor"])
            link(f"case:{cid}", f"vendor:{po['vendor']}", "vendor", po["s"] / 1e6, f"外部へ発注 {ym(po['s'])}")
        for a in rows(conn, "SELECT id, name FROM assets WHERE case_id=?", (cid,)):
            add(f"asset:{a['id']}", 5, a["name"], "asset", a["id"])
            link(f"case:{cid}", f"asset:{a['id']}", "asset", 1.5)
        if c["kpi_name"]:
            add(f"kpi:{cid}", 5, "KPI: " + c["kpi_name"], "kpi_case", cid)
            link(f"case:{cid}", f"kpi:{cid}", "kpi", 1.5)
    # collapse duplicate links between same pair
    merged = {}
    for l in links:
        k = (l["source"], l["target"])
        if k in merged:
            merged[k]["value"] += l["value"]
        else:
            merged[k] = l
    return {"nodes": list(nodes.values()), "links": list(merged.values()), "legend": REL_LABEL, "cols": ["顧客", "案件・商談", "商材", "チーム", "リソース・取引先", "作品・成果指標"]}


def resource_view(conn, user, acc, rid, today):
    S = ops.load_state(conn, today)
    r = S["res"].get(rid)
    if not r:
        raise BizError(404, "リソースが見つかりません")
    sim = ops.simulate(S, 28)
    u = sim["util"][rid]
    allocs = [{"id": a["id"], "work": a["work"], "case_id": a["case"], "case_name": (S["cases"].get(a["case"]) or {}).get("name", "社内業務"), "start": (today + timedelta(days=a["s"])).isoformat(),
               "end": (today + timedelta(days=a["e"])).isoformat(), "load": a["load"]} for a in S["allocs"] if a["rid"] == rid and (a["case"] is None or a["case"] in acc)]
    show = user["role"] in ("manager", "finance", "auditor")
    return {"id": rid, "kind": r["kind"], "name": r["name"], "title": r["title"], "team": r["team"], "skills": r["skills"], "capacity": r["capacity"], "note": r["note"], "gender": r["gender"], "age": r["age"],
            "rate": r["rate"] if show else None, "util": [round(u[d - ops.LO], 3) for d in range(-7, 29)], "allocations": allocs,
            "events": [e for e in sim["events"] if e["kind"] == "overload" and e["ref"] == rid], "today": today.isoformat()}


def route(conn, user, method, p, body, q, acc, today=None):
    if not p.startswith("/api/biz/"):
        return None
    today = today or date.today()
    sub = p[len("/api/biz/"):]
    one = lambda k: (q.get(k) or [""])[0]
    if method == "GET":
        if sub == "customers":
            return customers_view(conn, user, acc, today)
        if sub.startswith("customer/"):
            return customer_view(conn, user, acc, int(sub.split("/")[1]), today)
        if sub == "projects":
            return projects_view(conn, user, acc, today)
        if sub.startswith("project/"):
            return project_view(conn, user, acc, int(sub.split("/")[1]), today)
        if sub == "okr":
            return okr_view(conn, user, acc, today)
        if sub == "analytics/tasks":
            return analytics_tasks(conn, user, acc, today)
        if sub == "analytics/resources":
            return analytics_resources(conn, user, acc, today)
        if sub == "entity":
            return entity(conn, user, acc, one("type"), one("id"), today)
        if sub == "graph":
            return graph_view(conn, user, acc, today)
        if sub.startswith("resource/"):
            return resource_view(conn, user, acc, int(sub.split("/")[1]), today)
    raise BizError(404, "not found")


