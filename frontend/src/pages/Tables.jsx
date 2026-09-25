import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Receipt } from "lucide-react";

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const nav = useNavigate();

  const load = () => {
    api.get("/tables").then(r => setTables(r.data));
    api.get("/orders", { params: { status: "aberta" } }).then(r => setOrders(r.data));
  };
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const orderOf = (tableId) => orders.find(o => o.table_id === tableId);

  const openTable = async (table) => {
    const existing = orderOf(table.id);
    if (existing) return nav(`/comanda/${existing.id}`);
    try {
      const r = await api.post("/orders", { channel: "mesa", table_id: table.id });
      nav(`/comanda/${r.data.id}`);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <Layout>
      <PageHeader title="Salão · Mesas" subtitle={`${tables.filter(t => t.status === "ocupada").length} de ${tables.length} mesas ocupadas`} />

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {tables.map((t) => {
          const o = orderOf(t.id);
          const occupied = t.status === "ocupada" || !!o;
          return (
            <button
              key={t.id}
              onClick={() => openTable(t)}
              className={`aspect-square rounded-xl p-3 border-2 transition text-left flex flex-col justify-between ${occupied ? "bg-amber-50 border-amber-400 hover:border-amber-500" : "bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md"}`}
              data-testid={`mesa-${t.number}`}
            >
              <div className="flex items-start justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mesa</div>
                {occupied && <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-[10px] px-1.5 py-0">Ocupada</Badge>}
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono">{t.number}</div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                {o ? <><Receipt className="w-3 h-3" /> {o.items.length} itens</> : <><Users className="w-3 h-3" /> {t.seats} lug.</>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={() => nav("/comanda/novo?channel=hotel")} className="bg-blue-600 hover:bg-blue-700" data-testid="btn-nova-hotel">Nova comanda Hotel</Button>
        <Button onClick={() => nav("/comanda/novo?channel=ifood")} className="bg-rose-600 hover:bg-rose-700" data-testid="btn-nova-ifood">Nova comanda iFood</Button>
        <Button onClick={() => nav("/comanda/novo?channel=buffet")} className="bg-purple-600 hover:bg-purple-700" data-testid="btn-nova-buffet">Nova comanda Buffet</Button>
      </div>
    </Layout>
  );
}
