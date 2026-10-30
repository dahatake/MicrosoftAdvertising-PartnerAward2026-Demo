"""SQLite persistence for the local-only case/product lifecycle layer."""
import os
import sqlite3
from contextlib import contextmanager

DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "app.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, brand_group TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_access (
  user_id TEXT NOT NULL REFERENCES users(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  PRIMARY KEY (user_id, customer_id)
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, acceptance_rule TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id),
  name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, owner TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'plan', objective TEXT NOT NULL DEFAULT '',
  target TEXT NOT NULL DEFAULT '', budget REAL NOT NULL DEFAULT 0,
  kpi_name TEXT NOT NULL DEFAULT '', kpi_target REAL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  stage TEXT NOT NULL, dept TEXT NOT NULL, title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo', done_by TEXT, done_at TEXT
);
CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  line_id INTEGER NOT NULL REFERENCES lines(id), channel TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'digital', start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  budget REAL NOT NULL DEFAULT 0, creative_id INTEGER REFERENCES assets(id),
  status TEXT NOT NULL DEFAULT 'planned'
);
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  flight_id INTEGER NOT NULL REFERENCES flights(id), day TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0, spend REAL NOT NULL DEFAULT 0,
  UNIQUE(flight_id, day)
);
CREATE TABLE IF NOT EXISTS lines (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  product_id INTEGER NOT NULL REFERENCES products(id), product_version INTEGER NOT NULL,
  description TEXT NOT NULL, qty REAL NOT NULL, unit_price REAL NOT NULL,
  cost_budget REAL NOT NULL, parent_line_id INTEGER
);
CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  line_id INTEGER REFERENCES lines(id), description TEXT NOT NULL,
  amount_delta REAL NOT NULL DEFAULT 0, cost_delta REAL NOT NULL DEFAULT 0,
  days_delta INTEGER NOT NULL DEFAULT 0, emergency INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft', requested_by TEXT NOT NULL, requested_at TEXT NOT NULL,
  approved_by TEXT, approved_at TEXT, executed_at TEXT, post_approval_due TEXT
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  line_id INTEGER NOT NULL REFERENCES lines(id), vendor TEXT NOT NULL,
  amount REAL NOT NULL, issued_at TEXT NOT NULL, change_id INTEGER REFERENCES changes(id),
  external_ref TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, rights_expiry TEXT,
  approved INTEGER NOT NULL DEFAULT 0, used_at TEXT,
  kind TEXT NOT NULL DEFAULT 'other', sample_key TEXT
);
CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id),
  qty REAL NOT NULL, delivered_at TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '',
  external_ref TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS acceptances (
  id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id),
  qty REAL NOT NULL, accepted_at TEXT NOT NULL, accepted_by TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '', external_ref TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES lines(id),
  qty REAL NOT NULL, amount REAL NOT NULL, invoiced_at TEXT NOT NULL,
  external_ref TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL, paid_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exceptions (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id),
  line_id INTEGER, kind TEXT NOT NULL, severity TEXT NOT NULL, detail TEXT NOT NULL,
  owner TEXT NOT NULL, due TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL, resolved_at TEXT, resolution TEXT,
  fingerprint TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_exc_open ON exceptions(fingerprint) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, ts TEXT NOT NULL, user_id TEXT NOT NULL, action TEXT NOT NULL,
  entity TEXT NOT NULL, entity_id TEXT, detail TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, team TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '', capacity REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0, gender TEXT NOT NULL DEFAULT '', age INTEGER, note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS team_work (
  id INTEGER PRIMARY KEY, team TEXT NOT NULL, case_id INTEGER REFERENCES cases(id), title TEXT NOT NULL,
  start_day TEXT NOT NULL, end_day TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'todo',
  progress INTEGER NOT NULL DEFAULT 0, depends_on INTEGER
);
CREATE TABLE IF NOT EXISTS allocations (
  id INTEGER PRIMARY KEY, resource_id INTEGER NOT NULL REFERENCES resources(id),
  case_id INTEGER REFERENCES cases(id), tw_id INTEGER REFERENCES team_work(id), work TEXT NOT NULL,
  start_day TEXT NOT NULL, end_day TEXT NOT NULL, due_day TEXT NOT NULL, load REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY, scope TEXT NOT NULL, team TEXT, case_id INTEGER REFERENCES cases(id),
  title TEXT NOT NULL, detail TEXT NOT NULL, severity TEXT NOT NULL, due_day TEXT NOT NULL,
  options TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', chosen INTEGER,
  decided_by TEXT, decided_at TEXT, decided_via TEXT
);
CREATE TABLE IF NOT EXISTS customer_profiles (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id), industry TEXT NOT NULL, hq TEXT NOT NULL, employees INTEGER NOT NULL,
  status TEXT NOT NULL, credit_grade TEXT NOT NULL, credit_score INTEGER NOT NULL, payment_terms INTEGER NOT NULL, pay_delay INTEGER NOT NULL,
  our_share REAL NOT NULL, since INTEGER, note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS financials (
  customer_id INTEGER NOT NULL REFERENCES customers(id), fy INTEGER NOT NULL, revenue REAL NOT NULL, op_profit REAL NOT NULL, ad_spend REAL NOT NULL,
  PRIMARY KEY (customer_id, fy)
);
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), year INTEGER NOT NULL, title TEXT NOT NULL, media TEXT NOT NULL,
  amount REAL NOT NULL, margin REAL NOT NULL, outcome TEXT NOT NULL, competitor TEXT NOT NULL DEFAULT '', satisfaction INTEGER
);
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), title TEXT NOT NULL, stage TEXT NOT NULL, amount REAL NOT NULL,
  probability INTEGER NOT NULL, close_day TEXT NOT NULL, competitor TEXT NOT NULL DEFAULT '', next_step TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), name TEXT NOT NULL, role TEXT NOT NULL, decision_role TEXT NOT NULL,
  gender TEXT NOT NULL, age INTEGER NOT NULL, last_contact TEXT NOT NULL, sentiment INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS risks (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), title TEXT NOT NULL, probability INTEGER NOT NULL, impact INTEGER NOT NULL,
  team TEXT NOT NULL, mitigation TEXT NOT NULL, status TEXT NOT NULL, due_day TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), name TEXT NOT NULL, day TEXT NOT NULL, status TEXT NOT NULL, stage TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kpi_series (kpi TEXT NOT NULL, wk INTEGER NOT NULL, value REAL NOT NULL, PRIMARY KEY (kpi, wk));
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


MIGRATIONS = {
    "cases": [("stage", "TEXT NOT NULL DEFAULT 'plan'"), ("objective", "TEXT NOT NULL DEFAULT ''"),
              ("target", "TEXT NOT NULL DEFAULT ''"), ("budget", "REAL NOT NULL DEFAULT 0"),
              ("kpi_name", "TEXT NOT NULL DEFAULT ''"), ("kpi_target", "REAL")],
    "assets": [("kind", "TEXT NOT NULL DEFAULT 'other'"), ("sample_key", "TEXT")],
}


def _migrate(conn):
    """Adds columns introduced after the first release to databases created earlier."""
    for table, cols in MIGRATIONS.items():
        have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        for name, ddl in cols:
            if name not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")


def connect(path=None):
    path = path or os.environ.get("APP_DB", DEFAULT_DB)
    if path != ":memory:":
        os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    _migrate(conn)
    return conn


@contextmanager
def tx(conn):
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params).fetchall()]


def row(conn, sql, params=()):
    r = conn.execute(sql, params).fetchone()
    return dict(r) if r else None
