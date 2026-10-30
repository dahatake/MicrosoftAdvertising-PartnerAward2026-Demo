"""Operations layer: resource capacity, team work, decisions, and the 'AI agent' that simulates the future.

The "AI" is a deterministic what-if simulator plus a greedy optimiser running locally; there are no external calls.
Time is virtual: every simulation projects the current plan forward day by day (T+0 .. T+H).
"""
import json
from datetime import date, datetime, timedelta

from .db import row, rows, tx
from .ops_data import ROLE_TEAM, TEAM_LABEL, TEAMS, seed_ops

LO, HI = -30, 75          # absolute day window (offsets from today)
OVER = 1.05               # utilisation above this counts as overload
LATE_TOL = 2              # days of slip tolerated before a delay becomes an exception
SEV_ORDER = {"red": 0, "amber": 1}


class OpsError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


# ------------------------------------------------------------------ state
def load_state(conn, today):
    off = lambda iso: (date.fromisoformat(iso) - today).days
    res = {r["id"]: r for r in rows(conn, "SELECT * FROM resources")}
    allocs = [{"id": a["id"], "rid": a["resource_id"], "case": a["case_id"], "tw": a["tw_id"], "work": a["work"],
               "s": off(a["start_day"]), "e": off(a["end_day"]), "due": off(a["due_day"]), "load": a["load"]}
              for a in rows(conn, "SELECT * FROM allocations ORDER BY id")]
    tws = [{"id": t["id"], "team": t["team"], "case": t["case_id"], "title": t["title"], "s": off(t["start_day"]), "e": off(t["end_day"]),
            "status": t["status"], "progress": t["progress"], "dep": t["depends_on"]} for t in rows(conn, "SELECT * FROM team_work ORDER BY id")]
    decs = []
    for d in rows(conn, "SELECT * FROM decisions ORDER BY id"):
        d["options"] = json.loads(d["options"])
        d["due"] = off(d["due_day"])
        decs.append(d)
    cases = {c["id"]: c for c in rows(conn, "SELECT id,name FROM cases")}
    return {"today": today, "res": res, "allocs": allocs, "tws": tws, "decs": decs, "cases": cases}


def apply_ops(allocs, ops):
    out = {a["id"]: dict(a) for a in allocs}
    for o in ops:
        a = out.get(o["alloc"])
        if not a:
            continue
        if o["op"] == "move":
            a["rid"] = o["resource"]
        elif o["op"] == "shift":
            a["s"] += o["days"]; a["e"] += o["days"]
            if o.get("rebase"):
                a["due"] += o["days"]
        elif o["op"] == "scale":
            a["load"] *= o["factor"]
    return list(out.values())


# ------------------------------------------------------------------ simulation
def simulate(S, H, decided=frozenset(), ops=()):
    res, n = S["res"], HI - LO + 1
    allocs = apply_ops(S["allocs"], ops)
    load = {rid: [0.0] * n for rid in res}
    for a in allocs:
        arr = load[a["rid"]]
        for d in range(max(a["s"], LO), min(a["e"], HI) + 1):
            arr[d - LO] += a["load"]
    util = {rid: [v / res[rid]["capacity"] for v in arr] for rid, arr in load.items()}

    lat_tw = {}
    for a in allocs:  # overload stretches work: each day of overload advances the work by only 1/utilisation
        u, need, prog, d, end = util[a["rid"]], a["e"] - a["s"] + 1, 0.0, a["s"], a["e"]
        while d <= HI:
            prog += 1.0 / max(1.0, u[d - LO])
            if prog >= need - 1e-9:
                end = d
                break
            d += 1
        else:
            end = HI
        if a["tw"]:
            lat_tw[a["tw"]] = max(lat_tw.get(a["tw"], 0), max(0, end - a["due"]))

    events = []
    for rid, u in util.items():
        run = False
        for d in range(0, H + 1):
            over = u[d - LO] > OVER
            if over and not run:
                j = d
                while j <= H and u[j - LO] > OVER:
                    j += 1
                events.append({"day": d, "kind": "overload", "ref": rid, "name": res[rid]["name"], "peak": round(max(u[k - LO] for k in range(d, j)) * 100)})
            run = over
    open_tws = [t for t in S["tws"] if t["status"] != "done"]
    for t in open_tws:
        late = lat_tw.get(t["id"], 0)
        if late > LATE_TOL and max(0, t["e"]) <= H:
            events.append({"day": max(0, t["e"]), "kind": "late", "ref": t["id"], "name": t["title"], "peak": late})
    for dc in S["decs"]:
        if dc["status"] == "open" and dc["id"] not in decided and max(0, dc["due"] + 1) <= H:
            events.append({"day": max(0, dc["due"] + 1), "kind": "overdue", "ref": dc["id"], "name": dc["title"], "peak": 0})
    events.sort(key=lambda e: (e["day"], e["kind"]))

    team_res = {t: [rid for rid, r in res.items() if r["team"] == t] for t in TEAMS}
    team_cap = {t: sum(res[r]["capacity"] for r in rids) or 1 for t, rids in team_res.items()}
    series, overload_days = [], 0
    for d in range(0, H + 1):
        i = d - LO
        over_n = sum(1 for u in util.values() if u[i] > OVER)
        overload_days += over_n
        series.append({"d": d, "open": sum(1 for t in open_tws if t["e"] + lat_tw.get(t["id"], 0) >= d), "over": over_n,
                       "exc": sum(1 for e in events if e["day"] <= d),
                       "util": {t: round(sum(load[r][i] for r in rids) / team_cap[t], 3) for t, rids in team_res.items()}})
    totals = {"exceptions": len(events), "overload_days": overload_days, "late_days": sum(lat_tw.get(t["id"], 0) for t in open_tws),
              "open_area": sum(s["open"] for s in series), "open_end": series[-1]["open"]}
    return {"series": series, "events": events, "totals": totals, "util": util, "lat": lat_tw, "allocs": allocs}


def score(t, cost):
    return t["exceptions"] * 10 + t["overload_days"] * 0.8 + t["late_days"] * 2 + cost / 100000 * 1.5


def op_cost(S, o):
    a = next((x for x in S["allocs"] if x["id"] == o["alloc"]), None)
    if not a or o["op"] != "move":
        return 0
    r0, r1 = S["res"][a["rid"]], S["res"].get(o["resource"])
    return max(0, (r1["rate"] - r0["rate"])) * (a["e"] - a["s"] + 1) * a["load"] if r1 else 0


def describe_op(S, o):
    a = next((x for x in S["allocs"] if x["id"] == o["alloc"]), None)
    if not a:
        return ""
    if o["op"] == "move":
        return f"「{a['work']}」を{S['res'][o['resource']]['name']}へ移管"
    if o["op"] == "shift":
        return f"「{a['work']}」を{o['days']}日後ろへずらす" + ("（納期も再調整）" if o.get("rebase") else "")
    return f"「{a['work']}」の負荷を{round(o['factor'] * 100)}%に圧縮（外部活用）"


def sim_view(sim, with_series=True):
    return {"series": sim["series"], "events": sim["events"], "totals": sim["totals"]} if with_series else {"totals": sim["totals"]}


# ------------------------------------------------------------------ AI analysis of a decision
def evaluate(S, dec, H, base_ops=(), decided=frozenset()):
    """Simulate every option of a decision on top of already-chosen operations."""
    out = []
    for o in dec["options"]:
        sim = simulate(S, H, decided | {dec["id"]}, list(base_ops) + o["ops"])
        out.append({"key": o["key"], "totals": sim["totals"], "cost": o["cost"], "score": round(score(sim["totals"], o["cost"]), 1)})
    return out


def reasons(S, dec, res_list, ref_totals, H):
    """Plain-language rationale built from the simulated numbers."""
    by = sorted(res_list, key=lambda r: r["score"])
    best, second = by[0], (by[1] if len(by) > 1 else None)
    opt = next(o for o in dec["options"] if o["key"] == best["key"])
    bt = best["totals"]
    lines = [f"将来{H}日間の予測例外：{ref_totals['exceptions']}件 → {bt['exceptions']}件"]
    lines.append(f"過負荷のリソース日数：{ref_totals['overload_days']}日 → {bt['overload_days']}日")
    if ref_totals["late_days"] or bt["late_days"]:
        lines.append(f"遅延見込みの合計：{ref_totals['late_days']}日 → {bt['late_days']}日")
    lines.append(f"追加コスト ¥{round(opt['cost']):,}" if opt["cost"] else "追加コストなし")
    if second:
        so = next(o for o in dec["options"] if o["key"] == second["key"])
        lines.append(f"次点「{so['label']}」との差：総合スコア {second['score'] - best['score']:.1f} 点")
    gap = (second["score"] - best["score"]) if second else 10
    conf = max(55, min(97, round(62 + gap * 2.2)))
    if not opt["ops"]:
        head = f"「{opt['label']}」を推奨：対策の効果が追加コストや副作用に見合いません。"
    else:
        head = f"「{opt['label']}」を推奨：将来の例外と過負荷を最も減らし、コストと遅延のバランスが最良です。"
    return {"best": best["key"], "headline": head, "lines": lines, "confidence": conf}


def analyse_decision(S, dec, H):
    ref = simulate(S, H, frozenset(), [])
    ev = evaluate(S, dec, H)
    ai = reasons(S, dec, ev, ref["totals"], H)
    ai["options"] = {e["key"]: {"score": e["score"], "exceptions": e["totals"]["exceptions"], "overload_days": e["totals"]["overload_days"],
                                "late_days": e["totals"]["late_days"]} for e in ev}
    return ai


# ------------------------------------------------------------------ autopilot
def plan_tasks(S, decs, H):
    base = simulate(S, H, frozenset(), [])
    ops, decided, steps = [], frozenset(), []
    for dec in sorted(decs, key=lambda d: (SEV_ORDER.get(d["severity"], 9), d["due"], d["id"])):
        cur = simulate(S, H, decided, ops)
        ev = evaluate(S, dec, H, ops, decided)
        ai = reasons(S, dec, ev, cur["totals"], H)
        opt = next(o for o in dec["options"] if o["key"] == ai["best"])
        ops = ops + opt["ops"]
        decided = decided | {dec["id"]}
        steps.append({"decision_id": dec["id"], "title": dec["title"], "severity": dec["severity"], "option": opt["key"], "label": opt["label"],
                      "cost": opt["cost"], "headline": ai["headline"], "lines": ai["lines"], "confidence": ai["confidence"],
                      "impact": [describe_op(S, o) for o in opt["ops"]]})
    after = simulate(S, H, decided, ops)
    return {"baseline": sim_view(base), "after": sim_view(after), "steps": steps, "ops": ops, "decided": sorted(decided),
            "cost": sum(s["cost"] for s in steps)}


def eligible(S, a):
    r = S["res"][a["rid"]]
    toks = set(r["skills"].split(" / "))
    out = []
    for x in S["res"].values():
        if x["id"] == r["id"] or x["kind"] != r["kind"]:
            continue
        if x["kind"] == "person" and x["team"] == r["team"]:
            out.append(x["id"])
        elif x["kind"] == "studio":
            out.append(x["id"])
        elif x["kind"] == "vendor" and x["team"] == r["team"] and toks & set(x["skills"].split(" / ")):
            out.append(x["id"])
    return out


def plan_resources(S, H, max_steps=14):
    base = simulate(S, H, frozenset(), [])
    ops, steps, cost = [], [], 0.0
    cur = base
    touched = set()
    for _ in range(max_steps):
        cur_score = score(cur["totals"], cost)
        over_res = {rid for rid, u in cur["util"].items() if any(u[d - LO] > OVER for d in range(0, H + 1))}
        best = None
        for a in cur["allocs"]:
            if a["rid"] not in over_res or a["id"] in touched or a["e"] < 0:
                continue
            cands = [{"op": "move", "alloc": a["id"], "resource": r} for r in eligible(S, a)] + [{"op": "shift", "alloc": a["id"], "days": k} for k in (1, 2, 3, 5, 7, 10)]
            for o in cands:
                c = op_cost({**S, "allocs": cur["allocs"]}, o)
                sim = simulate(S, H, frozenset(), ops + [o])
                sc = score(sim["totals"], cost + c)
                if best is None or sc < best[0]:
                    best = (sc, o, c, sim)
        if not best or cur_score - best[0] < 0.5:
            break
        sc, o, c, sim = best
        a_before = next(x for x in cur["allocs"] if x["id"] == o["alloc"])
        who = S["res"][a_before["rid"]]["name"]
        pre, post = cur["totals"], sim["totals"]
        steps.append({"op": o, "title": describe_op({**S, "allocs": cur["allocs"]}, o), "cost": round(c), "resource": who,
                      "lines": [f"{who}の過負荷を解消するための最良手（候補を全探索）",
                                f"将来{H}日間の予測例外：{pre['exceptions']}件 → {post['exceptions']}件",
                                f"過負荷のリソース日数：{pre['overload_days']}日 → {post['overload_days']}日",
                                f"追加コスト ¥{round(c):,}" if c else "追加コストなし"]})
        ops.append(o); touched.add(o["alloc"]); cost += c; cur = sim
    return {"baseline": sim_view(base), "after": sim_view(cur), "steps": steps, "ops": ops, "decided": [], "cost": round(cost)}


# ------------------------------------------------------------------ persistence of chosen options
def persist_ops(conn, S, ops):
    for o in ops:
        a = row(conn, "SELECT * FROM allocations WHERE id=?", (o["alloc"],))
        if not a:
            continue
        if o["op"] == "move":
            conn.execute("UPDATE allocations SET resource_id=? WHERE id=?", (o["resource"], a["id"]))
        elif o["op"] == "shift":
            sh = lambda iso: (date.fromisoformat(iso) + timedelta(days=o["days"])).isoformat()
            conn.execute("UPDATE allocations SET start_day=?, end_day=?, due_day=? WHERE id=?",
                         (sh(a["start_day"]), sh(a["end_day"]), sh(a["due_day"]) if o.get("rebase") else a["due_day"], a["id"]))
        elif o["op"] == "scale":
            conn.execute("UPDATE allocations SET load=? WHERE id=?", (round(a["load"] * o["factor"], 3), a["id"]))


def _audit(conn, user, action, entity, eid, detail):
    conn.execute("INSERT INTO audit_log(ts,user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?)",
                 (datetime.now().replace(microsecond=0).isoformat(), user["id"], action, entity, str(eid), detail[:500]))


# ------------------------------------------------------------------ permissions & views
def team_of(user):
    return ROLE_TEAM.get(user["role"])


def can_decide(user, dec):
    if user["role"] == "manager":
        return True
    return dec["scope"] == "team" and team_of(user) == dec["team"]


def visible_decisions(S, user, acc):
    out = []
    for d in S["decs"]:
        if d["case_id"] is not None and d["case_id"] not in acc:
            continue
        if user["role"] in ("manager", "auditor") or d["scope"] == "company" or team_of(user) == d["team"]:
            out.append(d)
    return out


def alert_pool(user, decs):
    """Decisions that raise an alert: everything for the manager; otherwise the person's own team's
    plus company-level exceptions, which concern every team (and the auditor sees only those)."""
    if user["role"] == "manager":
        return decs
    mine = team_of(user)
    return [d for d in decs if d["scope"] == "company" or (mine and d["team"] == mine)]


def dec_view(S, d, user, H):
    ai = analyse_decision(S, d, H)
    opts = []
    for o in d["options"]:
        opts.append({"key": o["key"], "label": o["label"], "desc": o["desc"], "cost": o["cost"], "pros": o["pros"], "cons": o["cons"],
                     "impact": [describe_op(S, x) for x in o["ops"]], "ai": ai["options"][o["key"]]})
    return {"id": d["id"], "scope": d["scope"], "team": d["team"], "case_id": d["case_id"], "case_name": (S["cases"].get(d["case_id"]) or {}).get("name"),
            "title": d["title"], "detail": d["detail"], "severity": d["severity"], "due": d["due_day"], "due_in": d["due"],
            "status": d["status"], "chosen": d["chosen"], "decided_via": d["decided_via"], "can_decide": can_decide(user, d) and d["status"] == "open",
            "options": opts, "ai": {k: ai[k] for k in ("best", "headline", "lines", "confidence")}}


def horizon(q):
    try:
        return max(7, min(60, int((q.get("horizon") or ["28"])[0])))
    except ValueError:
        return 28


def route(conn, user, method, p, body, q, acc, today=None):
    """Returns a JSON-able result, or None when the path is not an ops path."""
    if not p.startswith("/api/ops/"):
        return None
    today = today or date.today()
    H = horizon(q)
    sub = p[len("/api/ops/"):]
    S = load_state(conn, today)

    if sub == "resources" and method == "GET":
        return resources_view(S, user, acc, H)
    if sub == "board" and method == "GET":
        return board_view(S, conn, user, acc, H)
    if sub == "focus" and method == "GET":
        return focus_view(S, user, acc, H)

    if sub.startswith("decisions/"):
        parts = sub.split("/")
        d = next((x for x in S["decs"] if str(x["id"]) == parts[1]), None)
        if not d or (d["case_id"] is not None and d["case_id"] not in acc):
            raise OpsError(404, "判断が見つかりません")
        key = str(body.get("option", ""))
        opt = next((o for o in d["options"] if o["key"] == key), None)
        if len(parts) > 2 and parts[2] in ("simulate", "decide") and method == "POST":
            if not opt:
                raise OpsError(400, "選択肢が不正です")
            if d["status"] != "open":
                raise OpsError(409, "この判断はすでに処理されています")
            if parts[2] == "simulate":
                base = simulate(S, H, frozenset(), [])
                after = simulate(S, H, frozenset({d["id"]}), opt["ops"])
                return {"horizon": H, "baseline": sim_view(base), "after": sim_view(after), "cost": opt["cost"], "option": opt["label"],
                        "title": d["title"], "impact": [describe_op(S, o) for o in opt["ops"]]}
            if not can_decide(user, d):
                raise OpsError(403, "この判断を行う権限がありません")
            with tx(conn):
                persist_ops(conn, S, opt["ops"])
                conn.execute("UPDATE decisions SET status='decided', chosen=?, decided_by=?, decided_at=?, decided_via='human' WHERE id=?",
                             (opt["key"], user["id"], datetime.now().replace(microsecond=0).isoformat(), d["id"]))
                _audit(conn, user, "decide", "decision", d["id"], f"{d['title']} → {opt['label']}")
            return {"ok": True}

    if sub in ("ai/plan", "ai/apply") and method == "POST":
        scope = body.get("scope")
        if scope not in ("tasks", "resources"):
            raise OpsError(400, "scope が不正です")
        if scope == "resources":
            if user["role"] not in ("manager", "media", "production"):
                raise OpsError(403, "この操作を行う権限がありません")
            plan = plan_resources(S, H)
        else:
            if user["role"] == "auditor":
                raise OpsError(403, "この操作を行う権限がありません")
            decs = [d for d in visible_decisions(S, user, acc) if d["status"] == "open" and can_decide(user, d)]
            plan = plan_tasks(S, decs, H)
        if sub == "ai/plan":
            return {"scope": scope, "horizon": H, **{k: plan[k] for k in ("baseline", "after", "steps", "cost")}}
        with tx(conn):
            persist_ops(conn, S, plan["ops"])
            now = datetime.now().replace(microsecond=0).isoformat()
            for step in plan["steps"]:
                if "decision_id" in step:
                    conn.execute("UPDATE decisions SET status='decided', chosen=?, decided_by=?, decided_at=?, decided_via='ai' WHERE id=?",
                                 (step["option"], user["id"], now, step["decision_id"]))
            _audit(conn, user, "ai_apply", "autopilot", scope, f"AI最適化を許諾: {len(plan['steps'])}件")
        return {"ok": True, "applied": len(plan["steps"])}

    if sub == "reset" and method == "POST":
        if user["role"] != "manager":
            raise OpsError(403, "この操作を行う権限がありません")
        with tx(conn):
            for t in ("decisions", "allocations", "team_work", "resources"):
                conn.execute(f"DELETE FROM {t}")
            seed_ops(conn, today)
            _audit(conn, user, "reset", "ops", "all", "リソース・判断データを初期状態に戻しました")
        return {"ok": True}
    raise OpsError(404, "not found")


def resources_view(S, user, acc, H):
    show_rate = user["role"] in ("manager", "finance", "auditor")
    sim = simulate(S, H, frozenset(), [])
    allocs = [a for a in S["allocs"] if a["case"] is None or a["case"] in acc]
    today = S["today"]
    iso = lambda n: (today + timedelta(days=n)).isoformat()
    res = []
    for r in S["res"].values():
        u = sim["util"][r["id"]]
        res.append({"id": r["id"], "kind": r["kind"], "name": r["name"], "team": r["team"], "title": r["title"], "skills": r["skills"], "capacity": r["capacity"],
                    "rate": r["rate"] if show_rate else None, "gender": r["gender"], "age": r["age"], "note": r["note"],
                    "util_now": round(u[0 - LO], 3), "util": [round(u[d - LO], 3) for d in range(-7, H + 1)]})
    window = range(0, H)
    flows_kt, flows_tc = {}, {}
    for a in allocs:
        r = S["res"][a["rid"]]
        days = sum(1 for d in window if a["s"] <= d <= a["e"])
        if not days:
            continue
        w = round(days * a["load"], 2)
        k1 = (r["kind"], r["team"]); flows_kt[k1] = flows_kt.get(k1, 0) + w
        k2 = (r["team"], a["case"]); flows_tc[k2] = flows_tc.get(k2, 0) + w
    cases = S["cases"]
    return {"horizon": H, "today": today.isoformat(), "teams": TEAM_LABEL, "resources": res, "show_rate": show_rate,
            "allocations": [{"id": a["id"], "resource_id": a["rid"], "case_id": a["case"], "case_name": (cases.get(a["case"]) or {}).get("name", "社内業務"),
                             "work": a["work"], "start": iso(a["s"]), "end": iso(a["e"]), "due": iso(a["due"]), "load": round(a["load"], 3), "team": S["res"][a["rid"]]["team"]} for a in allocs],
            "forecast": sim["series"],
            "sankey": {"kind_team": [{"kind": k, "team": t, "value": v} for (k, t), v in flows_kt.items()],
                       "team_case": [{"team": t, "case_id": c, "case": (cases.get(c) or {}).get("name", "社内業務"), "value": v} for (t, c), v in flows_tc.items()]},
            "events": sim["events"], "totals": sim["totals"]}


def board_view(S, conn, user, acc, H):
    sim = simulate(S, H, frozenset(), [])
    today = S["today"]
    iso = lambda n: (today + timedelta(days=n)).isoformat()
    cases = S["cases"]
    tws = []
    for t in S["tws"]:
        if t["case"] is not None and t["case"] not in acc:
            continue
        late = sim["lat"].get(t["id"], 0)
        tws.append({"id": t["id"], "team": t["team"], "case_id": t["case"], "case_name": (cases.get(t["case"]) or {}).get("name", ""), "title": t["title"],
                    "start": iso(t["s"]), "end": iso(t["e"]), "end_eff": iso(t["e"] + (late if t["status"] != "done" else 0)), "late": late if t["status"] != "done" else 0,
                    "status": t["status"], "progress": t["progress"], "depends_on": t["dep"]})
    decs = [dec_view(S, d, user, H) for d in visible_decisions(S, user, acc)]
    decs.sort(key=lambda d: (d["status"] != "open", SEV_ORDER.get(d["severity"], 9), d["due"]))
    teams = []
    for key in TEAMS:
        members = [r for r in S["res"].values() if r["team"] == key]
        persons = [r for r in members if r["kind"] == "person"]
        mine = [t for t in tws if t["team"] == key and t["status"] != "done"]
        mine.sort(key=lambda t: t["end"])
        teams.append({"key": key, "label": TEAM_LABEL[key], "members": len(persons), "externals": len(members) - len(persons),
                      "people": [{"id": r["id"], "name": r["name"], "gender": r["gender"], "age": r["age"]} for r in persons],
                      "util": [s["util"][key] for s in sim["series"]], "now": next(({"title": t["title"], "case": t["case_name"], "end": t["end"]} for t in mine if t["status"] == "doing"), None),
                      "next_due": mine[0]["end"] if mine else None, "open": len(mine),
                      "open_decisions": sum(1 for d in decs if d["status"] == "open" and d["team"] == key and d["scope"] == "team"),
                      "red": sum(1 for d in decs if d["status"] == "open" and d["team"] == key and d["severity"] == "red")})
    return {"horizon": H, "today": today.isoformat(), "teams": teams, "work": tws, "decisions": decs, "my_team": team_of(user), "events": sim["events"], "totals": sim["totals"],
            "forecast": sim["series"]}


def focus_view(S, user, acc, H):
    decs = [d for d in alert_pool(user, visible_decisions(S, user, acc)) if d["status"] == "open"]
    decs.sort(key=lambda d: (SEV_ORDER.get(d["severity"], 9), d["due"], d["id"]))
    reds = [d for d in decs if d["severity"] == "red"]
    out = {"status": "red" if reds else "green", "red_count": len(reds), "watch_count": len(decs) - len(reds), "top": None}
    if reds:
        out["top"] = dec_view(S, reds[0], user, H)
    return out
