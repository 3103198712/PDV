import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { brl, dateTimeBR, paymentLabel } from "@/lib/format";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ShoppingBag, Receipt, AlertTriangle, ArrowUpRight, DollarSign } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

function KpiCard({ icon: Icon, label, value, hint, color = "emerald", testid }) {
  const bg = {
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[color];
  return (
    <Card className="p-5 card-hover" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
          <Icon className="w-5 h-5" strokeWidth={2.2} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-slate-300" />
      </div>
      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="kpi-value text-3xl mt-1 text-slate-900">{value}</div>
        {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/reports/dashboard").then((r) => setData(r.data));
  }, []);

  if (!data) return <Layout><div className="p-8 text-slate-500">Carregando...</div></Layout>;

  return (
    <Layout>
      <PageHeader title="Dashboard" subtitle="Visão geral do desempenho da loja hoje" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard testid="kpi-faturamento-hoje" icon={DollarSign} label="Faturamento Hoje" value={brl(data.faturamento_hoje)} hint={`${data.vendas_hoje} vendas`} color="emerald" />
        <KpiCard testid="kpi-faturamento-mes" icon={TrendingUp} label="Faturamento Mês" value={brl(data.faturamento_mes)} hint={`${data.vendas_mes} vendas no mês`} color="blue" />
        <KpiCard testid="kpi-ticket-medio" icon={Receipt} label="Ticket Médio (hoje)" value={brl(data.ticket_medio)} color="amber" />
        <KpiCard testid="kpi-estoque-baixo" icon={AlertTriangle} label="Alertas de Estoque" value={data.alertas_estoque_baixo} hint="Produtos abaixo do mínimo" color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-2" data-testid="chart-vendas-semana">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Vendas nos últimos 7 dias</div>
              <div className="text-xs text-slate-500">Total faturado por dia</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.sales_last_7_days}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: 8 }}
                formatter={(v) => brl(v)}
              />
              <Area type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5" data-testid="chart-pagamentos">
          <div className="mb-4">
            <div className="text-sm font-semibold text-slate-900">Formas de pagamento</div>
            <div className="text-xs text-slate-500">Distribuição do mês</div>
          </div>
          {data.payment_distribution.length === 0 ? (
            <div className="text-sm text-slate-500 py-10 text-center">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.payment_distribution}
                  dataKey="total"
                  nameKey="method"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {data.payment_distribution.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => brl(v)} />
                <Legend formatter={(v) => paymentLabel(v)} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2" data-testid="table-vendas-recentes">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Vendas recentes</div>
              <div className="text-xs text-slate-500">Últimas 10 vendas</div>
            </div>
            <Link to="/vendas" className="text-xs text-emerald-700 font-semibold hover:underline">Ver todas →</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recent_sales.map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{s.customer_name}</div>
                  <div className="text-xs text-slate-500">{s.code} · {dateTimeBR(s.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 font-mono">{brl(s.total)}</div>
                  <Badge variant="outline" className="text-xs mt-0.5 border-slate-200 text-slate-600">{paymentLabel(s.payment_method)}</Badge>
                </div>
              </div>
            ))}
            {data.recent_sales.length === 0 && <div className="py-6 text-center text-sm text-slate-500">Nenhuma venda ainda</div>}
          </div>
        </Card>

        <Card className="p-5" data-testid="card-estoque-baixo">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">Estoque baixo</div>
              <div className="text-xs text-slate-500">Reponha em breve</div>
            </div>
            <Link to="/estoque" className="text-xs text-emerald-700 font-semibold hover:underline">Gerenciar →</Link>
          </div>
          <div className="space-y-3">
            {data.low_stock_products.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                  <div className="text-xs text-slate-500">Mínimo: {p.min_stock}</div>
                </div>
                <Badge className={`${p.stock === 0 ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"} font-mono`}>
                  {p.stock} un
                </Badge>
              </div>
            ))}
            {data.low_stock_products.length === 0 && <div className="text-sm text-slate-500 py-4 text-center">Tudo em ordem 🎉</div>}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
