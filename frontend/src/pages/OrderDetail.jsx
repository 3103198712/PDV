import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { Search, Plus, Minus, Trash2, Printer, CheckCircle2, XCircle, FileText, ShoppingCart } from "lucide-react";

const CHANNEL_LABEL = { mesa: "Mesa", hotel: "Hotel", ifood: "iFood", buffet: "Buffet" };
const SECTOR_LABEL = { cozinha_quente: "Cozinha Quente", cozinha_fria: "Cozinha Fria", bar: "Bar", buffet: "Buffet" };

/** New order (channel != mesa) creation dialog when route is /comanda/novo */
export function NewOrder() {
  const [params] = useSearchParams();
  const channel = params.get("channel") || "hotel";
  const nav = useNavigate();
  const [form, setForm] = useState({ channel, hotel_room: "", hotel_guest: "", ifood_number: "", event_name: "", notes: "" });

  const create = async () => {
    try {
      const r = await api.post("/orders", form);
      toast.success("Comanda criada");
      nav(`/comanda/${r.data.id}`);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <Layout>
      <PageHeader title={`Nova comanda · ${CHANNEL_LABEL[channel]}`} />
      <Card className="p-6 max-w-lg space-y-3">
        {channel === "hotel" && (
          <>
            <div className="space-y-1"><Label>Número do quarto</Label><Input value={form.hotel_room} onChange={(e) => setForm({ ...form, hotel_room: e.target.value })} data-testid="input-hotel-quarto" /></div>
            <div className="space-y-1"><Label>Nome do hóspede</Label><Input value={form.hotel_guest} onChange={(e) => setForm({ ...form, hotel_guest: e.target.value })} data-testid="input-hotel-nome" /></div>
          </>
        )}
        {channel === "ifood" && (
          <div className="space-y-1"><Label>Número do pedido iFood</Label><Input value={form.ifood_number} onChange={(e) => setForm({ ...form, ifood_number: e.target.value })} data-testid="input-ifood-numero" /></div>
        )}
        {channel === "buffet" && (
          <div className="space-y-1"><Label>Nome do evento</Label><Input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} data-testid="input-buffet-evento" /></div>
        )}
        <div className="space-y-1"><Label>Observações</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => nav(-1)}>Cancelar</Button>
          <Button onClick={create} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-criar-comanda">Abrir comanda</Button>
        </div>
      </Card>
    </Layout>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("todos");
  const [closeDlg, setCloseDlg] = useState(false);
  const [pay, setPay] = useState("pix");
  const [discount, setDiscount] = useState(0);
  const [servicePercent, setServicePercent] = useState(10);

  const load = () => api.get(`/orders/${id}`).then(r => setOrder(r.data));
  useEffect(() => { load(); api.get("/products").then(r => setProducts(r.data.filter(p => p.active))); }, [id]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (sector !== "todos" && p.sector !== sector) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return p.name.toLowerCase().includes(s) || (p.barcode || "").includes(s);
    });
  }, [products, q, sector]);

  const addItem = async (product) => {
    try {
      const r = await api.post(`/orders/${id}/items`, { items: [{ product_id: product.id, quantity: 1 }] });
      setOrder(r.data);
      toast.success(`${product.name} adicionado`);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const printKitchen = () => {
    window.open(`/print/kitchen/${id}`, "_blank", "width=380,height=700");
    api.post(`/orders/${id}/mark-printed`).then(load);
  };
  const printPreConta = () => {
    window.open(`/print/preconta/${id}`, "_blank", "width=380,height=700");
  };
  const printCupom = (saleId) => {
    window.open(`/print/cupom/${saleId}`, "_blank", "width=380,height=700");
  };

  const closeOrder = async () => {
    try {
      const r = await api.post(`/orders/${id}/close`, {
        payment_method: pay,
        discount: Number(discount || 0),
        service_fee_percent: Number(servicePercent || 0),
      });
      toast.success(`Comanda fechada · ${brl(r.data.total)}`);
      printCupom(r.data.sale_id);
      setCloseDlg(false);
      nav("/mesas");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const cancelOrder = async () => {
    if (!window.confirm("Cancelar esta comanda?")) return;
    try {
      await api.post(`/orders/${id}/cancel`);
      toast.success("Comanda cancelada");
      nav("/mesas");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  if (!order) return <Layout><div className="text-slate-500">Carregando...</div></Layout>;

  const subtotal = order.subtotal;
  const service = subtotal * (servicePercent / 100);
  const total = Math.max(0, subtotal + service - Number(discount || 0));

  const headerTitle = order.channel === "mesa" ? `Mesa ${order.table_number}` :
    order.channel === "hotel" ? `Quarto ${order.hotel_room}${order.hotel_guest ? " · " + order.hotel_guest : ""}` :
    order.channel === "ifood" ? `iFood #${order.ifood_number || "-"}` :
    `Buffet · ${order.event_name || "-"}`;

  return (
    <Layout>
      <PageHeader
        title={`Comanda ${order.code}`}
        subtitle={<div className="flex items-center gap-2"><Badge className="bg-slate-900 text-white hover:bg-slate-900">{CHANNEL_LABEL[order.channel]}</Badge><span>{headerTitle}</span></div>}
        actions={<div className="flex gap-2">
          <Button variant="outline" onClick={printKitchen} data-testid="btn-imprimir-cozinha"><Printer className="w-4 h-4 mr-1" /> Cozinha</Button>
          <Button variant="outline" onClick={printPreConta} data-testid="btn-preconta"><FileText className="w-4 h-4 mr-1" /> Pré-conta</Button>
          <Button variant="outline" onClick={cancelOrder} className="text-rose-600" data-testid="btn-cancelar-comanda"><XCircle className="w-4 h-4 mr-1" /> Cancelar</Button>
          <Button onClick={() => setCloseDlg(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-fechar-comanda"><CheckCircle2 className="w-4 h-4 mr-1" /> Fechar conta</Button>
        </div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input placeholder="Buscar produto..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" data-testid="input-buscar-produto-comanda" />
              </div>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos setores</SelectItem>
                  <SelectItem value="cozinha_quente">Cozinha Quente</SelectItem>
                  <SelectItem value="cozinha_fria">Cozinha Fria</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="buffet">Buffet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(p => (
              <button key={p.id} onClick={() => addItem(p)} className="p-3 rounded-xl bg-white border border-slate-200 text-left hover:border-emerald-500 hover:shadow-md transition" data-testid={`prod-add-${p.id}`}>
                <div className="text-[10px] font-semibold text-emerald-700 uppercase">{SECTOR_LABEL[p.sector] || p.sector}</div>
                <div className="text-sm font-semibold text-slate-900 mt-1 line-clamp-2 min-h-[36px]">{p.name}</div>
                <div className="text-base font-bold text-slate-900 font-mono mt-2">{brl(p.sale_price)}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4">
          <Card className="p-5 sticky top-6" data-testid="comanda-card">
            <div className="flex items-center gap-2 mb-3"><ShoppingCart className="w-5 h-5 text-emerald-700" /><div className="font-semibold">Itens ({order.items.length})</div></div>
            <div className="max-h-[420px] overflow-y-auto -mx-2 px-2 space-y-2 mb-4">
              {order.items.length === 0 && <div className="text-sm text-slate-400 text-center py-6">Nenhum item ainda</div>}
              {order.items.map(it => (
                <div key={it.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2" data-testid={`item-comanda-${it.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{it.product_name}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-slate-500 font-mono">{it.quantity}× {brl(it.unit_price)}</span>
                      {!it.printed && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] px-1.5 py-0">Novo</Badge>}
                    </div>
                  </div>
                  <div className="text-sm font-bold font-mono">{brl(it.line_total)}</div>
                </div>
              ))}
            </div>
            <div className="text-sm space-y-1 border-t pt-3">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{brl(subtotal)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Serviço (est. 10%)</span><span className="font-mono">{brl(subtotal * 0.1)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total previsto</span><span className="font-mono text-emerald-700" data-testid="comanda-total">{brl(subtotal * 1.1)}</span></div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={closeDlg} onOpenChange={setCloseDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Fechar conta · {order.code}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <Select value={pay} onValueChange={setPay}>
                <SelectTrigger data-testid="select-pay-close"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  {order.channel === "hotel" && <SelectItem value="hotel_lancamento">Lançar no quarto</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Taxa serviço %</Label><Input type="number" value={servicePercent} onChange={(e) => setServicePercent(e.target.value)} data-testid="input-taxa-servico" /></div>
              <div className="space-y-1"><Label>Desconto</Label><Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} data-testid="input-desconto-close" /></div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{brl(subtotal)}</span></div>
              <div className="flex justify-between"><span>Serviço</span><span className="font-mono">{brl(service)}</span></div>
              <div className="flex justify-between"><span>Desconto</span><span className="font-mono">-{brl(discount)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="font-mono text-emerald-700">{brl(total)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDlg(false)}>Voltar</Button>
            <Button onClick={closeOrder} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-confirm-fechar">Confirmar & Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
