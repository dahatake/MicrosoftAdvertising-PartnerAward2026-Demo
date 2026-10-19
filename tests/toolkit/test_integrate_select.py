"""Unit checks for integrate.py select_cases: which System Test cases run at `integrate.py merge`."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "integrate.py"
SPEC = importlib.util.spec_from_file_location("integrate_under_test", SCRIPT)
assert SPEC and SPEC.loader
integrate = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = integrate
SPEC.loader.exec_module(integrate)


def case(cid, reqs, acs=None, canary=False, status="pass"):
    x = {"id": cid, "requirement_ids": reqs, "command": f"echo {cid}", "canary": canary, "status": status}
    if acs is not None:
        x["ac_ids"] = acs
    return x


@pytest.fixture
def run_select(monkeypatch):
    def _run(cases, items, item_id):
        data = {"cases": cases}
        fake_ledger = SimpleNamespace(select_cases=lambda root, cfg, d, mode, base, retry_failed=False:
                                      [x for x in d["cases"] if not x.get("canary")])
        monkeypatch.setattr(integrate.h, "load_script", lambda name: fake_ledger)
        monkeypatch.setattr(integrate.h, "load_ledger", lambda root, cfg: data)
        q = {"items": items}
        it = next(x for x in items if x["id"] == item_id)
        ctx = SimpleNamespace(root=Path("."), cfg={})
        return [x["id"] for x in integrate.select_cases(ctx, q, it, "base")]
    return _run


ITEMS = [
    {"id": "brand-foundation", "status": "doing", "requirement_ids": ["NFR-UX-004"], "ac_ids": ["AC-089", "AC-090"]},
    {"id": "app1-hero-cards", "status": "todo", "requirement_ids": ["NFR-UX-004"], "ac_ids": ["AC-091"]},
    {"id": "shell-wordmark", "status": "todo", "requirement_ids": ["NFR-UX-004"], "ac_ids": ["AC-116"]},
    {"id": "earlier", "status": "done", "requirement_ids": ["FR-001"], "ac_ids": ["AC-001"]},
]


def test_selects_cases_of_this_item_and_integrated_items(run_select):
    cases = [case("E2E-001", ["NFR-UX-004"], ["AC-089"]), case("E2E-002", ["FR-001"], ["AC-001"])]
    assert run_select(cases, ITEMS, "brand-foundation") == ["E2E-001", "E2E-002"]


def test_drops_cases_of_later_items_split_by_ac_of_same_requirement(run_select):
    cases = [case("E2E-061", ["NFR-UX-004"], ["AC-091", "AC-116"]), case("E2E-062", ["NFR-UX-004"], ["AC-090", "AC-091"]),
             case("E2E-001", ["NFR-UX-004"], ["AC-089"]), case("E2E-003", ["FR-999"], ["AC-500"])]
    assert run_select(cases, ITEMS, "brand-foundation") == ["E2E-001"]


def test_canary_is_always_included(run_select):
    cases = [case("E2E-099", ["NFR-UX-004"], ["AC-116"], canary=True), case("E2E-098", ["FR-999"], canary=True),
             case("E2E-097", ["FR-001"], canary=True, status="blocked")]
    assert run_select(cases, ITEMS, "brand-foundation") == ["E2E-099", "E2E-098"]


def test_falls_back_to_requirement_ids_without_ac_ids(run_select):
    items = [{"id": "a", "status": "doing", "requirement_ids": ["FR-010"]},
             {"id": "b", "status": "todo", "requirement_ids": ["FR-010"]}]
    cases = [case("E2E-010", ["FR-010"]), case("E2E-011", ["FR-010"], ["AC-200"]), case("E2E-012", ["FR-011"])]
    assert run_select(cases, items, "a") == ["E2E-010", "E2E-011"]
