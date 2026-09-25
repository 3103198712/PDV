"""PDV Pro Iteration 3 backend tests: Printers, KDS, Bill-Split, ESC/POS."""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://sales-hub-774.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_auth():
    return {"Authorization": f"Bearer {_login('admin@pdvpro.com', 'admin123')}"}


@pytest.fixture(scope="module")
def op_auth():
    return {"Authorization": f"Bearer {_login('operador@pdvpro.com', 'operador123')}"}


# =========================================================
# Printer CRUD + role guard
# =========================================================
@pytest.fixture(scope="module")
def created_printer_id(admin_auth):
    """Create a printer for cozinha_quente used across tests."""
    payload = {
        "name": "TEST_Printer_CQ",
        "sector": "cozinha_quente",
        "ip": "192.168.99.201",
        "port": 9100,
        "active": True,
    }
    r = requests.post(f"{API}/printers", headers=admin_auth, json=payload)
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    yield pid
    # cleanup
    requests.delete(f"{API}/printers/{pid}", headers=admin_auth)


def test_printer_operador_forbidden(op_auth):
    payload = {"name": "TEST_Op", "sector": "bar", "ip": "10.0.0.1", "port": 9100, "active": True}
    r = requests.post(f"{API}/printers", headers=op_auth, json=payload)
    assert r.status_code == 403


def test_printer_list_and_get(admin_auth, created_printer_id):
    r = requests.get(f"{API}/printers", headers=admin_auth)
    assert r.status_code == 200
    printers = r.json()
    assert any(p["id"] == created_printer_id for p in printers)
    found = next(p for p in printers if p["id"] == created_printer_id)
    assert found["sector"] == "cozinha_quente"
    assert found["ip"] == "192.168.99.201"
    assert found["active"] is True


def test_printer_update(admin_auth, created_printer_id):
    payload = {"name": "TEST_Printer_CQ2", "sector": "cozinha_quente",
               "ip": "192.168.99.202", "port": 9100, "active": True}
    r = requests.put(f"{API}/printers/{created_printer_id}", headers=admin_auth, json=payload)
    assert r.status_code == 200
    assert r.json()["name"] == "TEST_Printer_CQ2"
    # revert name
    payload["name"] = "TEST_Printer_CQ"
    payload["ip"] = "192.168.99.201"
    requests.put(f"{API}/printers/{created_printer_id}", headers=admin_auth, json=payload)


# =========================================================
# Full flow: create order Mesa, add hot-kitchen item,
# mark-printed => job enqueued, KDS shows, then close-split.
# =========================================================
@pytest.fixture(scope="module")
def flow_ctx(admin_auth, created_printer_id):
    """Set up a fresh mesa order with 2 cozinha_quente items."""
    # find a free table
    tables = requests.get(f"{API}/tables", headers=admin_auth).json()
    free = next(t for t in tables if t["status"] == "livre")
    table_id = free["id"]
    table_number = free["number"]

    # find a cozinha_quente product with stock
    prods = requests.get(f"{API}/products", headers=admin_auth).json()
    cq_prod = next(p for p in prods if p["sector"] == "cozinha_quente" and p["stock"] >= 5)

    # create order
    r = requests.post(f"{API}/orders", headers=admin_auth,
                      json={"channel": "mesa", "table_id": table_id})
    assert r.status_code == 200, r.text
    order_id = r.json()["id"]

    # add 2 items
    r2 = requests.post(f"{API}/orders/{order_id}/items", headers=admin_auth,
                       json={"items": [{"product_id": cq_prod["id"], "quantity": 2}]})
    assert r2.status_code == 200

    ctx = {"order_id": order_id, "table_id": table_id,
           "table_number": table_number, "product": cq_prod}
    return ctx


def test_mark_printed_creates_print_job(admin_auth, flow_ctx, created_printer_id):
    order_id = flow_ctx["order_id"]

    # snapshot jobs before
    before = requests.get(f"{API}/print/jobs", headers=admin_auth).json()
    before_ids = {j["id"] for j in before}

    r = requests.post(f"{API}/orders/{order_id}/mark-printed", headers=admin_auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["jobs_enqueued"] >= 1

    # confirm items are printed=True and status=preparando
    order = requests.get(f"{API}/orders/{order_id}", headers=admin_auth).json()
    assert all(i["printed"] is True and i["status"] == "preparando" for i in order["items"])

    # locate new job
    jobs = requests.get(f"{API}/print/jobs", headers=admin_auth).json()
    new_jobs = [j for j in jobs if j["id"] not in before_ids and j["order_id"] == order_id]
    assert len(new_jobs) >= 1
    j = new_jobs[0]
    assert j["sector"] == "cozinha_quente"
    assert j["printer_id"] == created_printer_id
    assert j["status"] == "pending"

    # queue endpoint returns it
    queue = requests.get(f"{API}/print/queue", headers=admin_auth).json()
    q_ids = {jj["id"] for jj in queue}
    assert j["id"] in q_ids
    # payload should contain ESC/POS content
    full_job = next(jj for jj in queue if jj["id"] == j["id"])
    payload = full_job["payload"]
    assert "\x1b" in payload and "\x1d" in payload  # ESC and GS
    assert "COZINHA QUENTE" in payload
    assert f"MESA {flow_ctx['table_number']}" in payload
    assert flow_ctx["product"]["name"] in payload

    flow_ctx["job_id"] = j["id"]


def test_print_queue_done(admin_auth, flow_ctx):
    job_id = flow_ctx["job_id"]
    r = requests.post(f"{API}/print/queue/{job_id}/done", headers=admin_auth)
    assert r.status_code == 200
    queue = requests.get(f"{API}/print/queue", headers=admin_auth).json()
    assert not any(j["id"] == job_id for j in queue)


def test_print_queue_fail_increments(admin_auth, created_printer_id):
    """Create a separate order, mark-printed, then fail the job."""
    # Setup fresh order
    tables = requests.get(f"{API}/tables", headers=admin_auth).json()
    free = next(t for t in tables if t["status"] == "livre")
    prods = requests.get(f"{API}/products", headers=admin_auth).json()
    cq = next(p for p in prods if p["sector"] == "cozinha_quente" and p["stock"] >= 2)

    r = requests.post(f"{API}/orders", headers=admin_auth,
                      json={"channel": "mesa", "table_id": free["id"]})
    oid = r.json()["id"]
    requests.post(f"{API}/orders/{oid}/items", headers=admin_auth,
                  json={"items": [{"product_id": cq["id"], "quantity": 1}]})
    requests.post(f"{API}/orders/{oid}/mark-printed", headers=admin_auth)
    queue = requests.get(f"{API}/print/queue", headers=admin_auth).json()
    my_job = next(j for j in queue if j["order_id"] == oid)

    # fail twice
    r1 = requests.post(f"{API}/print/queue/{my_job['id']}/fail",
                       headers=admin_auth, json={"error": "conn refused"})
    assert r1.status_code == 200
    requests.post(f"{API}/print/queue/{my_job['id']}/fail",
                  headers=admin_auth, json={"error": "conn refused"})

    jobs = requests.get(f"{API}/print/jobs", headers=admin_auth).json()
    j = next(jj for jj in jobs if jj["id"] == my_job["id"])
    assert j["attempts"] == 2
    assert j["error"] == "conn refused"

    # cleanup: cancel this order to free table
    requests.post(f"{API}/orders/{oid}/cancel", headers=admin_auth)


def test_mark_printed_without_printer_still_marks(admin_auth):
    """A sector without any active printer should still mark items but not enqueue."""
    # find a bar or cozinha_fria product; ensure no active printer for that sector
    printers = requests.get(f"{API}/printers", headers=admin_auth).json()
    active_sectors = {p["sector"] for p in printers if p["active"]}
    target_sector = None
    for s in ("cozinha_fria", "bar"):
        if s not in active_sectors:
            target_sector = s
            break
    if target_sector is None:
        pytest.skip("All sectors have printers already; cannot test no-printer path")

    prods = requests.get(f"{API}/products", headers=admin_auth).json()
    prod = next((p for p in prods if p["sector"] == target_sector and p["stock"] >= 2), None)
    if not prod:
        pytest.skip("No product in target sector")

    tables = requests.get(f"{API}/tables", headers=admin_auth).json()
    free = next(t for t in tables if t["status"] == "livre")
    r = requests.post(f"{API}/orders", headers=admin_auth,
                      json={"channel": "mesa", "table_id": free["id"]})
    oid = r.json()["id"]
    requests.post(f"{API}/orders/{oid}/items", headers=admin_auth,
                  json={"items": [{"product_id": prod["id"], "quantity": 1}]})

    before_jobs = requests.get(f"{API}/print/jobs", headers=admin_auth).json()
    before_ids = {j["id"] for j in before_jobs}

    r_mp = requests.post(f"{API}/orders/{oid}/mark-printed", headers=admin_auth)
    assert r_mp.status_code == 200
    assert r_mp.json()["jobs_enqueued"] == 0

    order = requests.get(f"{API}/orders/{oid}", headers=admin_auth).json()
    assert all(i["printed"] is True and i["status"] == "preparando" for i in order["items"])

    jobs_after = requests.get(f"{API}/print/jobs", headers=admin_auth).json()
    new_for_order = [j for j in jobs_after if j["id"] not in before_ids and j["order_id"] == oid]
    assert len(new_for_order) == 0

    # cleanup
    requests.post(f"{API}/orders/{oid}/cancel", headers=admin_auth)


# =========================================================
# KDS
# =========================================================
def test_kds_invalid_sector(admin_auth):
    r = requests.get(f"{API}/kds/xxx", headers=admin_auth)
    assert r.status_code == 400


def test_kds_shows_ticket_and_status_update(admin_auth, flow_ctx):
    order_id = flow_ctx["order_id"]
    r = requests.get(f"{API}/kds/cozinha_quente", headers=admin_auth)
    assert r.status_code == 200
    tickets = r.json()
    mine = [t for t in tickets if t["order_id"] == order_id]
    assert len(mine) >= 1
    t0 = mine[0]
    for k in ("order_code", "quantity", "product_name", "elapsed_seconds", "status"):
        assert k in t0
    assert t0["elapsed_seconds"] >= 0

    # mark first item as pronto
    item_id = t0["item_id"]
    r2 = requests.post(f"{API}/kds/orders/{order_id}/items/{item_id}/status",
                       headers=admin_auth, json={"status": "pronto"})
    assert r2.status_code == 200

    tickets2 = requests.get(f"{API}/kds/cozinha_quente", headers=admin_auth).json()
    updated = next(t for t in tickets2 if t["item_id"] == item_id)
    assert updated["status"] == "pronto"


# =========================================================
# Close split
# =========================================================
def test_close_split_invalid_ranges(admin_auth, flow_ctx):
    oid = flow_ctx["order_id"]
    r0 = requests.post(f"{API}/orders/{oid}/close-split", headers=admin_auth,
                       json={"payment_method": "pix", "splits": 0})
    assert r0.status_code == 400
    r21 = requests.post(f"{API}/orders/{oid}/close-split", headers=admin_auth,
                        json={"payment_method": "pix", "splits": 21})
    assert r21.status_code == 400


def test_close_split_5(admin_auth, flow_ctx):
    """Close the previously-set-up mesa order with splits=5."""
    oid = flow_ctx["order_id"]
    table_id = flow_ctx["table_id"]

    # get current order total to compare
    order = requests.get(f"{API}/orders/{oid}", headers=admin_auth).json()
    subtotal = order["subtotal"]

    r = requests.post(f"{API}/orders/{oid}/close-split", headers=admin_auth,
                      json={"payment_method": "pix", "service_fee_percent": 10, "splits": 5})
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["sale_ids"]) == 5
    expected_total = round(subtotal * 1.10, 2)
    assert body["total"] == pytest.approx(expected_total, abs=0.05)

    # verify each sale exists with code V{ts}-{i}
    codes = []
    total_sum = 0.0
    for sid in body["sale_ids"]:
        s = requests.get(f"{API}/sales/{sid}", headers=admin_auth).json()
        codes.append(s["code"])
        total_sum += s["total"]
        assert s["channel"] == "mesa"
    assert total_sum == pytest.approx(body["total"], abs=0.05)
    # ensure V{ts}-1..5 present
    suffixes = sorted(int(c.split("-")[-1]) for c in codes)
    assert suffixes == [1, 2, 3, 4, 5]
    prefixes = {c.rsplit("-", 1)[0] for c in codes}
    assert len(prefixes) == 1
    assert prefixes.pop().startswith("V")

    # order should be fechada with sale_ids populated
    o2 = requests.get(f"{API}/orders/{oid}", headers=admin_auth).json()
    assert o2["status"] == "fechada"
    assert set(o2.get("sale_ids", [])) == set(body["sale_ids"])

    # table freed
    tables = requests.get(f"{API}/tables", headers=admin_auth).json()
    t = next(tt for tt in tables if tt["id"] == table_id)
    assert t["status"] == "livre"


# =========================================================
# PWA assets served
# =========================================================
def test_manifest_and_service_worker():
    m = requests.get(f"{BASE_URL}/manifest.json")
    assert m.status_code == 200
    data = m.json()
    assert "name" in data or "short_name" in data

    sw = requests.get(f"{BASE_URL}/service-worker.js")
    assert sw.status_code == 200
    assert "self" in sw.text or "addEventListener" in sw.text
