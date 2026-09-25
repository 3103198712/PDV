import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Clock, ChefHat, Utensils, Wine, Salad, Flame } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const SECTOR_META = {
  cozinha_quente: { label: "Cozinha Quente", icon: Flame, accent: "bg-rose-600", bg: "bg-rose-50" },
  cozinha_fria: { label: "Cozinha Fria", icon: Salad, accent: "bg-emerald-600", bg: "bg-emerald-50" },
  bar: { label: "Bar", icon: Wine, accent: "bg-blue-600", bg: "bg-blue-50" },
  buffet: { label: "Buffet", icon: Utensils, accent: "bg-purple-600", bg: "bg-purple-50" },
};

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Selection screen — one sector per screen */
export function KDSHome() {
  const nav = useNavigate();
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Kitchen Display</div>
            <h1 className="text-3xl font-extrabold">Selecione o setor</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">{user?.name}</div>
            <Button variant="outline" onClick={() => { logout(); nav("/login"); }} className="bg-transparent border-slate-700 hover:bg-slate-800 text-white">Sair</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(SECTOR_META).map(([key, m]) => (
            <button
              key={key}
              onClick={() => nav(`/kds/${key}`)}
              className={`p-8 rounded-2xl ${m.accent} text-left hover:brightness-110 transition`}
              data-testid={`kds-sector-${key}`}
            >
              <m.icon className="w-10 h-10 mb-3" />
              <div className="text-2xl font-extrabold">{m.label}</div>
              <div className="text-sm opacity-80 mt-1">Ver pedidos deste setor</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Sector KDS with columns pendente/preparando/pronto */
export default function KDS() {
  const { sector } = useParams();
  const nav = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [tick, setTick] = useState(0);
  const meta = SECTOR_META[sector];

  const load = () => api.get(`/kds/${sector}`).then((r) => setTickets(r.data));
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [sector]);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);

  const advance = async (t, next) => {
    try {
      await api.post(`/kds/orders/${t.order_id}/items/${t.item_id}/status`, { status: next });
      toast.success(next === "pronto" ? "Pronto para servir" : next === "entregue" ? "Entregue" : "Preparando");
      load();
    } catch (err) { toast.error("Erro ao atualizar"); }
  };

  if (!meta) return <div className="p-8">Setor inválido</div>;

  // add live elapsed based on tick
  const withElapsed = tickets.map(t => ({ ...t, live: t.elapsed_seconds + tick }));
  const cols = {
    pendente: withElapsed.filter(t => t.status === "pendente" || !t.printed),
    preparando: withElapsed.filter(t => t.status === "preparando" && t.printed),
    pronto: withElapsed.filter(t => t.status === "pronto"),
  };

  const urgencyClass = (secs) => {
    if (secs < 300) return "border-emerald-400";      // < 5 min
    if (secs < 600) return "border-amber-400";        // < 10 min
    return "border-rose-500 animate-pulse";           // > 10 min
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => nav("/kds")} className="bg-transparent border-slate-700 hover:bg-slate-800 text-white" data-testid="btn-kds-voltar">
            <ArrowLeft className="w-4 h-4 mr-1" /> Setores
          </Button>
          <div className={`${meta.accent} p-2 rounded-lg`}><meta.icon className="w-5 h-5" /></div>
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-500">Kitchen Display</div>
            <h1 className="text-2xl font-extrabold">{meta.label}</h1>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Total ativo</div>
          <div className="text-3xl font-extrabold font-mono">{withElapsed.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { key: "pendente", title: "Pendente", desc: "Aguardando ir para o preparo", next: "preparando", nextLabel: "Começar" },
          { key: "preparando", title: "Preparando", desc: "Em produção", next: "pronto", nextLabel: "Marcar pronto" },
          { key: "pronto", title: "Pronto", desc: "Aguardando garçom", next: "entregue", nextLabel: "Entregue" },
        ].map((col) => (
          <div key={col.key} className="bg-slate-900 rounded-xl p-3 min-h-[70vh]" data-testid={`kds-col-${col.key}`}>
            <div className="flex items-center justify-between mb-3 px-2">
              <div>
                <div className="text-xs uppercase text-slate-500 tracking-widest">{col.desc}</div>
                <div className="text-lg font-extrabold">{col.title}</div>
              </div>
              <div className="text-slate-500 font-mono text-lg">{cols[col.key].length}</div>
            </div>
            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-180px)] pr-1">
              {cols[col.key].length === 0 && <div className="text-slate-600 text-center py-6 text-sm">—</div>}
              {cols[col.key].map((t) => (
                <div key={t.item_id} className={`bg-slate-800 rounded-lg p-3 border-l-4 ${urgencyClass(t.live)}`} data-testid={`kds-ticket-${t.item_id}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{t.heading}</div>
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-mono"><Clock className="w-3 h-3" /> {fmt(t.live)}</div>
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold font-mono">{t.quantity}×</span>
                    <span className="text-lg font-bold">{t.product_name}</span>
                  </div>
                  {t.notes && <div className="mt-1 text-xs text-amber-300 italic">Obs: {t.notes}</div>}
                  <div className="mt-2 text-[10px] text-slate-500">Comanda {t.order_code} · {t.operator_name}</div>
                  <Button size="sm" onClick={() => advance(t, col.next)} className={`w-full mt-3 ${meta.accent} hover:brightness-110 text-white`} data-testid={`btn-kds-advance-${t.item_id}`}>
                    {col.nextLabel}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
