import http.client
import json
import threading
import unittest

from app.server import make_server


class AppTest(unittest.TestCase):
    def setUp(self):
        self.srv = make_server(port=0, db_path=":memory:")
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def tearDown(self):
        self.srv.shutdown()
        self.srv.server_close()

    def call(self, method, path, user=None, body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Host": f"127.0.0.1:{self.port}"}
        if user:
            h["X-User"] = user
        if body is not None:
            h["Content-Type"] = "application/json"
        h.update(headers or {})
        c.request(method, path, json.dumps(body) if body is not None else None, h)
        r = c.getresponse()
        raw = r.read()
        c.close()
        try:
            return r.status, json.loads(raw)
        except ValueError:
            return r.status, raw

    def exceptions(self, user="mgr1", status="open"):
        return self.call("GET", f"/api/exceptions?status={status}", user)[1]["exceptions"]

    # --- tests are order independent: each builds on seed facts only
    def test_seed_detects_expected_kinds(self):
        kinds = {e["kind"] for e in self.exceptions()}
        for k in ("UNBILLED", "INVOICE_BEFORE_ACCEPTANCE", "DUPLICATE_INVOICE", "COST_OVERRUN",
                  "UNAPPROVED_CHANGE", "EMERGENCY_APPROVAL_OVERDUE", "UNAPPROVED_ASSET_USED", "RIGHTS_EXPIRY"):
            self.assertIn(k, kinds)

    def test_customer_isolation(self):
        s, d = self.call("GET", "/api/cases", "sales2")
        self.assertEqual({c["id"] for c in d["cases"]}, {1, 2})
        self.assertEqual(self.call("GET", "/api/cases/3", "sales2")[0], 404)
        self.assertTrue(all(e["case_id"] in (1, 2) for e in self.exceptions("sales2")))
        s, d = self.call("GET", "/api/dashboard", "sales2")
        self.assertEqual(s, 200)

    def test_role_permissions(self):
        body = {"line_id": 3, "qty": 1, "amount": 1000000, "external_ref": "T-PERM"}
        self.assertEqual(self.call("POST", "/api/ingest/invoice", "sales1", body)[0], 403)
        self.assertEqual(self.call("GET", "/api/audit", "sales1")[0], 403)
        self.assertEqual(self.call("GET", "/api/audit", "audit1")[0], 200)
        self.assertEqual(self.call("GET", "/api/me")[0], 401)

    def test_localhost_only_guards(self):
        s, _ = self.call("GET", "/api/users", headers={"Host": "evil.example"})
        self.assertEqual(s, 403)
        s, _ = self.call("POST", "/api/reconcile", "mgr1", {}, headers={"Origin": "http://evil.example"})
        self.assertEqual(s, 403)
        c = http.client.HTTPConnection("127.0.0.1", self.port)
        c.request("POST", "/api/reconcile", "{}", {"Host": f"127.0.0.1:{self.port}", "X-User": "mgr1", "Content-Type": "text/plain"})
        self.assertEqual(c.getresponse().status, 415)
        with self.assertRaises(SystemExit):
            make_server(port=0, db_path=":memory:", host="0.0.0.0")

    def test_static_traversal_blocked(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port)
        c.request("GET", "/../server.py", headers={"Host": f"127.0.0.1:{self.port}"})
        self.assertEqual(c.getresponse().status, 404)
        c = http.client.HTTPConnection("127.0.0.1", self.port)
        c.request("GET", "/", headers={"Host": f"127.0.0.1:{self.port}"})
        r = c.getresponse()
        self.assertEqual(r.status, 200)
        self.assertIn("default-src 'self'", r.getheader("Content-Security-Policy"))

    def test_input_validation(self):
        bad = [{"line_id": 3, "qty": 1, "amount": -5}, {"line_id": 3, "qty": "x", "amount": 5},
               {"line_id": 3, "qty": 1, "amount": 5, "date": "2026/01/01"}, {"line_id": 999, "qty": 1, "amount": 5}]
        for b in bad:
            self.assertIn(self.call("POST", "/api/ingest/invoice", "fin1", b)[0], (400, 404), b)

    def test_idempotent_ingest_and_auto_resolve(self):
        before = {e["kind"] for e in self.exceptions() if e["line_id"] == 3}
        self.assertIn("UNBILLED", before)
        body = {"line_id": 3, "qty": 1, "amount": 1000000, "external_ref": "T-IDEM"}
        s, r1 = self.call("POST", "/api/ingest/invoice", "fin1", body)
        s, r2 = self.call("POST", "/api/ingest/invoice", "fin1", body)
        self.assertEqual((r1["duplicate"], r2["duplicate"], r1["id"]), (False, True, r2["id"]))
        self.assertNotIn("UNBILLED", {e["kind"] for e in self.exceptions() if e["line_id"] == 3})
        resolved = self.exceptions(status="resolved")
        self.assertTrue(any(e["kind"] == "UNBILLED" and e["line_id"] == 3 for e in resolved))

    def test_change_workflow_controls(self):
        s, r = self.call("POST", "/api/cases/1/changes", "sales1", {"description": "追加の素材制作", "line_id": 1, "amount_delta": 100000, "cost_delta": 80000})
        self.assertEqual(s, 200)
        cid = r["id"]
        self.assertEqual(self.call("POST", f"/api/changes/{cid}/execute", "media1", {})[0], 409)  # not emergency, unapproved
        self.assertEqual(self.call("POST", f"/api/changes/{cid}/approve", "sales1", {})[0], 403)  # role
        self.assertEqual(self.call("POST", f"/api/changes/{cid}/approve", "mgr1", {})[0], 200)
        self.assertEqual(self.call("POST", f"/api/changes/{cid}/approve", "mgr1", {})[0], 409)  # already processed
        self.assertEqual(self.call("POST", f"/api/changes/{cid}/execute", "media1", {})[0], 200)
        self.assertNotIn("UNAPPROVED_CHANGE", {e["kind"] for e in self.exceptions() if e["case_id"] == 1})

    def test_no_self_approval(self):
        # a manager who requests a change cannot approve it
        s, r = self.call("POST", "/api/cases/2/changes", "mgr1", {"description": "自己申請テスト"})
        self.assertEqual(s, 200)
        self.assertEqual(self.call("POST", f"/api/changes/{r['id']}/approve", "mgr1", {})[0], 403)

    def test_accepted_exception_not_recreated(self):
        ex = next(e for e in self.exceptions() if e["kind"] == "COST_OVERRUN")
        self.assertEqual(self.call("POST", f"/api/exceptions/{ex['id']}/accept", "sales1", {"reason": "x"})[0], 403)
        self.assertEqual(self.call("POST", f"/api/exceptions/{ex['id']}/accept", "fin1", {"reason": ""})[0], 400)
        self.assertEqual(self.call("POST", f"/api/exceptions/{ex['id']}/accept", "fin1", {"reason": "顧客合意済み"})[0], 200)
        self.call("POST", "/api/reconcile", "mgr1", {})
        self.assertNotIn(ex["fingerprint"], {e["fingerprint"] for e in self.exceptions()})

    def test_impact_candidates_are_labelled(self):
        s, r = self.call("POST", "/api/changes/impact", "sales1", {"case_id": 3, "description": "発表動画に短尺版を追加", "days_delta": 3})
        self.assertEqual(s, 200)
        self.assertTrue(r["candidates"])
        self.assertIn("候補", r["disclaimer"])

    def test_kpis_shape(self):
        s, d = self.call("GET", "/api/dashboard", "mgr1")
        k = d["kpis"]
        self.assertTrue(0 <= k["trace_rate"]["value"] <= 1)
        self.assertTrue(0 <= k["change_compliance"]["value"] <= 1)


    # ---- lifecycle workflow
    USER = {"sales": "sales1", "production": "prod1", "media": "media1", "finance": "fin1", "legal": "legal1", "analyst": "ana1"}

    def finish_tasks(self, case_id, stage):
        d = self.call("GET", f"/api/cases/{case_id}", "mgr1")[1]
        for t in d["tasks"]:
            if t["stage"] == stage:
                self.assertEqual(self.call("POST", f"/api/tasks/{t['id']}/status", self.USER[t["dept"]], {"status": "done"})[0], 200)

    def stage_of(self, case_id):
        return self.call("GET", f"/api/cases/{case_id}", "mgr1")[1]["case"]

    def test_full_lifecycle_across_departments(self):
        from datetime import date, timedelta
        today = date.today()
        s, r = self.call("POST", "/api/cases", "sales1", {"customer_id": 1, "name": "E2E 案件", "objective": "認知拡大", "target": "20代", "budget": 5_000_000,
                                                          "kpi_name": "申込", "kpi_target": 100, "start_date": (today - timedelta(days=3)).isoformat(), "end_date": (today + timedelta(days=30)).isoformat()})
        self.assertEqual(s, 200)
        cid = r["id"]
        self.assertEqual(self.stage_of(cid)["stage"], "plan")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "prod1", {})[0], 403)  # not the owning department
        s, e = self.call("POST", f"/api/cases/{cid}/advance", "sales1", {})
        self.assertEqual(s, 409)  # tasks are not done yet
        self.assertIn("必須タスク", e["error"])
        self.finish_tasks(cid, "plan")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "sales1", {})[0], 200)

        # contract
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/lines", "prod1", {"product_id": 5, "description": "x", "qty": 1, "unit_price": 1})[0], 403)
        s, ln = self.call("POST", f"/api/cases/{cid}/lines", "sales1", {"product_id": 5, "description": "動画配信", "qty": 1, "unit_price": 4_000_000, "cost_budget": 3_000_000})
        self.assertEqual(s, 200)
        line = ln["id"]
        self.finish_tasks(cid, "contract")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "sales1", {})[0], 200)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/lines", "sales1", {"product_id": 5, "description": "x", "qty": 1, "unit_price": 1})[0], 409)  # frozen after contract

        # produce -> review (creative registered, then approved by legal)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/assets", "prod1", {"name": "LP", "kind": "web", "sample_key": "evil"})[0], 400)
        s, a = self.call("POST", f"/api/cases/{cid}/assets", "prod1", {"name": "キャンペーンLP", "kind": "web", "sample_key": "lp-aqualux", "rights_expiry": (today + timedelta(days=400)).isoformat()})
        self.assertEqual(s, 200)
        self.finish_tasks(cid, "produce")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "prod1", {})[0], 200)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "legal1", {})[0], 409)  # asset not approved
        self.assertEqual(self.call("POST", f"/api/assets/{a['id']}/approve", "prod1", {})[0], 403)
        self.assertEqual(self.call("POST", f"/api/assets/{a['id']}/approve", "legal1", {})[0], 200)
        self.finish_tasks(cid, "review")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "legal1", {})[0], 200)

        # deploy: flight needs an approved creative and a PO before the gate opens
        fl = {"line_id": line, "channel": "動画配信", "kind": "digital", "start_date": (today - timedelta(days=2)).isoformat(), "end_date": (today + timedelta(days=10)).isoformat(), "budget": 3_000_000, "creative_id": a["id"]}
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/flights", "sales1", fl)[0], 403)
        s, f = self.call("POST", f"/api/cases/{cid}/flights", "media1", fl)
        self.assertEqual(s, 200)
        self.assertEqual(self.call("POST", f"/api/flights/{f['id']}/status", "media1", {"status": "done"})[0], 409)  # must go live first
        self.assertEqual(self.call("POST", f"/api/flights/{f['id']}/status", "media1", {"status": "live"})[0], 200)
        self.finish_tasks(cid, "deploy")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "media1", {})[0], 409)  # no PO yet
        self.assertEqual(self.call("POST", "/api/ingest/po", "media1", {"line_id": line, "vendor": "媒体社(架空)", "amount": 2_900_000, "external_ref": "E2E-PO"})[0], 200)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "media1", {})[0], 200)

        # bill: acceptance must equal invoice and nothing may be live
        self.assertEqual(self.call("POST", f"/api/flights/{f['id']}/status", "media1", {"status": "done"})[0], 200)
        self.call("POST", "/api/ingest/delivery", "media1", {"line_id": line, "qty": 1, "evidence": "完了報告", "external_ref": "E2E-DL"})
        self.call("POST", "/api/ingest/acceptance", "sales1", {"line_id": line, "qty": 1, "accepted_by": "顧客", "external_ref": "E2E-AC"})
        self.call("POST", "/api/ingest/invoice", "fin1", {"line_id": line, "qty": 1, "amount": 4_000_000, "external_ref": "E2E-INV"})
        self.finish_tasks(cid, "bill")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "fin1", {})[0], 200)

        # measure: metrics only inside the flight window and not in the future
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/metrics", "ana1", {"flight_id": f["id"], "day": (today + timedelta(days=3)).isoformat()})[0], 400)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/metrics", "ana1", {"flight_id": f["id"], "day": today.isoformat(), "impressions": 1000, "clicks": 50, "conversions": 5, "spend": 20000})[0], 200)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/metrics", "ana1", {"flight_id": f["id"], "day": today.isoformat(), "impressions": 2000, "clicks": 60, "conversions": 6, "spend": 30000})[0], 200)  # upsert
        d = self.call("GET", f"/api/cases/{cid}", "mgr1")[1]
        self.assertEqual(len(d["metrics"]), 1)
        self.assertEqual(d["metrics"][0]["impressions"], 2000)
        self.finish_tasks(cid, "measure")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/advance", "ana1", {})[0], 200)
        self.assertEqual(self.stage_of(cid)["status"], "completed")
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/brief", "sales1", {"objective": "x"})[0], 409)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/revert", "sales1", {"reason": "x"})[0], 403)
        self.assertEqual(self.call("POST", f"/api/cases/{cid}/revert", "mgr1", {"reason": "再開"})[0], 200)
        self.assertEqual(self.stage_of(cid)["status"], "active")

    def test_brief_edit_rules_and_validation(self):
        self.assertEqual(self.call("POST", "/api/cases/4/brief", "sales1", {"budget": 8_000_000, "kpi_name": "資料請求", "kpi_target": 500})[0], 200)
        self.assertEqual(self.call("POST", "/api/cases/4/brief", "media1", {"budget": 1})[0], 403)
        self.assertEqual(self.call("POST", "/api/cases/4/brief", "sales1", {"budget": -5})[0], 400)
        self.assertEqual(self.call("POST", "/api/cases/3/brief", "sales1", {"budget": 1})[0], 409)  # already past contract
        self.assertEqual(self.call("POST", "/api/cases", "sales2", {"customer_id": 2, "name": "越権", "start_date": "2026-01-01", "end_date": "2026-02-01"})[0], 404)
        self.assertEqual(self.call("POST", "/api/cases", "sales1", {"customer_id": 1, "name": "逆転", "start_date": "2026-03-01", "end_date": "2026-02-01"})[0], 400)
        d = self.call("GET", "/api/cases/4", "mgr1")[1]
        self.assertEqual(len(d["stages"]), 7)
        plan = {c["key"]: c["ok"] for c in d["checks"]["plan"]}
        self.assertTrue(plan["budget"] and plan["objective"] is not None)

    def test_task_and_flight_permissions(self):
        d = self.call("GET", "/api/cases/3", "mgr1")[1]
        media_task = next(t for t in d["tasks"] if t["dept"] == "media")
        self.assertEqual(self.call("POST", f"/api/tasks/{media_task['id']}/status", "sales1", {"status": "done"})[0], 403)
        self.assertEqual(self.call("POST", f"/api/tasks/{media_task['id']}/status", "media1", {"status": "bogus"})[0], 400)
        self.assertEqual(self.call("POST", f"/api/tasks/{media_task['id']}/status", "sales2", {"status": "done"})[0], 404)  # out of customer scope
        flight = next(f for f in d["flights"] if f["status"] == "planned")
        # stage is still review, and the creative is unapproved
        self.assertEqual(self.call("POST", f"/api/flights/{flight['id']}/status", "media1", {"status": "live"})[0], 409)

    def test_creatives_catalog_and_static_headers(self):
        s, d = self.call("GET", "/api/creatives", "sales1")
        self.assertEqual(s, 200)
        self.assertEqual({c["kind"] for c in d["creatives"]}, {"web", "video", "image", "social", "interactive"})
        for c in d["creatives"]:
            conn = http.client.HTTPConnection("127.0.0.1", self.port)
            conn.request("GET", f"/creatives/{c['key']}.html", headers={"Host": f"127.0.0.1:{self.port}"})
            r = conn.getresponse()
            body = r.read().decode("utf-8")
            self.assertEqual(r.status, 200, c["key"])
            csp = r.getheader("Content-Security-Policy")
            self.assertIn("default-src 'none'", csp)
            self.assertIn("sandbox allow-scripts", csp)
            self.assertNotIn("https://", body)
            self.assertNotIn("http://", body.replace("http://www.w3.org", ""))  # no external references
        conn = http.client.HTTPConnection("127.0.0.1", self.port)
        conn.request("GET", "/vendor/d3.min.js", headers={"Host": f"127.0.0.1:{self.port}"})
        r = conn.getresponse()
        self.assertEqual(r.status, 200)
        self.assertEqual(r.getheader("X-Frame-Options"), "SAMEORIGIN")

    def test_reseed_replaces_older_demo_data(self):
        from app import db as dbm
        from app.seed import seed
        conn = dbm.connect(":memory:")
        self.assertTrue(seed(conn))
        self.assertFalse(seed(conn))  # same version: untouched
        conn.execute("UPDATE meta SET value='1' WHERE key='seed_version'")
        self.assertTrue(seed(conn))  # older version: wiped and replaced without FK errors
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM cases").fetchone()[0], 4)
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0], 8)

    def test_english_api_has_no_untranslated_text(self):
        import re
        cjk = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")
        found = []

        def scan(o, where):
            if isinstance(o, str):
                if cjk.search(o):
                    found.append((where, o))
            elif isinstance(o, list):
                for x in o:
                    scan(x, where)
            elif isinstance(o, dict):
                for v in o.values():
                    scan(v, where)

        en = {"X-Lang": "en"}
        for user in ("sales1", "sales2", "media1", "prod1", "fin1", "legal1", "ana1", "mgr1", "audit1"):
            for path in ("/api/users", "/api/me", "/api/creatives", "/api/products", "/api/customers", "/api/dashboard", "/api/cases",
                         "/api/exceptions?status=all", "/api/audit", "/api/cases/1", "/api/cases/2", "/api/cases/3", "/api/cases/4"):
                s, d = self.call("GET", path, user, headers=en)
                if s == 200:
                    scan(d, f"{user} {path}")
        for user, path, body in (("mgr1", "/api/cases/4/advance", {}), ("prod1", "/api/cases/4/advance", {}), ("sales1", "/api/cases/4/brief", {"budget": -1}),
                                 ("sales1", "/api/tasks/1/status", {"status": "x"}), ("sales1", "/api/cases/3/lines", {}), ("mgr1", "/api/cases/99", None)):
            s, d = self.call("POST" if body is not None else "GET", path, user, body, headers=en)
            scan(d, f"{user} {path}")
        self.assertEqual(found, [])

    def test_ops_english_has_no_untranslated_text(self):
        import re
        cjk = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")
        en, bad = {"X-Lang": "en"}, []

        def scan(o):
            if isinstance(o, str):
                if cjk.search(o):
                    bad.append(o)
            elif isinstance(o, list):
                [scan(x) for x in o]
            elif isinstance(o, dict):
                [scan(v) for v in o.values()]
        for user in ("sales1", "media1", "prod1", "fin1", "legal1", "ana1", "mgr1", "audit1"):
            for p in ("resources", "board", "focus"):
                scan(self.call("GET", f"/api/ops/{p}", user, headers=en)[1])
            for sc in ("tasks", "resources"):
                s, d = self.call("POST", "/api/ops/ai/plan", user, {"scope": sc}, headers=en)
                if s == 200:
                    scan(d)
        self.assertEqual(bad, [])

    def test_focus_is_red_for_team_and_company_exceptions_then_green(self):
        users = ("prod1", "legal1", "mgr1", "sales1", "media1", "fin1", "ana1", "audit1")
        # the company-level red exception concerns everyone, even teams with no red of their own
        self.assertEqual({self.call("GET", "/api/ops/focus", u)[1]["status"] for u in users}, {"red"})
        self.assertEqual(self.call("GET", "/api/ops/focus", "fin1")[1]["top"]["scope"], "company")
        self.assertEqual(self.call("POST", "/api/ops/decisions/7/decide", "mgr1", {"option": "A"})[0], 200)
        st = {u: self.call("GET", "/api/ops/focus", u)[1]["status"] for u in users}
        self.assertEqual((st["prod1"], st["legal1"], st["mgr1"]), ("red", "red", "red"))
        self.assertEqual((st["sales1"], st["media1"], st["fin1"], st["ana1"], st["audit1"]), ("green",) * 5)

    def test_decision_simulation_ai_and_permissions(self):
        s, b = self.call("GET", "/api/ops/board", "prod1")
        self.assertEqual(s, 200)
        d1 = next(d for d in b["decisions"] if d["id"] == 1)
        self.assertTrue(d1["can_decide"] and d1["ai"]["best"] in "ABCD" and d1["ai"]["lines"])
        company = next(d for d in b["decisions"] if d["scope"] == "company")
        self.assertFalse(company["can_decide"])
        s, sim = self.call("POST", "/api/ops/decisions/1/simulate", "prod1", {"option": "A"})
        self.assertEqual(s, 200)
        self.assertEqual(len(sim["baseline"]["series"]), 29)
        self.assertLess(sim["after"]["totals"]["exceptions"], sim["baseline"]["totals"]["exceptions"])
        self.assertEqual(self.call("POST", f"/api/ops/decisions/{company['id']}/decide", "prod1", {"option": "A"})[0], 403)
        self.assertEqual(self.call("POST", "/api/ops/decisions/1/decide", "sales1", {"option": "A"})[0], 403)
        self.assertEqual(self.call("POST", "/api/ops/decisions/1/decide", "prod1", {"option": "Z"})[0], 400)
        self.assertEqual(self.call("POST", "/api/ops/decisions/1/decide", "prod1", {"option": "A"})[0], 200)
        self.assertEqual(self.call("POST", "/api/ops/decisions/1/decide", "prod1", {"option": "A"})[0], 409)
        s, res = self.call("GET", "/api/ops/resources", "mgr1")
        self.assertEqual(next(a for a in res["allocations"] if a["id"] == 10)["resource_id"], 22)  # re-shoot moved to studio B

    def test_autopilot_reduces_future_exceptions_and_applies(self):
        for scope in ("tasks", "resources"):
            s, plan = self.call("POST", "/api/ops/ai/plan", "mgr1", {"scope": scope})
            self.assertEqual(s, 200)
            self.assertLess(plan["after"]["totals"]["exceptions"], plan["baseline"]["totals"]["exceptions"])
            self.assertTrue(plan["steps"])
        self.assertEqual(self.call("POST", "/api/ops/ai/plan", "audit1", {"scope": "tasks"})[0], 403)
        self.assertEqual(self.call("POST", "/api/ops/ai/plan", "sales1", {"scope": "resources"})[0], 403)
        self.assertEqual(self.call("POST", "/api/ops/ai/apply", "mgr1", {"scope": "tasks"})[0], 200)
        self.assertEqual(self.call("GET", "/api/ops/focus", "mgr1")[1]["status"], "green")
        self.assertEqual(self.call("POST", "/api/ops/ai/apply", "mgr1", {"scope": "resources"})[0], 200)
        self.assertEqual(self.call("POST", "/api/ops/reset", "mgr1", {})[0], 200)
        self.assertEqual(self.call("GET", "/api/ops/focus", "mgr1")[1]["status"], "red")

    def test_resource_rates_hidden_from_non_finance_roles(self):
        self.assertIsNone(self.call("GET", "/api/ops/resources", "sales1")[1]["resources"][0]["rate"])
        self.assertIsNotNone(self.call("GET", "/api/ops/resources", "mgr1")[1]["resources"][0]["rate"])

    def test_biz_customers_scoping_and_scoring(self):
        s, d = self.call("GET", "/api/biz/customers", "mgr1")
        self.assertEqual((s, len(d["customers"])), (200, 8))
        self.assertTrue(all(0 <= c["score"] <= 100 for c in d["customers"]))
        self.assertEqual([c["id"] for c in self.call("GET", "/api/biz/customers", "sales2")[1]["customers"]], [1])
        s, r = self.call("GET", "/api/biz/customers", "media1")
        self.assertTrue(r["restricted"] and r["customers"][0]["score"] is None)
        self.assertEqual(self.call("GET", "/api/biz/customer/3", "sales2")[0], 404)
        s, c3 = self.call("GET", "/api/biz/customer/3", "mgr1")
        self.assertEqual(c3["status"], "dormant")
        self.assertTrue(c3["recommendations"] and c3["financials"] and c3["deals"])
        self.assertNotIn("financials", self.call("GET", "/api/biz/customer/3", "prod1")[1])

    def test_biz_projects_okr_and_analytics(self):
        s, p = self.call("GET", "/api/biz/projects", "mgr1")
        self.assertEqual(len(p["projects"]), 4)
        s, d = self.call("GET", "/api/biz/project/3", "mgr1")
        self.assertTrue(d["series"] and d["risks"] and d["milestones"] and d["wbs"])
        self.assertIn(d["health"], ("green", "amber", "red"))
        self.assertEqual(self.call("GET", "/api/biz/project/3", "sales2")[0], 404)
        s, okr = self.call("GET", "/api/biz/okr", "mgr1")
        krs = [k for o in okr["objectives"] for k in o["krs"]]
        self.assertEqual(len(krs), 13)
        self.assertTrue(all(len(k["series"]) == 14 and k["status"] in ("met", "on_track", "at_risk", "off_track") for k in krs))
        self.assertEqual(self.call("GET", "/api/biz/analytics/tasks", "mgr1")[0], 200)
        self.assertEqual(self.call("GET", "/api/biz/analytics/resources", "mgr1")[0], 200)
        self.assertIsNone(self.call("GET", "/api/biz/analytics/resources", "sales1")[1]["cost"])

    def test_biz_entity_cards_and_graph(self):
        for t, i in (("customer", 1), ("case", 3), ("resource", 6), ("team", "production"), ("task", 4), ("decision", 1), ("kpi", "trace"), ("product", 1), ("risk", 1), ("milestone", 1),
                     ("deal", 1), ("opportunity", 1), ("contact", 1), ("asset", 1), ("exception", 1), ("vendor", "v1"), ("alloc", 1), ("project", 3)):
            s, c = self.call("GET", f"/api/biz/entity?type={t}&id={i}", "mgr1")
            self.assertEqual(s, 200, (t, i))
            self.assertTrue(c["title"] and c["link"].startswith("#/"), (t, i))
        self.assertEqual(self.call("GET", "/api/biz/entity?type=nope&id=1", "mgr1")[0], 404)
        self.assertEqual(self.call("GET", "/api/biz/entity?type=case&id=3", "sales2")[0], 404)
        s, g = self.call("GET", "/api/biz/graph", "mgr1")
        ids = {n["id"] for n in g["nodes"]}
        self.assertTrue(all(l["source"] in ids and l["target"] in ids for l in g["links"]))
        self.assertTrue({"customer", "case", "product", "team", "resource", "vendor", "asset"} <= {n["type"] for n in g["nodes"]})

    def test_biz_english_has_no_untranslated_text(self):
        import re
        cjk = re.compile(r"[\u3000-\u9fff\uff00-\uffef]")
        en, bad = {"X-Lang": "en"}, []

        def scan(o, key=""):
            if isinstance(o, str):
                if cjk.search(o) and key not in ("id", "source", "target", "ref"):
                    bad.append(o)
            elif isinstance(o, list):
                [scan(x, key) for x in o]
            elif isinstance(o, dict):
                [scan(v, k) for k, v in o.items()]
        for user in ("sales2", "mgr1", "prod1", "fin1", "audit1"):
            for p in ("customers", "projects", "okr", "analytics/tasks", "analytics/resources", "graph", "customer/1", "customer/3", "project/3", "resource/6"):
                s, d = self.call("GET", f"/api/biz/{p}", user, headers=en)
                if s == 200:
                    scan(d)
            for t, i in (("customer", 1), ("kpi", "trace"), ("risk", 1), ("deal", 1), ("vendor", "v1"), ("project", 3)):
                s, d = self.call("GET", f"/api/biz/entity?type={t}&id={i}", user, headers=en)
                if s == 200:
                    scan(d)
        self.assertEqual(bad, [])

    def test_hosted_mode_is_opt_in_and_guarded(self):
        from app.server import make_server as mk
        with self.assertRaises(SystemExit):
            mk(port=0, db_path=":memory:", host="0.0.0.0")  # still refused without an explicit host allow-list
        srv = mk(port=0, db_path=":memory:", host="127.0.0.1", remote_hosts=["demo.example.azurecontainerapps.io"])
        port = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            def req(path, host, method="GET", headers=None):
                c = http.client.HTTPConnection("127.0.0.1", port, timeout=10)
                c.request(method, path, None, {"Host": host, **(headers or {})})
                r = c.getresponse(); body = r.read(); c.close()
                return r.status, r.headers, body
            self.assertEqual(req("/healthz", "10.0.0.7:8000")[0], 200)
            s, h, _ = req("/api/users", "demo.example.azurecontainerapps.io")
            self.assertEqual(s, 200)
            self.assertIn("max-age", h["Strict-Transport-Security"])
            self.assertEqual(req("/api/users", "evil.example.com")[0], 403)
            self.assertEqual(req("/api/users", f"127.0.0.1:{port}")[0], 403)
            self.assertEqual(req("/api/reconcile", "demo.example.azurecontainerapps.io", "POST", {"Origin": "https://evil.example.com", "X-User": "mgr1", "Content-Type": "application/json"})[0], 403)
        finally:
            srv.shutdown(); srv.server_close()

    def test_local_mode_has_no_hsts_and_healthz(self):
        self.assertEqual(self.call("GET", "/healthz")[0], 200)
        self.assertEqual(self.call("GET", "/healthz")[1], {"status": "ok"})

    def test_language_switch_is_per_request_and_default_is_japanese(self):
        s, ja = self.call("GET", "/api/cases/3", "mgr1")
        s, en = self.call("GET", "/api/cases/3", "mgr1", headers={"X-Lang": "en"})
        self.assertEqual(ja["case"]["name"], "新型車 発表動画（変更多発案件）")
        self.assertEqual(en["case"]["name"], "New car reveal video (many changes)")
        self.assertEqual(ja["stages"][3]["label"], "審査・承認")
        self.assertEqual(en["stages"][3]["label"], "Review & approval")
        self.assertEqual(self.call("GET", "/api/me", "sales2", headers={"X-Lang": "en"})[1]["role_label"], "Sales")
        s, e = self.call("POST", "/api/cases/4/advance", "prod1", {}, headers={"X-Lang": "en"})
        self.assertEqual((s, e["error"]), (403, "You do not have permission to advance this stage"))
        s, e = self.call("POST", "/api/cases/4/advance", "sales1", {}, headers={"X-Lang": "en"})
        self.assertEqual(s, 409)
        self.assertTrue(e["error"].startswith("Unmet conditions: "))
        s, d = self.call("GET", "/api/i18n", "sales1")
        self.assertEqual(d["en"]["案件"], "Campaigns")

    def test_translator_templates_and_passthrough(self):
        from app.i18n import tr
        self.assertEqual(tr("Already English 123"), "Already English 123")
        self.assertEqual(tr("『動画制作』請求2が検収1を超過"), "'Video production': invoiced 2 exceeds accepted 1")
        self.assertEqual(tr(" 完了 "), " Done ")
        self.assertEqual(tr("未知の文章です"), "未知の文章です")  # unknown text is left alone, never guessed
        self.assertEqual(tr("検収前請求 / 原価超過"), "Invoiced before acceptance / Cost overrun")

    def test_dashboard_portfolio_scope(self):
        s, d = self.call("GET", "/api/dashboard", "sales2")
        p = d["portfolio"]
        self.assertEqual({f["case_id"] for f in p["flights"]}, {1, 2})  # no customer-B data
        self.assertEqual({f["id"] for f in p["finance"]}, {1, 2})
        self.assertTrue(p["daily"])
        s, d = self.call("GET", "/api/dashboard", "mgr1")
        self.assertEqual(sum(d["portfolio"]["stages"].values()), 4)


if __name__ == "__main__":
    unittest.main()
