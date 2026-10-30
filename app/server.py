"""Local-only HTTP server (stdlib). Binds to loopback, serves the UI and a JSON API.

Identity here is a demo user picker used to exercise role/customer separation.
It is NOT authentication; the server must never be exposed beyond loopback.
"""
import argparse
import json
import math
import re
import sqlite3
import threading
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import db as dbm
from . import ops
from . import biz
from .db import row, rows, tx
from .i18n import MERGED as I18N_EN, localize
from .rules import KIND_LABEL, case_summary, change_impact, kpis, line_state, portfolio, reconcile
from .seed import ROLES, seed
from .workflow import STAGE_KEYS, STAGES, can_advance_role, checks, create_tasks

STATIC = Path(__file__).parent / "static"
LOOPBACK = {"127.0.0.1", "localhost", "::1"}
MAX_BODY = 64 * 1024
LOCK = threading.RLock()

ASSET_KINDS = {"web", "video", "image", "social", "interactive", "audio", "other"}
CREATIVES = [
    {"key": "lp-aqualux", "kind": "web", "title": "AQUA-LUX 新発売キャンペーンサイト", "brand": "デモ消費財(架空)",
     "desc": "スクロール連動のレスポンシブLP。フレーバー切替・カウントダウン・応募フォーム付き", "size": "レスポンシブ"},
    {"key": "video-aqualux15", "kind": "video", "title": "AQUA-LUX 15秒ブランドムービー", "brand": "デモ消費財(架空)",
     "desc": "Canvasで描く15秒の映像。再生・シーク・サウンド切替に対応", "size": "16:9 / 15秒"},
    {"key": "banner-set", "kind": "image", "title": "秋の味覚フェア ディスプレイバナーセット", "brand": "デモ消費財(架空)",
     "desc": "300×250 / 728×90 / 160×600 のアニメーションバナー3種", "size": "3サイズ"},
    {"key": "story-autumn", "kind": "social", "title": "秋の味覚フェア 縦型ストーリー", "brand": "デモ消費財(架空)",
     "desc": "9:16のSNSストーリー。タップ送り・長押し一時停止・スワイプCTA", "size": "9:16"},
    {"key": "car-configurator", "kind": "interactive", "title": "新型EV「EV-X」インタラクティブ体験", "brand": "デモ自動車(架空)",
     "desc": "ボディ色・航続距離・走行速度を操作できるSVGコンフィギュレーター", "size": "インタラクティブ"},
]
CREATIVE_KEYS = {c["key"] for c in CREATIVES}

PERMS = {
    "create_case": {"sales", "manager"},
    "edit_brief": {"sales", "manager"},
    "edit_lines": {"sales", "manager"},
    "create_change": {"sales", "manager"},
    "approve_change": {"manager"},
    "execute_change": {"media", "production", "manager"},
    "ingest_po": {"media", "manager"},
    "ingest_delivery": {"media", "production", "manager"},
    "ingest_acceptance": {"sales", "manager"},
    "ingest_invoice": {"finance", "manager"},
    "create_asset": {"production", "manager"},
    "approve_asset": {"legal", "manager"},
    "use_asset": {"production", "media", "manager"},
    "manage_flights": {"media", "manager"},
    "record_metrics": {"analyst", "manager"},
    "accept_exception": {"finance", "manager"},
    "resolve_exception": {"sales", "media", "production", "finance", "legal", "analyst", "manager"},
    "reconcile": {"sales", "media", "production", "finance", "legal", "analyst", "manager"},
    "read_audit": {"auditor", "manager", "legal"},
}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def now_iso():
    return datetime.now().replace(microsecond=0).isoformat()


def audit(conn, user, action, entity, entity_id, detail=""):
    conn.execute("INSERT INTO audit_log(ts,user_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?,?)",
                 (now_iso(), user["id"], action, entity, str(entity_id), detail[:500]))


def need(user, perm):
    if user["role"] not in PERMS[perm]:
        raise ApiError(403, "この操作を行う権限がありません")


def accessible_cases(conn, user):
    return {r["case_id"] for r in rows(conn, "SELECT c.id case_id FROM cases c JOIN user_access a ON a.customer_id=c.customer_id WHERE a.user_id=?", (user["id"],))}


def require_case(conn, user, case_id):
    if case_id not in accessible_cases(conn, user):
        raise ApiError(404, "案件が見つかりません")  # same response whether missing or out of scope
    return row(conn, "SELECT * FROM cases WHERE id=?", (case_id,))


def case_of_line(conn, user, line_id):
    line = row(conn, "SELECT * FROM lines WHERE id=?", (line_id,))
    if not line:
        raise ApiError(404, "明細が見つかりません")
    require_case(conn, user, line["case_id"])
    return line


def num(body, key, default=None, minimum=0.0, maximum=1e12, required=False):
    v = body.get(key, default)
    if v is None:
        if required:
            raise ApiError(400, f"{key} は必須です")
        return default
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or v < minimum or v > maximum:
        raise ApiError(400, f"{key} が不正です")
    return v


def text(body, key, required=True, maxlen=200):
    v = body.get(key, "")
    if not isinstance(v, str) or len(v) > maxlen or (required and not v.strip()):
        raise ApiError(400, f"{key} が不正です")
    return v.strip()


def iso_date(body, key, default=None):
    v = body.get(key) or default
    try:
        return date.fromisoformat(v).isoformat()
    except (TypeError, ValueError):
        raise ApiError(400, f"{key} はYYYY-MM-DD形式で指定してください")


def after_mutation(conn):
    reconcile(conn)


def case_detail(conn, case):
    cid = case["id"]
    lines = []
    for ln in rows(conn, "SELECT l.*, p.name product_name, p.type product_type, p.acceptance_rule FROM lines l JOIN products p ON p.id=l.product_id WHERE case_id=? ORDER BY l.id", (cid,)):
        ln["state"] = line_state(conn, ln)
        lid = ln["id"]
        ln["deliveries"] = rows(conn, "SELECT * FROM deliveries WHERE line_id=? ORDER BY delivered_at", (lid,))
        ln["acceptances"] = rows(conn, "SELECT * FROM acceptances WHERE line_id=? ORDER BY accepted_at", (lid,))
        ln["invoices"] = rows(conn, "SELECT * FROM invoices WHERE line_id=? ORDER BY invoiced_at", (lid,))
        ln["purchase_orders"] = rows(conn, "SELECT * FROM purchase_orders WHERE line_id=? ORDER BY issued_at", (lid,))
        lines.append(ln)
    changes = rows(conn, "SELECT * FROM changes WHERE case_id=? ORDER BY id DESC", (cid,))
    assets = rows(conn, "SELECT * FROM assets WHERE case_id=? ORDER BY id", (cid,))
    exceptions = rows(conn, "SELECT * FROM exceptions WHERE case_id=? ORDER BY status, severity, id", (cid,))
    events = []
    for ln in lines:
        for k, label, date_key in (("purchase_orders", "発注", "issued_at"), ("deliveries", "納品・履行", "delivered_at"),
                                   ("acceptances", "検収", "accepted_at"), ("invoices", "請求", "invoiced_at")):
            for r in ln[k]:
                events.append({"at": r[date_key][:10], "type": label, "line": ln["description"], "ref": r.get("external_ref")})
    for c in changes:
        events.append({"at": c["requested_at"][:10], "type": "変更依頼", "line": c["description"], "ref": f"変更#{c['id']}"})
    events.sort(key=lambda e: e["at"])
    flights = rows(conn, "SELECT * FROM flights WHERE case_id=? ORDER BY start_date, id", (cid,))
    metrics = rows(conn, "SELECT flight_id, day, impressions, clicks, conversions, spend FROM metrics WHERE case_id=? ORDER BY day", (cid,))
    totals = {}
    for m in metrics:
        t = totals.setdefault(m["flight_id"], {"impressions": 0, "clicks": 0, "conversions": 0, "spend": 0})
        for k in t:
            t[k] += m[k]
    for f in flights:
        f["totals"] = totals.get(f["id"], {"impressions": 0, "clicks": 0, "conversions": 0, "spend": 0})
    tasks = rows(conn, "SELECT * FROM tasks WHERE case_id=? ORDER BY id", (cid,))
    return {"case": case, "summary": case_summary(conn, cid), "lines": lines, "changes": changes,
            "assets": assets, "exceptions": exceptions, "timeline": events, "flights": flights, "metrics": metrics,
            "tasks": tasks, "stages": STAGES, "checks": checks(conn, case),
            "customer": row(conn, "SELECT * FROM customers WHERE id=?", (case["customer_id"],))}


def csp_for(path):
    if path.startswith("/creatives/"):
        # Sample ad creatives are self-contained pages that need inline script/style, so they get their own
        # locked-down policy: no network, no storage, sandboxed.
        return ("default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; media-src data:; "
                "font-src data:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts")
    return ("default-src 'self'; img-src 'self' data:; frame-src 'self'; frame-ancestors 'self'; "
            "base-uri 'none'; form-action 'self'; object-src 'none'")


class Handler(BaseHTTPRequestHandler):
    server_version = "LocalOnly/1.0"
    conn = None
    allowed_hosts = set()

    def log_message(self, fmt, *args):
        pass

    # ---- plumbing
    def _send(self, status, payload, ctype="application/json; charset=utf-8", path=""):
        body = payload if isinstance(payload, bytes) else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "SAMEORIGIN")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Security-Policy", csp_for(path))
            self.end_headers()
            self.wfile.write(body)
        except ConnectionError:
            pass  # the browser tab went away mid-response

    def _guard(self):
        host = (self.headers.get("Host") or "").lower()
        if host not in self.allowed_hosts:
            raise ApiError(403, "ローカルホスト以外のHostは許可されません")
        origin = self.headers.get("Origin")
        if self.command != "GET" and origin and origin.lower() not in {f"http://{h}" for h in self.allowed_hosts}:
            raise ApiError(403, "許可されないOriginです")

    def _user(self, conn):
        uid = self.headers.get("X-User", "")
        user = row(conn, "SELECT * FROM users WHERE id=?", (uid,))
        if not user:
            raise ApiError(401, "ユーザーを選択してください")
        return user

    def _body(self):
        if self._too_large:
            raise ApiError(413, "リクエストが大きすぎます")
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            raise ApiError(415, "Content-Type は application/json が必要です")
        try:
            data = json.loads(self._raw or b"{}")
        except ValueError:
            raise ApiError(400, "JSONが不正です")
        if not isinstance(data, dict):
            raise ApiError(400, "JSONオブジェクトが必要です")
        return data

    def _dispatch(self):
        # Drain the request body first so an early rejection never resets the client's connection.
        try:
            n = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            n = 0
        self._too_large = n > MAX_BODY
        self._raw = self.rfile.read(n) if 0 < n <= MAX_BODY else b""
        try:
            self._guard()
            url = urlparse(self.path)
            if self.command == "GET" and not url.path.startswith("/api/"):
                return self._static(url.path)
            if not url.path.startswith("/api/"):
                raise ApiError(404, "not found")
            body = self._body() if self.command == "POST" else {}
            with LOCK:
                result = self._route(url, body)
            self._send(200, localize(result, self._lang()))
        except ApiError as e:
            self._send(e.status, {"error": localize(e.message, self._lang())})
        except sqlite3.IntegrityError:
            self._send(409, {"error": localize("整合性エラー（重複または参照不正）", self._lang())})
        except Exception:  # never leak internals to the client
            self._send(500, {"error": localize("内部エラー", self._lang())})

    do_GET = do_POST = _dispatch

    def _lang(self):
        return "en" if (self.headers.get("X-Lang") or "").lower() == "en" else "ja"

    def _static(self, path):
        name = "index.html" if path in ("/", "") else path.lstrip("/")
        f = (STATIC / name).resolve()
        if STATIC.resolve() not in f.parents or not f.is_file():
            raise ApiError(404, "not found")
        ctype = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
                 ".svg": "image/svg+xml"}.get(f.suffix, "application/octet-stream")
        self._send(200, f.read_bytes(), ctype, path="/" + name)

    # ---- routes
    def _route(self, url, body):
        conn, m, q = self.conn, None, parse_qs(url.query)
        p, method = url.path, self.command

        if p == "/api/i18n" and method == "GET":
            return {"en": I18N_EN}
        if p == "/api/users" and method == "GET":
            return {"users": rows(conn, "SELECT id,name,role FROM users"), "roles": ROLES}
        user = self._user(conn)

        if p.startswith("/api/biz/"):
            try:
                return biz.route(conn, user, method, p, body, q, accessible_cases(conn, user))
            except biz.BizError as e:
                raise ApiError(e.status, e.message)
            except (ValueError, TypeError):
                raise ApiError(400, "パラメータが不正です")
        if p.startswith("/api/ops/"):
            try:
                result = ops.route(conn, user, method, p, body, q, accessible_cases(conn, user))
            except ops.OpsError as e:
                raise ApiError(e.status, e.message)
            return result

        if p == "/api/me":
            return {"user": user, "role_label": ROLES[user["role"]], "perms": sorted(k for k, v in PERMS.items() if user["role"] in v)}
        if p == "/api/creatives":
            return {"creatives": CREATIVES}
        if p == "/api/products":
            return {"products": rows(conn, "SELECT * FROM products ORDER BY id")}
        if p == "/api/customers":
            return {"customers": rows(conn, "SELECT c.* FROM customers c JOIN user_access a ON a.customer_id=c.id WHERE a.user_id=? ORDER BY c.id", (user["id"],))}
        if p == "/api/dashboard":
            ids = accessible_cases(conn, user)
            ex = [e for e in rows(conn, "SELECT * FROM exceptions WHERE status='open' ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, due LIMIT 200") if e["case_id"] in ids][:8]
            for e in ex:
                e["kind_label"] = KIND_LABEL.get(e["kind"], e["kind"])
            return {"kpis": kpis(conn, case_ids=ids), "top_exceptions": ex, "portfolio": portfolio(conn, ids), "stages": STAGES}
        if p == "/api/cases" and method == "GET":
            out = []
            for cid in sorted(accessible_cases(conn, user)):
                c = row(conn, "SELECT c.*, cu.name customer_name FROM cases c JOIN customers cu ON cu.id=c.customer_id WHERE c.id=?", (cid,))
                c["summary"] = case_summary(conn, cid)
                c["open_exceptions"] = row(conn, "SELECT COUNT(*) n FROM exceptions WHERE case_id=? AND status='open'", (cid,))["n"]
                c["assets"] = rows(conn, "SELECT id, name, kind, sample_key FROM assets WHERE case_id=? ORDER BY id", (cid,))
                out.append(c)
            return {"cases": out, "stages": STAGES}
        if p == "/api/cases" and method == "POST":
            return self._create_case(conn, user, body)
        if (m := re.fullmatch(r"/api/cases/(\d+)", p)) and method == "GET":
            return case_detail(conn, require_case(conn, user, int(m[1])))
        if (m := re.fullmatch(r"/api/cases/(\d+)/(brief|lines|advance|revert|flights|metrics)", p)) and method == "POST":
            return self._case_action(conn, user, require_case(conn, user, int(m[1])), m[2], body)
        if (m := re.fullmatch(r"/api/tasks/(\d+)/status", p)) and method == "POST":
            return self._task_status(conn, user, int(m[1]), body)
        if (m := re.fullmatch(r"/api/flights/(\d+)/status", p)) and method == "POST":
            return self._flight_status(conn, user, int(m[1]), body)
        if p == "/api/changes/impact" and method == "POST":
            need(user, "create_change")
            cid = int(num(body, "case_id", required=True, maximum=1e9))
            require_case(conn, user, cid)
            return change_impact(conn, cid, text(body, "description"), int(num(body, "days_delta", 0, -365, 365)))
        if (m := re.fullmatch(r"/api/cases/(\d+)/changes", p)) and method == "POST":
            need(user, "create_change")
            case = require_case(conn, user, int(m[1]))
            line_id = body.get("line_id")
            if line_id is not None:
                ln = case_of_line(conn, user, int(line_id))
                if ln["case_id"] != case["id"]:
                    raise ApiError(400, "明細が案件に属していません")
            emergency = 1 if body.get("emergency") is True else 0
            due = iso_date(body, "post_approval_due") if emergency else None
            with tx(conn):
                cur = conn.execute(
                    "INSERT INTO changes(case_id,line_id,description,amount_delta,cost_delta,days_delta,emergency,status,requested_by,requested_at,post_approval_due) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    (case["id"], line_id, text(body, "description"), num(body, "amount_delta", 0, -1e12), num(body, "cost_delta", 0, -1e12),
                     int(num(body, "days_delta", 0, -365, 365)), emergency, "pending", user["id"], now_iso(), due))
                audit(conn, user, "create", "change", cur.lastrowid, f"緊急={bool(emergency)}")
                after_mutation(conn)
            return {"id": cur.lastrowid}
        if (m := re.fullmatch(r"/api/changes/(\d+)/(approve|reject|execute)", p)) and method == "POST":
            ch = row(conn, "SELECT * FROM changes WHERE id=?", (int(m[1]),))
            if not ch:
                raise ApiError(404, "変更が見つかりません")
            require_case(conn, user, ch["case_id"])
            act = m[2]
            need(user, "execute_change" if act == "execute" else "approve_change")
            with tx(conn):
                if act in ("approve", "reject"):
                    if ch["status"] != "pending":
                        raise ApiError(409, "承認待ちの変更のみ処理できます")
                    if ch["requested_by"] == user["id"]:
                        raise ApiError(403, "申請者本人は承認できません")
                    st = "approved" if act == "approve" else "rejected"
                    conn.execute("UPDATE changes SET status=?, approved_by=?, approved_at=? WHERE id=?", (st, user["id"], now_iso(), ch["id"]))
                else:
                    if ch["status"] == "rejected":
                        raise ApiError(409, "却下された変更は実行できません")
                    if ch["executed_at"]:
                        raise ApiError(409, "実行済みです")
                    if ch["status"] != "approved" and not ch["emergency"]:
                        raise ApiError(409, "承認前の実行は緊急変更のみ可能です")
                    conn.execute("UPDATE changes SET executed_at=? WHERE id=?", (now_iso(), ch["id"]))
                audit(conn, user, act, "change", ch["id"])
                after_mutation(conn)
            return {"ok": True}

        if (m := re.fullmatch(r"/api/ingest/(po|delivery|acceptance|invoice)", p)) and method == "POST":
            need(user, f"ingest_{m[1]}")
            return self._ingest(conn, user, m[1], body)
        if (m := re.fullmatch(r"/api/cases/(\d+)/assets", p)) and method == "POST":
            need(user, "create_asset")
            case = require_case(conn, user, int(m[1]))
            exp = body.get("rights_expiry")
            kind = body.get("kind", "other")
            key = body.get("sample_key") or None
            if kind not in ASSET_KINDS or (key is not None and key not in CREATIVE_KEYS):
                raise ApiError(400, "種別またはサンプルが不正です")
            with tx(conn):
                cur = conn.execute("INSERT INTO assets(case_id,name,version,rights_expiry,approved,used_at,kind,sample_key) VALUES(?,?,?,?,0,NULL,?,?)",
                                   (case["id"], text(body, "name"), int(num(body, "version", 1, 1, 9999)), iso_date(body, "rights_expiry") if exp else None, kind, key))
                audit(conn, user, "create", "asset", cur.lastrowid, f"{kind} {key or ''}")
                after_mutation(conn)
            return {"id": cur.lastrowid}
        if (m := re.fullmatch(r"/api/assets/(\d+)/(approve|use)", p)) and method == "POST":
            need(user, "approve_asset" if m[2] == "approve" else "use_asset")
            a = row(conn, "SELECT * FROM assets WHERE id=?", (int(m[1]),))
            if not a:
                raise ApiError(404, "素材が見つかりません")
            require_case(conn, user, a["case_id"])
            with tx(conn):
                if m[2] == "approve":
                    conn.execute("UPDATE assets SET approved=1 WHERE id=?", (a["id"],))
                else:
                    conn.execute("UPDATE assets SET used_at=? WHERE id=?", (now_iso(), a["id"]))
                audit(conn, user, m[2], "asset", a["id"])
                after_mutation(conn)
            return {"ok": True}

        if p == "/api/exceptions" and method == "GET":
            ids = accessible_cases(conn, user)
            status = (q.get("status") or ["open"])[0]
            if status not in ("open", "resolved", "accepted", "all"):
                raise ApiError(400, "status が不正です")
            out = [e for e in rows(conn, "SELECT e.*, c.name case_name FROM exceptions e JOIN cases c ON c.id=e.case_id ORDER BY CASE e.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, e.due, e.id")
                   if e["case_id"] in ids and (status == "all" or e["status"] == status)]
            today = date.today().isoformat()
            for e in out:
                e["kind_label"] = KIND_LABEL.get(e["kind"], e["kind"])
                e["overdue"] = e["status"] == "open" and e["due"] < today
            return {"exceptions": out}
        if (m := re.fullmatch(r"/api/exceptions/(\d+)/(resolve|accept)", p)) and method == "POST":
            ex = row(conn, "SELECT * FROM exceptions WHERE id=?", (int(m[1]),))
            if not ex:
                raise ApiError(404, "例外が見つかりません")
            require_case(conn, user, ex["case_id"])
            need(user, "accept_exception" if m[2] == "accept" else "resolve_exception")
            if ex["status"] != "open":
                raise ApiError(409, "対応中の例外のみ処理できます")
            reason = text(body, "reason", maxlen=300)
            with tx(conn):
                if m[2] == "accept":
                    conn.execute("UPDATE exceptions SET status='accepted', resolved_at=?, resolution=? WHERE id=?", (now_iso(), f"差異承認: {reason}", ex["id"]))
                else:
                    # Manual note only; the item stays open until the underlying condition is fixed.
                    conn.execute("UPDATE exceptions SET resolution=? WHERE id=?", (f"対応メモ: {reason}", ex["id"]))
                audit(conn, user, m[2], "exception", ex["id"], reason)
            return {"ok": True}
        if p == "/api/reconcile" and method == "POST":
            need(user, "reconcile")
            with tx(conn):
                res = reconcile(conn)
                audit(conn, user, "reconcile", "exceptions", "-", json.dumps(res))
            return res
        if p == "/api/audit" and method == "GET":
            need(user, "read_audit")
            return {"audit": rows(conn, "SELECT * FROM audit_log ORDER BY id DESC LIMIT 200")}
        raise ApiError(404, "not found")

    def _create_case(self, conn, user, body):
        need(user, "create_case")
        cust = int(num(body, "customer_id", required=True, maximum=1e9))
        if not row(conn, "SELECT 1 FROM user_access WHERE user_id=? AND customer_id=?", (user["id"], cust)):
            raise ApiError(404, "顧客が見つかりません")
        start, end = iso_date(body, "start_date"), iso_date(body, "end_date")
        if end < start:
            raise ApiError(400, "終了日は開始日以降にしてください")
        with tx(conn):
            cur = conn.execute(
                "INSERT INTO cases(customer_id,name,status,start_date,end_date,owner,stage,objective,target,budget,kpi_name,kpi_target) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                (cust, text(body, "name", maxlen=80), "active", start, end, user["id"], "plan", text(body, "objective", False, 300),
                 text(body, "target", False, 200), num(body, "budget", 0), text(body, "kpi_name", False, 80), num(body, "kpi_target", None)))
            create_tasks(conn, cur.lastrowid)
            audit(conn, user, "create", "case", cur.lastrowid)
            after_mutation(conn)
        return {"id": cur.lastrowid}

    def _case_action(self, conn, user, case, act, body):
        cid, stage = case["id"], case["stage"]
        idx = STAGE_KEYS.index(stage)
        if act == "revert":
            if user["role"] != "manager":
                raise ApiError(403, "差戻しは業務責任者のみ可能です")
            reason = text(body, "reason", maxlen=200)
            with tx(conn):
                if case["status"] == "completed":
                    conn.execute("UPDATE cases SET status='active', stage='measure' WHERE id=?", (cid,))
                elif idx > 0:
                    conn.execute("UPDATE cases SET stage=? WHERE id=?", (STAGE_KEYS[idx - 1], cid))
                else:
                    raise ApiError(409, "最初のステージです")
                audit(conn, user, "revert", "case", cid, reason)
            return {"ok": True}
        if case["status"] != "active":
            raise ApiError(409, "完了した案件は編集できません")

        if act == "advance":
            if not can_advance_role(stage, user["role"]):
                raise ApiError(403, "このステージを進める権限がありません")
            failed = [c["label"] for c in checks(conn, case)[stage] if not c["ok"]]
            if failed:
                raise ApiError(409, "未達の条件があります: " + " / ".join(failed))
            with tx(conn):
                if idx + 1 < len(STAGE_KEYS):
                    conn.execute("UPDATE cases SET stage=? WHERE id=?", (STAGE_KEYS[idx + 1], cid))
                else:
                    conn.execute("UPDATE cases SET status='completed' WHERE id=?", (cid,))
                audit(conn, user, "advance", "case", cid, f"{stage} -> {STAGE_KEYS[idx + 1] if idx + 1 < len(STAGE_KEYS) else 'completed'}")
                after_mutation(conn)
            return {"ok": True}

        if act == "brief":
            need(user, "edit_brief")
            if stage not in ("plan", "contract"):
                raise ApiError(409, "ブリーフは契約確定後に直接編集できません。変更管理を利用してください")
            start = iso_date(body, "start_date", case["start_date"])
            end = iso_date(body, "end_date", case["end_date"])
            if end < start:
                raise ApiError(400, "終了日は開始日以降にしてください")
            kt = num(body, "kpi_target", case["kpi_target"])
            with tx(conn):
                conn.execute("UPDATE cases SET objective=?, target=?, budget=?, kpi_name=?, kpi_target=?, start_date=?, end_date=? WHERE id=?",
                             (text(body, "objective", False, 300) if "objective" in body else case["objective"],
                              text(body, "target", False, 200) if "target" in body else case["target"],
                              num(body, "budget", case["budget"]),
                              text(body, "kpi_name", False, 80) if "kpi_name" in body else case["kpi_name"], kt, start, end, cid))
                audit(conn, user, "update", "brief", cid)
            return {"ok": True}

        if act == "lines":
            need(user, "edit_lines")
            if stage not in ("plan", "contract"):
                raise ApiError(409, "契約確定後の明細追加は変更管理を利用してください")
            prod = row(conn, "SELECT * FROM products WHERE id=?", (int(num(body, "product_id", required=True, maximum=1e9)),))
            if not prod:
                raise ApiError(400, "商材が見つかりません")
            with tx(conn):
                cur = conn.execute("INSERT INTO lines(case_id,product_id,product_version,description,qty,unit_price,cost_budget) VALUES(?,?,?,?,?,?,?)",
                                   (cid, prod["id"], prod["version"], text(body, "description"), num(body, "qty", required=True, minimum=0.0001, maximum=1e9),
                                    num(body, "unit_price", required=True), num(body, "cost_budget", 0)))
                audit(conn, user, "create", "line", cur.lastrowid)
                after_mutation(conn)
            return {"id": cur.lastrowid}

        if act == "flights":
            need(user, "manage_flights")
            if idx < STAGE_KEYS.index("review"):
                raise ApiError(409, "配信計画は審査・承認ステージ以降で登録できます")
            line = row(conn, "SELECT * FROM lines WHERE id=? AND case_id=?", (int(num(body, "line_id", required=True, maximum=1e9)), cid))
            if not line:
                raise ApiError(400, "明細が案件に属していません")
            kind = body.get("kind", "digital")
            if kind not in ("digital", "broadcast"):
                raise ApiError(400, "kind が不正です")
            start, end = iso_date(body, "start_date"), iso_date(body, "end_date")
            if end < start:
                raise ApiError(400, "終了日は開始日以降にしてください")
            cr = body.get("creative_id")
            if cr is not None and not row(conn, "SELECT 1 FROM assets WHERE id=? AND case_id=?", (int(cr), cid)):
                raise ApiError(400, "作品が案件に属していません")
            with tx(conn):
                cur = conn.execute("INSERT INTO flights(case_id,line_id,channel,kind,start_date,end_date,budget,creative_id,status) VALUES(?,?,?,?,?,?,?,?,'planned')",
                                   (cid, line["id"], text(body, "channel", maxlen=80), kind, start, end, num(body, "budget", required=True), cr))
                audit(conn, user, "create", "flight", cur.lastrowid)
            return {"id": cur.lastrowid}

        if act == "metrics":
            need(user, "record_metrics")
            if idx < STAGE_KEYS.index("deploy"):
                raise ApiError(409, "成果データは展開・配信ステージ以降で記録できます")
            fl = row(conn, "SELECT * FROM flights WHERE id=? AND case_id=?", (int(num(body, "flight_id", required=True, maximum=1e9)), cid))
            if not fl:
                raise ApiError(400, "配信が案件に属していません")
            day = iso_date(body, "day")
            if not (fl["start_date"] <= day <= fl["end_date"]) or day > date.today().isoformat():
                raise ApiError(400, "配信期間内かつ本日以前の日付を指定してください")
            vals = [int(num(body, k, 0, 0, 1e12)) for k in ("impressions", "clicks", "conversions")] + [num(body, "spend", 0)]
            with tx(conn):
                conn.execute("INSERT INTO metrics(case_id,flight_id,day,impressions,clicks,conversions,spend) VALUES(?,?,?,?,?,?,?) "
                             "ON CONFLICT(flight_id,day) DO UPDATE SET impressions=excluded.impressions, clicks=excluded.clicks, "
                             "conversions=excluded.conversions, spend=excluded.spend", (cid, fl["id"], day, *vals))
                audit(conn, user, "upsert", "metrics", fl["id"], day)
            return {"ok": True}
        raise ApiError(404, "not found")

    def _task_status(self, conn, user, task_id, body):
        t = row(conn, "SELECT * FROM tasks WHERE id=?", (task_id,))
        if not t:
            raise ApiError(404, "タスクが見つかりません")
        case = require_case(conn, user, t["case_id"])
        if user["role"] not in (t["dept"], "manager"):
            raise ApiError(403, "担当部署のタスクのみ更新できます")
        if case["status"] != "active":
            raise ApiError(409, "完了した案件は編集できません")
        st = body.get("status")
        if st not in ("todo", "doing", "done"):
            raise ApiError(400, "status が不正です")
        with tx(conn):
            conn.execute("UPDATE tasks SET status=?, done_by=?, done_at=? WHERE id=?",
                         (st, user["id"] if st == "done" else None, now_iso() if st == "done" else None, task_id))
            audit(conn, user, "task", "task", task_id, st)
        return {"ok": True}

    def _flight_status(self, conn, user, flight_id, body):
        need(user, "manage_flights")
        f = row(conn, "SELECT * FROM flights WHERE id=?", (flight_id,))
        if not f:
            raise ApiError(404, "配信が見つかりません")
        case = require_case(conn, user, f["case_id"])
        st = body.get("status")
        if (f["status"], st) not in (("planned", "live"), ("live", "done")):
            raise ApiError(409, "状態遷移が不正です（計画→配信中→完了）")
        if st == "live":
            if STAGE_KEYS.index(case["stage"]) < STAGE_KEYS.index("deploy"):
                raise ApiError(409, "配信開始は展開・配信ステージ以降です")
            if f["kind"] == "digital" and not row(conn, "SELECT 1 FROM assets WHERE id=? AND approved=1", (f["creative_id"],)):
                raise ApiError(409, "承認済みの作品が紐づいていないため配信を開始できません")
        with tx(conn):
            conn.execute("UPDATE flights SET status=? WHERE id=?", (st, flight_id))
            audit(conn, user, st, "flight", flight_id)
            after_mutation(conn)
        return {"ok": True}

    def _ingest(self, conn, user, kind, body):
        line = case_of_line(conn, user, int(num(body, "line_id", required=True, maximum=1e9)))
        ref = text(body, "external_ref", required=False, maxlen=80) or None
        table = {"po": "purchase_orders", "delivery": "deliveries", "acceptance": "acceptances", "invoice": "invoices"}[kind]
        if ref:
            dup = row(conn, f"SELECT id FROM {table} WHERE external_ref=?", (ref,))
            if dup:
                return {"id": dup["id"], "duplicate": True}  # idempotent replay
        today = date.today().isoformat()
        with tx(conn):
            if kind == "po":
                change_id = body.get("change_id")
                if change_id is not None:
                    ch = row(conn, "SELECT case_id FROM changes WHERE id=?", (int(change_id),))
                    if not ch or ch["case_id"] != line["case_id"]:
                        raise ApiError(400, "変更IDが不正です")
                cur = conn.execute("INSERT INTO purchase_orders(case_id,line_id,vendor,amount,issued_at,change_id,external_ref) VALUES(?,?,?,?,?,?,?)",
                                   (line["case_id"], line["id"], text(body, "vendor"), num(body, "amount", required=True), iso_date(body, "date", today), change_id, ref))
            elif kind == "delivery":
                cur = conn.execute("INSERT INTO deliveries(line_id,qty,delivered_at,evidence,external_ref) VALUES(?,?,?,?,?)",
                                   (line["id"], num(body, "qty", required=True, minimum=0.0001), iso_date(body, "date", today), text(body, "evidence", False), ref))
            elif kind == "acceptance":
                cur = conn.execute("INSERT INTO acceptances(line_id,qty,accepted_at,accepted_by,evidence,external_ref) VALUES(?,?,?,?,?,?)",
                                   (line["id"], num(body, "qty", required=True, minimum=0.0001), iso_date(body, "date", today), text(body, "accepted_by"), text(body, "evidence", False), ref))
            else:
                cur = conn.execute("INSERT INTO invoices(line_id,qty,amount,invoiced_at,external_ref) VALUES(?,?,?,?,?)",
                                   (line["id"], num(body, "qty", required=True, minimum=0.0001), num(body, "amount", required=True), iso_date(body, "date", today), ref))
            audit(conn, user, "ingest", kind, cur.lastrowid, ref or "")
            after_mutation(conn)
        return {"id": cur.lastrowid, "duplicate": False}


def make_server(port=8765, db_path=None, host="127.0.0.1"):
    if host not in LOOPBACK:
        raise SystemExit("セキュリティ上、ループバックアドレス以外にはバインドできません")
    conn = dbm.connect(db_path)
    seed(conn)
    handler = type("BoundHandler", (Handler,), {"conn": conn})
    srv = ThreadingHTTPServer((host, port), handler)
    port = srv.server_address[1]
    handler.allowed_hosts = {f"127.0.0.1:{port}", f"localhost:{port}", f"[::1]:{port}"}
    srv.daemon_threads = True
    return srv


def main():
    ap = argparse.ArgumentParser(description="ローカル専用: 案件ライフサイクル管理（デモ）")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--db", default=None, help="SQLiteファイルのパス（既定: data/app.db）")
    ap.add_argument("--host", default="127.0.0.1", help="ループバックのみ許可")
    a = ap.parse_args()
    srv = make_server(a.port, a.db, a.host)
    print(f"http://127.0.0.1:{srv.server_address[1]}/  (Ctrl+C で停止。外部ネットワークには公開されません)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
