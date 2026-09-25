from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import random
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ============================================================
# Setup
# ============================================================
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

Role = Literal["admin", "gerente", "operador"]

app = FastAPI(title="PDV Pro API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("pdvpro")


# ============================================================
# Utils
# ============================================================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(hours=8),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Acesso negado para este papel")
        return user
    return checker


# ============================================================
# Models
# ============================================================
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    name: str
    role: Role
    created_at: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Role = "operador"


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ProductIn(BaseModel):
    name: str
    barcode: Optional[str] = None
    category: str = "Geral"
    sector: Literal["cozinha_quente", "cozinha_fria", "bar", "buffet"] = "cozinha_quente"
    cost_price: float = 0
    sale_price: float
    stock: int = 0
    min_stock: int = 5
    active: bool = True


class Product(ProductIn):
    id: str
    created_at: str


class CustomerIn(BaseModel):
    name: str
    document: Optional[str] = None  # CPF/CNPJ
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class Customer(CustomerIn):
    id: str
    created_at: str


class SaleItemIn(BaseModel):
    product_id: str
    quantity: int
    unit_price: float


class SaleIn(BaseModel):
    customer_id: Optional[str] = None
    items: List[SaleItemIn]
    payment_method: Literal["dinheiro", "pix", "credito", "debito"]
    discount: float = 0


class StockMovementIn(BaseModel):
    product_id: str
    type: Literal["entrada", "saida", "ajuste"]
    quantity: int
    reason: Optional[str] = None


# ============================================================
# AUTH
# ============================================================
@api.post("/auth/register", response_model=TokenOut)
async def register(payload: RegisterIn, user: dict = Depends(require_roles("admin"))):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    token = create_access_token(uid, email, payload.role)
    doc.pop("password_hash")
    doc.pop("_id", None)
    return {"access_token": token, "token_type": "bearer", "user": doc}


@api.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token = create_access_token(user["id"], user["email"], user["role"])
    user.pop("password_hash")
    user.pop("_id", None)
    return {"access_token": token, "token_type": "bearer", "user": user}


@api.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return user


@api.get("/users", response_model=List[UserPublic])
async def list_users(user: dict = Depends(require_roles("admin", "gerente"))):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return docs


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_roles("admin"))):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Não é possível excluir a si mesmo")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"success": True}


# ============================================================
# PRODUCTS
# ============================================================
@api.get("/products", response_model=List[Product])
async def list_products(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
            {"category": {"$regex": q, "$options": "i"}},
        ]}
    docs = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return docs


@api.post("/products", response_model=Product)
async def create_product(payload: ProductIn, user: dict = Depends(require_roles("admin", "gerente"))):
    pid = str(uuid.uuid4())
    doc = {"id": pid, "created_at": iso(now_utc()), **payload.model_dump()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, payload: ProductIn, user: dict = Depends(require_roles("admin", "gerente"))):
    result = await db.products.find_one_and_update(
        {"id": product_id},
        {"$set": payload.model_dump()},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    result.pop("_id", None)
    return result


@api.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(require_roles("admin", "gerente"))):
    r = await db.products.delete_one({"id": product_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return {"success": True}


# ============================================================
# CUSTOMERS
# ============================================================
@api.get("/customers", response_model=List[Customer])
async def list_customers(q: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"document": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
        ]}
    docs = await db.customers.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return docs


@api.post("/customers", response_model=Customer)
async def create_customer(payload: CustomerIn, user: dict = Depends(get_current_user)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, "created_at": iso(now_utc()), **payload.model_dump()}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/customers/{customer_id}", response_model=Customer)
async def update_customer(customer_id: str, payload: CustomerIn, user: dict = Depends(require_roles("admin", "gerente"))):
    result = await db.customers.find_one_and_update({"id": customer_id}, {"$set": payload.model_dump()}, return_document=True)
    if not result:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    result.pop("_id", None)
    return result


@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, user: dict = Depends(require_roles("admin", "gerente"))):
    r = await db.customers.delete_one({"id": customer_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"success": True}


# ============================================================
# SALES
# ============================================================
@api.get("/sales")
async def list_sales(limit: int = 100, user: dict = Depends(get_current_user)):
    docs = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.get("/sales/{sale_id}")
async def get_sale(sale_id: str, user: dict = Depends(get_current_user)):
    doc = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return doc


@api.post("/sales")
async def create_sale(payload: SaleIn, user: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Venda precisa de pelo menos um item")

    enriched_items = []
    subtotal = 0.0
    for it in payload.items:
        product = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Produto {it.product_id} não encontrado")
        if product["stock"] < it.quantity:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {product['name']}")
        line_total = it.unit_price * it.quantity
        subtotal += line_total
        enriched_items.append({
            "product_id": it.product_id,
            "product_name": product["name"],
            "quantity": it.quantity,
            "unit_price": it.unit_price,
            "line_total": line_total,
        })

    total = max(0.0, subtotal - payload.discount)
    sid = str(uuid.uuid4())
    customer = None
    if payload.customer_id:
        customer = await db.customers.find_one({"id": payload.customer_id}, {"_id": 0})

    sale_doc = {
        "id": sid,
        "code": f"V{int(now_utc().timestamp())}",
        "customer_id": payload.customer_id,
        "customer_name": customer["name"] if customer else "Consumidor",
        "operator_id": user["id"],
        "operator_name": user["name"],
        "items": enriched_items,
        "subtotal": subtotal,
        "discount": payload.discount,
        "total": total,
        "payment_method": payload.payment_method,
        "status": "concluida",
        "created_at": iso(now_utc()),
    }
    await db.sales.insert_one(sale_doc)

    # Update stock and record movements
    for it in enriched_items:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": it["product_id"],
            "product_name": it["product_name"],
            "type": "saida",
            "quantity": it["quantity"],
            "reason": f"Venda {sale_doc['code']}",
            "created_at": iso(now_utc()),
            "created_by": user["name"],
        })

    sale_doc.pop("_id", None)
    return sale_doc


@api.post("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: str, user: dict = Depends(require_roles("admin", "gerente"))):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    if sale["status"] == "cancelada":
        raise HTTPException(status_code=400, detail="Venda já cancelada")
    for it in sale["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": it["quantity"]}})
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": it["product_id"],
            "product_name": it["product_name"],
            "type": "entrada",
            "quantity": it["quantity"],
            "reason": f"Estorno venda {sale['code']}",
            "created_at": iso(now_utc()),
            "created_by": user["name"],
        })
    await db.sales.update_one({"id": sale_id}, {"$set": {"status": "cancelada"}})
    return {"success": True}


# ============================================================
# STOCK
# ============================================================
@api.get("/stock/movements")
async def list_movements(limit: int = 200, user: dict = Depends(get_current_user)):
    docs = await db.stock_movements.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return docs


@api.post("/stock/movements")
async def create_movement(payload: StockMovementIn, user: dict = Depends(require_roles("admin", "gerente"))):
    product = await db.products.find_one({"id": payload.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    if payload.type == "entrada":
        delta = payload.quantity
    elif payload.type == "saida":
        delta = -payload.quantity
        if product["stock"] < payload.quantity:
            raise HTTPException(status_code=400, detail="Estoque insuficiente")
    else:  # ajuste = definir estoque
        delta = payload.quantity - product["stock"]

    await db.products.update_one({"id": payload.product_id}, {"$inc": {"stock": delta}})
    mov = {
        "id": str(uuid.uuid4()),
        "product_id": payload.product_id,
        "product_name": product["name"],
        "type": payload.type,
        "quantity": payload.quantity,
        "reason": payload.reason or f"Movimentação manual",
        "created_at": iso(now_utc()),
        "created_by": user["name"],
    }
    await db.stock_movements.insert_one(mov)
    mov.pop("_id", None)
    return mov


# ============================================================
# REPORTS
# ============================================================
@api.get("/reports/dashboard")
async def report_dashboard(user: dict = Depends(get_current_user)):
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    all_sales = await db.sales.find({"status": "concluida"}, {"_id": 0}).to_list(5000)

    today_sales = [s for s in all_sales if datetime.fromisoformat(s["created_at"]) >= today_start]
    month_sales = [s for s in all_sales if datetime.fromisoformat(s["created_at"]) >= month_start]

    faturamento_hoje = sum(s["total"] for s in today_sales)
    faturamento_mes = sum(s["total"] for s in month_sales)
    vendas_hoje = len(today_sales)
    ticket_medio = (faturamento_hoje / vendas_hoje) if vendas_hoje else 0

    # sales last 7 days
    days = []
    for i in range(6, -1, -1):
        d = today_start - timedelta(days=i)
        d_end = d + timedelta(days=1)
        day_sales = [s for s in all_sales if d <= datetime.fromisoformat(s["created_at"]) < d_end]
        days.append({
            "date": d.strftime("%d/%m"),
            "iso_date": d.date().isoformat(),
            "total": round(sum(s["total"] for s in day_sales), 2),
            "count": len(day_sales),
        })

    # low stock
    low_stock = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$min_stock"]}},
        {"_id": 0, "id": 1, "name": 1, "stock": 1, "min_stock": 1},
    ).sort("stock", 1).to_list(20)

    # recent sales (10)
    recent = sorted(all_sales, key=lambda s: s["created_at"], reverse=True)[:10]

    # payment method distribution today
    pay = {}
    for s in month_sales:
        pay[s["payment_method"]] = pay.get(s["payment_method"], 0) + s["total"]

    return {
        "faturamento_hoje": round(faturamento_hoje, 2),
        "faturamento_mes": round(faturamento_mes, 2),
        "vendas_hoje": vendas_hoje,
        "ticket_medio": round(ticket_medio, 2),
        "vendas_mes": len(month_sales),
        "alertas_estoque_baixo": len(low_stock),
        "sales_last_7_days": days,
        "low_stock_products": low_stock,
        "recent_sales": [{"id": s["id"], "code": s["code"], "total": s["total"], "customer_name": s["customer_name"], "created_at": s["created_at"], "payment_method": s["payment_method"]} for s in recent],
        "payment_distribution": [{"method": k, "total": round(v, 2)} for k, v in pay.items()],
    }


@api.get("/reports/top-products")
async def top_products(limit: int = 10, user: dict = Depends(get_current_user)):
    sales = await db.sales.find({"status": "concluida"}, {"_id": 0}).to_list(10000)
    agg = {}
    for s in sales:
        for it in s["items"]:
            key = it["product_id"]
            if key not in agg:
                agg[key] = {"product_id": key, "product_name": it["product_name"], "quantity": 0, "revenue": 0}
            agg[key]["quantity"] += it["quantity"]
            agg[key]["revenue"] += it["line_total"]
    ranking = sorted(agg.values(), key=lambda x: x["revenue"], reverse=True)[:limit]
    for r in ranking:
        r["revenue"] = round(r["revenue"], 2)
    return ranking


@api.get("/reports/sales-by-period")
async def sales_by_period(days: int = 30, user: dict = Depends(get_current_user)):
    start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    sales = await db.sales.find({"status": "concluida"}, {"_id": 0}).to_list(20000)
    buckets = {}
    for i in range(days):
        d = (start + timedelta(days=i)).date().isoformat()
        buckets[d] = {"date": d, "total": 0, "count": 0}
    for s in sales:
        d = datetime.fromisoformat(s["created_at"]).date().isoformat()
        if d in buckets:
            buckets[d]["total"] += s["total"]
            buckets[d]["count"] += 1
    result = list(buckets.values())
    for r in result:
        r["total"] = round(r["total"], 2)
    return result


@api.get("/reports/top-customers")
async def top_customers(limit: int = 10, user: dict = Depends(get_current_user)):
    sales = await db.sales.find({"status": "concluida"}, {"_id": 0}).to_list(10000)
    agg = {}
    for s in sales:
        if not s.get("customer_id"):
            continue
        key = s["customer_id"]
        if key not in agg:
            agg[key] = {"customer_id": key, "customer_name": s["customer_name"], "count": 0, "revenue": 0}
        agg[key]["count"] += 1
        agg[key]["revenue"] += s["total"]
    ranking = sorted(agg.values(), key=lambda x: x["revenue"], reverse=True)[:limit]
    for r in ranking:
        r["revenue"] = round(r["revenue"], 2)
        r["ticket_medio"] = round(r["revenue"] / r["count"], 2) if r["count"] else 0
    return ranking


@api.get("/")
async def root():
    return {"app": "PDV Pro API", "status": "ok"}


# ============================================================
# TABLES (Mesas)
# ============================================================
@api.get("/tables")
async def list_tables(user: dict = Depends(get_current_user)):
    docs = await db.tables.find({}, {"_id": 0}).sort("number", 1).to_list(200)
    return docs


@api.put("/tables/{table_id}")
async def update_table(table_id: str, payload: dict, user: dict = Depends(require_roles("admin", "gerente"))):
    allowed = {k: v for k, v in payload.items() if k in {"seats", "status", "number"}}
    r = await db.tables.find_one_and_update({"id": table_id}, {"$set": allowed}, return_document=True)
    if not r:
        raise HTTPException(status_code=404, detail="Mesa não encontrada")
    r.pop("_id", None)
    return r


# ============================================================
# ORDERS (Comandas) — mesa/hotel/ifood/buffet
# ============================================================
class OrderItemIn(BaseModel):
    product_id: str
    quantity: int
    notes: Optional[str] = None


class OrderCreateIn(BaseModel):
    channel: Literal["mesa", "hotel", "ifood", "buffet"]
    table_id: Optional[str] = None
    hotel_room: Optional[str] = None
    hotel_guest: Optional[str] = None
    ifood_number: Optional[str] = None
    event_name: Optional[str] = None
    customer_id: Optional[str] = None
    notes: Optional[str] = None


class OrderAddItemsIn(BaseModel):
    items: List[OrderItemIn]


class OrderCloseIn(BaseModel):
    payment_method: Literal["dinheiro", "pix", "credito", "debito", "hotel_lancamento"]
    discount: float = 0
    service_fee_percent: float = 10.0  # taxa de serviço padrão


def _enrich_items(items_in: List[OrderItemIn], products_by_id: dict):
    out = []
    total = 0.0
    for it in items_in:
        p = products_by_id.get(it.product_id)
        if not p:
            raise HTTPException(status_code=404, detail=f"Produto {it.product_id} não encontrado")
        line = p["sale_price"] * it.quantity
        total += line
        out.append({
            "id": str(uuid.uuid4()),
            "product_id": p["id"],
            "product_name": p["name"],
            "sector": p.get("sector", "cozinha_quente"),
            "quantity": it.quantity,
            "unit_price": p["sale_price"],
            "line_total": line,
            "notes": it.notes,
            "status": "pendente",  # pendente, preparando, pronto, entregue
            "printed": False,
            "created_at": iso(now_utc()),
        })
    return out, total


@api.get("/orders")
async def list_orders(status: Optional[str] = None, channel: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {}
    if status: q["status"] = status
    if channel: q["channel"] = channel
    docs = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    doc = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    return doc


@api.post("/orders")
async def create_order(payload: OrderCreateIn, user: dict = Depends(get_current_user)):
    if payload.channel == "mesa" and not payload.table_id:
        raise HTTPException(status_code=400, detail="Mesa obrigatória para canal mesa")
    if payload.channel == "hotel" and not payload.hotel_room:
        raise HTTPException(status_code=400, detail="Nº do quarto obrigatório para canal hotel")

    table_number = None
    if payload.table_id:
        table = await db.tables.find_one({"id": payload.table_id})
        if not table:
            raise HTTPException(status_code=404, detail="Mesa não encontrada")
        if table["status"] == "ocupada":
            raise HTTPException(status_code=400, detail="Mesa já ocupada")
        table_number = table["number"]

    oid = str(uuid.uuid4())
    order = {
        "id": oid,
        "code": f"C{int(now_utc().timestamp())}",
        "channel": payload.channel,
        "table_id": payload.table_id,
        "table_number": table_number,
        "hotel_room": payload.hotel_room,
        "hotel_guest": payload.hotel_guest,
        "ifood_number": payload.ifood_number,
        "event_name": payload.event_name,
        "customer_id": payload.customer_id,
        "operator_id": user["id"],
        "operator_name": user["name"],
        "items": [],
        "subtotal": 0.0,
        "discount": 0.0,
        "service_fee": 0.0,
        "total": 0.0,
        "status": "aberta",  # aberta, fechada, cancelada
        "payment_method": None,
        "notes": payload.notes,
        "created_at": iso(now_utc()),
        "closed_at": None,
    }
    await db.orders.insert_one(order)

    if payload.table_id:
        await db.tables.update_one({"id": payload.table_id}, {"$set": {"status": "ocupada", "current_order_id": oid}})

    order.pop("_id", None)
    return order


@api.post("/orders/{order_id}/items")
async def add_items(order_id: str, payload: OrderAddItemsIn, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    if order["status"] != "aberta":
        raise HTTPException(status_code=400, detail="Comanda não está aberta")

    product_ids = [it.product_id for it in payload.items]
    prods = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000)
    p_by_id = {p["id"]: p for p in prods}

    new_items, added_total = _enrich_items(payload.items, p_by_id)
    new_subtotal = order["subtotal"] + added_total
    new_total = new_subtotal

    await db.orders.update_one(
        {"id": order_id},
        {"$push": {"items": {"$each": new_items}}, "$set": {"subtotal": new_subtotal, "total": new_total}},
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order


@api.post("/orders/{order_id}/close")
async def close_order(order_id: str, payload: OrderCloseIn, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    if order["status"] != "aberta":
        raise HTTPException(status_code=400, detail="Comanda não está aberta")

    subtotal = order["subtotal"]
    service_fee = round(subtotal * (payload.service_fee_percent / 100), 2)
    discount = payload.discount or 0
    total = max(0.0, subtotal + service_fee - discount)

    # Decrement stock (skip buffet items which are unlimited)
    for it in order["items"]:
        product = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not product:
            continue
        if product.get("sector") == "buffet":
            continue
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"stock": -it["quantity"]}})
        await db.stock_movements.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": it["product_id"],
            "product_name": it["product_name"],
            "type": "saida",
            "quantity": it["quantity"],
            "reason": f"Comanda {order['code']}",
            "created_at": iso(now_utc()),
            "created_by": user["name"],
        })

    # Create a sale record for reports
    sid = str(uuid.uuid4())
    customer_name = "Consumidor"
    if order.get("channel") == "mesa":
        customer_name = f"Mesa {order.get('table_number')}"
    elif order.get("channel") == "hotel":
        customer_name = f"Hóspede Qto {order.get('hotel_room')}" + (f" — {order.get('hotel_guest')}" if order.get("hotel_guest") else "")
    elif order.get("channel") == "ifood":
        customer_name = f"iFood #{order.get('ifood_number') or '-'}"
    elif order.get("channel") == "buffet":
        customer_name = f"Evento: {order.get('event_name') or '-'}"

    sale_doc = {
        "id": sid,
        "code": f"V{int(now_utc().timestamp())}",
        "order_id": order_id,
        "order_code": order["code"],
        "channel": order["channel"],
        "customer_id": order.get("customer_id"),
        "customer_name": customer_name,
        "operator_id": user["id"],
        "operator_name": user["name"],
        "items": [{
            "product_id": it["product_id"],
            "product_name": it["product_name"],
            "quantity": it["quantity"],
            "unit_price": it["unit_price"],
            "line_total": it["line_total"],
        } for it in order["items"]],
        "subtotal": subtotal,
        "service_fee": service_fee,
        "discount": discount,
        "total": total,
        "payment_method": payload.payment_method,
        "status": "concluida",
        "created_at": iso(now_utc()),
    }
    await db.sales.insert_one(sale_doc)

    # Close order
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "fechada",
            "payment_method": payload.payment_method,
            "discount": discount,
            "service_fee": service_fee,
            "total": total,
            "closed_at": iso(now_utc()),
            "sale_id": sid,
        }},
    )
    # Free table
    if order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]}, {"$set": {"status": "livre", "current_order_id": None}})

    return {"success": True, "sale_id": sid, "total": total, "service_fee": service_fee}


@api.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user: dict = Depends(require_roles("admin", "gerente"))):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Comanda não encontrada")
    if order["status"] != "aberta":
        raise HTTPException(status_code=400, detail="Comanda não está aberta")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "cancelada", "closed_at": iso(now_utc())}})
    if order.get("table_id"):
        await db.tables.update_one({"id": order["table_id"]}, {"$set": {"status": "livre", "current_order_id": None}})
    return {"success": True}


@api.post("/orders/{order_id}/mark-printed")
async def mark_printed(order_id: str, user: dict = Depends(get_current_user)):
    """Mark all pending items as printed (kitchen sent)."""
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"items.$[elem].printed": True, "items.$[elem].status": "preparando"}},
        array_filters=[{"elem.printed": False}],
    )
    return {"success": True}


api.get("/health")(lambda: {"status": "ok"})


# ============================================================
# Seed
# ============================================================
async def ensure_user(email: str, password: str, name: str, role: str):
    email = email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        # keep password in sync with env
        if not verify_password(password, existing["password_hash"]):
            await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
        return existing["id"]
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "email": email,
        "name": name,
        "role": role,
        "password_hash": hash_password(password),
        "created_at": iso(now_utc()),
    })
    logger.info(f"Seeded user: {email} ({role})")
    return uid


SEED_PRODUCTS = [
    # (name, category, sector, cost, price, stock)
    ("Picanha na Chapa 400g", "Carnes", "cozinha_quente", 28.00, 79.90, 60),
    ("Filé Mignon Grelhado", "Carnes", "cozinha_quente", 24.00, 69.90, 45),
    ("Costela BBQ", "Carnes", "cozinha_quente", 22.00, 64.90, 40),
    ("Frango à Parmegiana", "Massas", "cozinha_quente", 12.00, 42.90, 50),
    ("Lasanha à Bolonhesa", "Massas", "cozinha_quente", 10.00, 38.90, 35),
    ("Espaguete ao Molho Sugo", "Massas", "cozinha_quente", 8.00, 32.90, 45),
    ("Risoto de Camarão", "Massas", "cozinha_quente", 18.00, 58.90, 25),
    ("Batata Frita Rústica", "Petiscos", "cozinha_quente", 5.00, 24.90, 80),
    ("Isca de Tilápia", "Petiscos", "cozinha_quente", 12.00, 38.90, 30),
    ("Salada Caesar", "Saladas", "cozinha_fria", 6.00, 26.90, 40),
    ("Salada Tropical", "Saladas", "cozinha_fria", 5.00, 22.90, 35),
    ("Ceviche de Peixe", "Saladas", "cozinha_fria", 15.00, 44.90, 20),
    ("Bruschetta Italiana", "Entradas", "cozinha_fria", 4.00, 18.90, 40),
    ("Tábua de Frios", "Entradas", "cozinha_fria", 22.00, 64.90, 15),
    ("Coca-Cola 350ml", "Refrigerantes", "bar", 2.20, 7.90, 120),
    ("Guaraná Antarctica 350ml", "Refrigerantes", "bar", 2.00, 7.50, 100),
    ("Água Mineral 500ml", "Bebidas", "bar", 0.90, 4.50, 150),
    ("Suco Natural Laranja 400ml", "Bebidas", "bar", 3.00, 12.90, 40),
    ("Cerveja Heineken 600ml", "Cervejas", "bar", 6.00, 16.90, 80),
    ("Cerveja Brahma 600ml", "Cervejas", "bar", 4.50, 12.90, 100),
    ("Caipirinha de Limão", "Drinks", "bar", 4.00, 22.90, 4),  # low stock
    ("Mojito Cubano", "Drinks", "bar", 5.00, 26.90, 3),  # low stock
    ("Taça de Vinho Tinto", "Vinhos", "bar", 8.00, 28.90, 40),
    ("Espresso", "Cafés", "bar", 1.50, 6.90, 200),
    ("Buffet Livre por Pessoa", "Buffet", "buffet", 25.00, 89.90, 999),
    ("Estação de Massas (Buffet)", "Buffet", "buffet", 8.00, 32.90, 999),
    ("Estação de Sobremesas", "Buffet", "buffet", 6.00, 24.90, 999),
    ("Pudim de Leite", "Sobremesas", "cozinha_fria", 3.00, 16.90, 30),
    ("Petit Gateau", "Sobremesas", "cozinha_quente", 5.00, 24.90, 20),
    ("Sorvete 2 Bolas", "Sobremesas", "cozinha_fria", 3.50, 14.90, 60),
]

SEED_CUSTOMERS = [
    ("Maria Silva", "123.456.789-00", "maria@email.com", "(11) 98765-4321"),
    ("João Souza", "234.567.890-11", "joao@email.com", "(11) 91234-5678"),
    ("Ana Oliveira", "345.678.901-22", "ana@email.com", "(21) 98888-7777"),
    ("Carlos Mendes", "456.789.012-33", "carlos@email.com", "(21) 97777-6666"),
    ("Fernanda Costa", "567.890.123-44", "fernanda@email.com", "(31) 96666-5555"),
    ("Ricardo Lima", "678.901.234-55", "ricardo@email.com", "(31) 95555-4444"),
    ("Juliana Alves", "789.012.345-66", "juliana@email.com", "(41) 94444-3333"),
    ("Pedro Santos", "890.123.456-77", "pedro@email.com", "(41) 93333-2222"),
    ("Camila Rocha", "901.234.567-88", "camila@email.com", "(51) 92222-1111"),
    ("Bruno Ferreira", "012.345.678-99", "bruno@email.com", "(51) 91111-0000"),
]


async def seed_data():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("barcode")
    await db.sales.create_index("created_at")

    # Users
    admin_id = await ensure_user(os.environ["ADMIN_EMAIL"], os.environ["ADMIN_PASSWORD"], "Administrador", "admin")
    gerente_id = await ensure_user(os.environ["GERENTE_EMAIL"], os.environ["GERENTE_PASSWORD"], "Ana Gerente", "gerente")
    operador_id = await ensure_user(os.environ["OPERADOR_EMAIL"], os.environ["OPERADOR_PASSWORD"], "Pedro Operador", "operador")

    # Products
    if await db.products.count_documents({}) == 0:
        for i, (name, cat, sector, cost, price, stock) in enumerate(SEED_PRODUCTS):
            await db.products.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "barcode": f"789{str(1000000 + i).zfill(10)}",
                "category": cat,
                "sector": sector,
                "cost_price": cost,
                "sale_price": price,
                "stock": stock,
                "min_stock": 5,
                "active": True,
                "created_at": iso(now_utc()),
            })
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")

    # Seed 30 mesas
    if await db.tables.count_documents({}) == 0:
        for i in range(1, 31):
            await db.tables.insert_one({
                "id": str(uuid.uuid4()),
                "number": i,
                "seats": 4,
                "status": "livre",  # livre, ocupada, reservada
                "current_order_id": None,
                "created_at": iso(now_utc()),
            })
        logger.info("Seeded 30 tables")

    # Customers
    if await db.customers.count_documents({}) == 0:
        for name, doc, email, phone in SEED_CUSTOMERS:
            await db.customers.insert_one({
                "id": str(uuid.uuid4()),
                "name": name,
                "document": doc,
                "email": email,
                "phone": phone,
                "address": "Endereço não informado",
                "created_at": iso(now_utc()),
            })
        logger.info(f"Seeded {len(SEED_CUSTOMERS)} customers")

    # Sales (25 historical sales, spread over last 14 days)
    if await db.sales.count_documents({}) == 0:
        products = await db.products.find({}, {"_id": 0}).to_list(1000)
        customers = await db.customers.find({}, {"_id": 0}).to_list(1000)
        operators = [
            {"id": admin_id, "name": "Administrador"},
            {"id": gerente_id, "name": "Ana Gerente"},
            {"id": operador_id, "name": "Pedro Operador"},
        ]
        payments = ["pix", "credito", "debito", "dinheiro"]
        random.seed(42)
        for i in range(25):
            days_ago = random.randint(0, 13)
            hours = random.randint(8, 21)
            minutes = random.randint(0, 59)
            ts = (now_utc() - timedelta(days=days_ago)).replace(hour=hours, minute=minutes, second=0, microsecond=0)

            n_items = random.randint(1, 5)
            chosen = random.sample(products, n_items)
            items = []
            subtotal = 0.0
            for p in chosen:
                qty = random.randint(1, 4)
                unit = p["sale_price"]
                line = qty * unit
                subtotal += line
                items.append({
                    "product_id": p["id"],
                    "product_name": p["name"],
                    "quantity": qty,
                    "unit_price": unit,
                    "line_total": line,
                })
            discount = 0.0 if random.random() > 0.3 else round(subtotal * random.uniform(0.02, 0.1), 2)
            total = round(subtotal - discount, 2)
            op = random.choice(operators)
            has_customer = random.random() > 0.3
            cust = random.choice(customers) if has_customer else None
            await db.sales.insert_one({
                "id": str(uuid.uuid4()),
                "code": f"V{int(ts.timestamp())}{i}",
                "customer_id": cust["id"] if cust else None,
                "customer_name": cust["name"] if cust else "Consumidor",
                "operator_id": op["id"],
                "operator_name": op["name"],
                "items": items,
                "subtotal": round(subtotal, 2),
                "discount": discount,
                "total": total,
                "payment_method": random.choice(payments),
                "status": "concluida",
                "created_at": iso(ts),
            })
        logger.info("Seeded 25 sales")


@app.on_event("startup")
async def on_startup():
    await seed_data()
    logger.info("PDV Pro started")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ============================================================
# Mount
# ============================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
