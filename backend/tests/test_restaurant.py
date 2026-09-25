"""PDV Pro Restaurant backend tests - iteration 2."""
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
def admin_token():
    return _login("admin@pdvpro.com", "admin123")


@pytest.fixture(scope="module")
def operador_token():
    return _login("operador@pdvpro.com", "operador123")


@pytest.fixture(scope="module")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def op_auth(operador_token):
    return {"Authorization": f"Bearer {operador_token}"}


# ------------- Tables -------------
def test_tables_30(auth):
    r = requests.get(f"{API}/tables", headers=auth)
    assert r.status_code == 200
    tables = r.json()
    assert len(tables) == 30
    numbers = sorted(t["number"] for t in tables)
    assert numbers == list(range(1, 31))
    assert all(t["status"] in ("livre", "ocupada", "reservada") for t in tables)


# ------------- Products with sector -------------
def test_products_sector(auth):
    r = requests.get(f"{API}/products", headers=auth)
    assert r.status_code == 200
    prods = r.json()
    assert len(prods) >= 30
    seed_sectors = {"cozinha_quente", "cozinha_fria", "bar", "buffet"}
    for p in prods:
        assert "sector" in p
        assert p["sector"] in seed_sectors


# ------------- Orders: mesa -------------
def test_order_mesa_flow(auth):
    # Get a free table
    tables = requests.get(f"{API}/tables", headers=auth).json()
    free = next((t for t in tables if t["status"] == "livre"), None)
    assert free, "No free tables"
    table_id = free["id"]

    # Create order for mesa
    r = requests.post(f"{API}/orders", headers=auth, json={"channel": "mesa", "table_id": table_id})
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["channel"] == "mesa"
    assert order["status"] == "aberta"
    order_id = order["id"]

    # Duplicate mesa should 400
    r2 = requests.post(f"{API}/orders", headers=auth, json={"channel": "mesa", "table_id": table_id})
    assert r2.status_code == 400

    # Table should be ocupada
    tables2 = requests.get(f"{API}/tables", headers=auth).json()
    t2 = next(t for t in tables2 if t["id"] == table_id)
    assert t2["status"] == "ocupada"

    # Add items - pick a non-buffet product
    prods = requests.get(f"{API}/products", headers=auth).json()
    prod = next(p for p in prods if p["sector"] != "buffet" and p["stock"] > 5)
    r3 = requests.post(f"{API}/orders/{order_id}/items", headers=auth,
                      json={"items": [{"product_id": prod["id"], "quantity": 2}]})
    assert r3.status_code == 200
    updated = r3.json()
    assert len(updated["items"]) == 1
    it = updated["items"][0]
    assert it["sector"] == prod["sector"]
    assert it["printed"] is False
    assert it["status"] == "pendente"
    assert updated["subtotal"] == pytest.approx(prod["sale_price"] * 2)

    # Mark printed
    r4 = requests.post(f"{API}/orders/{order_id}/mark-printed", headers=auth)
    assert r4.status_code == 200
    order2 = requests.get(f"{API}/orders/{order_id}", headers=auth).json()
    assert all(i["printed"] is True and i["status"] == "preparando" for i in order2["items"])

    # Filter open orders
    open_orders = requests.get(f"{API}/orders?status=aberta", headers=auth).json()
    assert any(o["id"] == order_id for o in open_orders)

    # Get stock before close
    stock_before = next(p for p in requests.get(f"{API}/products", headers=auth).json() if p["id"] == prod["id"])["stock"]

    # Close order
    r5 = requests.post(f"{API}/orders/{order_id}/close", headers=auth,
                      json={"payment_method": "pix", "service_fee_percent": 10, "discount": 0})
    assert r5.status_code == 200, r5.text
    close = r5.json()
    assert "sale_id" in close and "total" in close and "service_fee" in close
    expected_fee = round(prod["sale_price"] * 2 * 0.10, 2)
    assert close["service_fee"] == pytest.approx(expected_fee)
    assert close["total"] == pytest.approx(prod["sale_price"] * 2 + expected_fee)

    # Table should be free again
    tables3 = requests.get(f"{API}/tables", headers=auth).json()
    t3 = next(t for t in tables3 if t["id"] == table_id)
    assert t3["status"] == "livre"

    # Stock decremented (non-buffet)
    stock_after = next(p for p in requests.get(f"{API}/products", headers=auth).json() if p["id"] == prod["id"])["stock"]
    assert stock_after == stock_before - 2

    # Sale exists with channel
    sale = requests.get(f"{API}/sales/{close['sale_id']}", headers=auth).json()
    assert sale["channel"] == "mesa"

    # Sales list contains it
    sales = requests.get(f"{API}/sales", headers=auth).json()
    assert any(s["id"] == close["sale_id"] and s.get("channel") == "mesa" for s in sales)


# ------------- Orders: hotel -------------
def test_order_hotel(auth):
    # missing hotel_room => 400
    r_bad = requests.post(f"{API}/orders", headers=auth, json={"channel": "hotel"})
    assert r_bad.status_code == 400

    r = requests.post(f"{API}/orders", headers=auth,
                     json={"channel": "hotel", "hotel_room": "101", "hotel_guest": "Fulano"})
    assert r.status_code == 200
    o = r.json()
    assert o["channel"] == "hotel" and o["hotel_room"] == "101"


# ------------- Orders: ifood -------------
def test_order_ifood(auth):
    r = requests.post(f"{API}/orders", headers=auth,
                     json={"channel": "ifood", "ifood_number": "IF-9001"})
    assert r.status_code == 200
    o = r.json()
    assert o["channel"] == "ifood" and o["ifood_number"] == "IF-9001"


# ------------- Orders: buffet - no stock decrement -------------
def test_order_buffet_close_no_stock_decrement(auth):
    prods = requests.get(f"{API}/products", headers=auth).json()
    buf = next(p for p in prods if p["sector"] == "buffet")
    r = requests.post(f"{API}/orders", headers=auth,
                     json={"channel": "buffet", "event_name": "Casamento Teste"})
    assert r.status_code == 200
    order_id = r.json()["id"]
    requests.post(f"{API}/orders/{order_id}/items", headers=auth,
                  json={"items": [{"product_id": buf["id"], "quantity": 10}]})
    stock_before = next(p for p in requests.get(f"{API}/products", headers=auth).json() if p["id"] == buf["id"])["stock"]
    r_close = requests.post(f"{API}/orders/{order_id}/close", headers=auth,
                           json={"payment_method": "credito", "service_fee_percent": 10})
    assert r_close.status_code == 200
    stock_after = next(p for p in requests.get(f"{API}/products", headers=auth).json() if p["id"] == buf["id"])["stock"]
    assert stock_after == stock_before  # buffet unchanged
    sale = requests.get(f"{API}/sales/{r_close.json()['sale_id']}", headers=auth).json()
    assert sale["channel"] == "buffet"


# ------------- Cancel order role check -------------
def test_cancel_order_role(auth, op_auth):
    tables = requests.get(f"{API}/tables", headers=auth).json()
    free = next(t for t in tables if t["status"] == "livre")
    r = requests.post(f"{API}/orders", headers=auth, json={"channel": "mesa", "table_id": free["id"]})
    order_id = r.json()["id"]

    # Operador cannot cancel
    r_bad = requests.post(f"{API}/orders/{order_id}/cancel", headers=op_auth)
    assert r_bad.status_code == 403

    # Admin can cancel
    r_ok = requests.post(f"{API}/orders/{order_id}/cancel", headers=auth)
    assert r_ok.status_code == 200

    # Table freed
    tables2 = requests.get(f"{API}/tables", headers=auth).json()
    t2 = next(t for t in tables2 if t["id"] == free["id"])
    assert t2["status"] == "livre"


# ------------- Reports still work -------------
def test_reports_dashboard(auth):
    r = requests.get(f"{API}/reports/dashboard", headers=auth)
    assert r.status_code == 200
    d = r.json()
    for k in ["faturamento_hoje", "faturamento_mes", "vendas_hoje", "ticket_medio", "sales_last_7_days"]:
        assert k in d
