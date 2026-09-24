import { useEffect, useMemo, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, QrCode, Wallet, Banknote } from "lucide-react";
import { toast } from "sonner";

const PAYMENTS = [
  { key: "pix", label: "Pix", icon: QrCode },
  { key: "credito", label: "Crédito", icon: CreditCard },
  { key: "debito", label: "Débito", icon: Wallet },
  { key: "dinheiro", label: "Dinheiro", icon: Banknote },
];

export default function PDV() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("todos");
  const [cart, setCart] = useState([]); // {product, quantity}
  const [customerId, setCustomerId] = useState("none");
  const [payment, setPayment] = useState("pix");
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get("/products").then((r) => setProducts(r.data.filter(p => p.active)));
    api.get("/customers").then((r) => setCustomers(r.data));
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category))).sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (category !== "todos" && p.category !== category) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q);
    });
  }, [products, query, category]);

  const addToCart = (product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} sem estoque`);
      return;
    }
    setCart((c) => {
      const idx = c.findIndex(it => it.product.id === product.id);
      if (idx >= 0) {
        const next = [...c];
        if (next[idx].quantity + 1 > product.stock) {
          toast.error("Estoque insuficiente");
          return c;
        }
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...c, { product, quantity: 1 }];
    });
  };

  const changeQty = (id, delta) => {
    setCart((c) => c.map(it => {
      if (it.product.id !== id) return it;
      const newQty = it.quantity + delta;
      if (newQty <= 0) return null;
      if (newQty > it.product.stock) { toast.error("Estoque insuficiente"); return it; }
      return { ...it, quantity: newQty };
    }).filter(Boolean));
  };

  const removeItem = (id) => setCart((c) => c.filter(it => it.product.id !== id));

  const subtotal = cart.reduce((sum, it) => sum + it.product.sale_price * it.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const finalize = async () => {
    if (cart.length === 0) return toast.error("Carrinho vazio");
    setLoading(true);
    try {
      await api.post("/sales", {
        customer_id: customerId === "none" ? null : customerId,
        items: cart.map(it => ({
          product_id: it.product.id,
          quantity: it.quantity,
          unit_price: it.product.sale_price,
        })),
        payment_method: payment,
        discount: Number(discount || 0),
      });
      toast.success(`Venda de ${brl(total)} finalizada!`);
      setCart([]);
      setDiscount(0);
      setCustomerId("none");
      load();
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader title="Frente de Caixa" subtitle="Registre vendas rapidamente" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar produto ou código de barras..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 h-11"
                  data-testid="input-barcode-search"
                  autoFocus
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 w-full sm:w-56" data-testid="select-categoria">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas categorias</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
                className="p-4 rounded-xl bg-white border border-slate-200 text-left hover:border-emerald-500 hover:shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid={`product-card-${p.id}`}
              >
                <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">{p.category}</div>
                <div className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2 min-h-[40px]">{p.name}</div>
                <div className="flex items-end justify-between mt-3">
                  <div className="text-lg font-bold text-slate-900 font-mono">{brl(p.sale_price)}</div>
                  <Badge variant="outline" className={`text-xs ${p.stock <= p.min_stock ? "border-amber-300 text-amber-700 bg-amber-50" : "border-slate-200 text-slate-500"}`}>
                    {p.stock} un
                  </Badge>
                </div>
              </button>
            ))}
            {filtered.length === 0 && <div className="col-span-full text-center text-slate-500 py-10">Nenhum produto encontrado</div>}
          </div>
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-4">
          <Card className="p-5 sticky top-6" data-testid="cart-card">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-5 h-5 text-emerald-700" />
              <div className="font-semibold text-slate-900">Carrinho ({cart.length})</div>
            </div>

            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="mb-3" data-testid="select-cliente">
                <SelectValue placeholder="Consumidor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Consumidor</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="max-h-72 overflow-y-auto -mx-2 px-2 space-y-2 mb-4">
              {cart.length === 0 && <div className="text-sm text-slate-400 text-center py-6">Adicione produtos ao carrinho</div>}
              {cart.map((it) => (
                <div key={it.product.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2" data-testid={`cart-item-${it.product.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 truncate">{it.product.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{brl(it.product.sale_price)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(it.product.id, -1)} className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center hover:border-emerald-500"><Minus className="w-3 h-3" /></button>
                    <div className="w-8 text-center text-sm font-semibold font-mono" data-testid={`cart-qty-${it.product.id}`}>{it.quantity}</div>
                    <button onClick={() => changeQty(it.product.id, 1)} className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center hover:border-emerald-500"><Plus className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => removeItem(it.product.id)} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t pt-3 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{brl(subtotal)}</span></div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Desconto</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-24 h-8 text-right font-mono"
                  data-testid="input-desconto"
                />
              </div>
              <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t">
                <span>Total</span>
                <span className="font-mono text-emerald-700" data-testid="cart-total">{brl(total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mt-4">
              {PAYMENTS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPayment(p.key)}
                  className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition ${payment === p.key ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                  data-testid={`payment-${p.key}`}
                >
                  <p.icon className="w-4 h-4" />
                  {p.label}
                </button>
              ))}
            </div>

            <Button
              onClick={finalize}
              disabled={loading || cart.length === 0}
              className="w-full h-12 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base"
              data-testid="btn-finalizar-venda"
            >
              {loading ? "Processando..." : `Finalizar ${brl(total)}`}
            </Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
