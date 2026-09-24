import { useEffect, useState } from "react";
import api from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { brl } from "@/lib/format";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from "recharts";

export default function Reports() {
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [byPeriod, setByPeriod] = useState([]);

  useEffect(() => {
    api.get("/reports/top-products", { params: { limit: 10 } }).then(r => setTopProducts(r.data));
    api.get("/reports/top-customers", { params: { limit: 10 } }).then(r => setTopCustomers(r.data));
    api.get("/reports/sales-by-period", { params: { days: 30 } }).then(r => setByPeriod(r.data));
  }, []);

  return (
    <Layout>
      <PageHeader title="Relatórios" subtitle="Análise de vendas, produtos e clientes" />

      <Tabs defaultValue="periodo">
        <TabsList data-testid="reports-tabs">
          <TabsTrigger value="periodo" data-testid="tab-periodo">Vendas por período</TabsTrigger>
          <TabsTrigger value="produtos" data-testid="tab-produtos">Top produtos</TabsTrigger>
          <TabsTrigger value="clientes" data-testid="tab-clientes">Top clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="periodo" className="mt-4">
          <Card className="p-5">
            <div className="mb-4">
              <div className="text-sm font-semibold">Faturamento — últimos 30 dias</div>
              <div className="text-xs text-slate-500">Total: {brl(byPeriod.reduce((s, d) => s + d.total, 0))}</div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={byPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.slice(5).replace("-", "/")} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v) => brl(v)} contentStyle={{ borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5">
              <div className="text-sm font-semibold mb-4">Receita por produto</div>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={topProducts} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${v}`} />
                  <YAxis type="category" dataKey="product_name" stroke="#64748b" fontSize={11} width={140} />
                  <Tooltip formatter={(v) => brl(v)} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="revenue" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>#</TableHead><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Receita</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((p, i) => (
                    <TableRow key={p.product_id}><TableCell>{i + 1}</TableCell><TableCell className="font-medium">{p.product_name}</TableCell><TableCell className="text-right font-mono">{p.quantity}</TableCell><TableCell className="text-right font-mono font-semibold">{brl(p.revenue)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Compras</TableHead><TableHead className="text-right">Ticket Médio</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((c, i) => (
                  <TableRow key={c.customer_id}><TableCell>{i + 1}</TableCell><TableCell className="font-medium">{c.customer_name}</TableCell><TableCell className="text-right font-mono">{c.count}</TableCell><TableCell className="text-right font-mono">{brl(c.ticket_medio)}</TableCell><TableCell className="text-right font-mono font-semibold">{brl(c.revenue)}</TableCell></TableRow>
                ))}
                {topCustomers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Sem dados</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
