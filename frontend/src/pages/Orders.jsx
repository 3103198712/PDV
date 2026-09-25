import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { brl, dateTimeBR } from "@/lib/format";
import { Utensils, BedDouble, Bike, PartyPopper } from "lucide-react";

const CHANNEL = {
  mesa: { label: "Salão", icon: Utensils, color: "bg-emerald-100 text-emerald-700" },
  hotel: { label: "Hotel", icon: BedDouble, color: "bg-blue-100 text-blue-700" },
  ifood: { label: "iFood", icon: Bike, color: "bg-rose-100 text-rose-700" },
  buffet: { label: "Buffet", icon: PartyPopper, color: "bg-purple-100 text-purple-700" },
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("abertas");
  const nav = useNavigate();

  const load = () => api.get("/orders").then(r => setOrders(r.data));
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const filtered = orders.filter(o => tab === "abertas" ? o.status === "aberta" : tab === "fechadas" ? o.status === "fechada" : o.status === "cancelada");

  const headingFor = (o) => o.channel === "mesa" ? `Mesa ${o.table_number}` :
    o.channel === "hotel" ? `Qto ${o.hotel_room}${o.hotel_guest ? " · " + o.hotel_guest : ""}` :
    o.channel === "ifood" ? `iFood #${o.ifood_number || "-"}` :
    `${o.event_name || "Evento"}`;

  return (
    <Layout>
      <PageHeader title="Comandas" subtitle={`${orders.filter(o => o.status === "aberta").length} abertas · ${orders.length} total`} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="orders-tabs">
          <TabsTrigger value="abertas" data-testid="tab-abertas">Abertas</TabsTrigger>
          <TabsTrigger value="fechadas" data-testid="tab-fechadas">Fechadas</TabsTrigger>
          <TabsTrigger value="canceladas" data-testid="tab-canceladas">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Canal</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(o => {
                  const c = CHANNEL[o.channel] || { label: o.channel, icon: Utensils, color: "" };
                  return (
                    <TableRow key={o.id} data-testid={`row-comanda-${o.id}`}>
                      <TableCell><Badge className={`${c.color} hover:${c.color}`}><c.icon className="w-3 h-3 mr-1" />{c.label}</Badge></TableCell>
                      <TableCell className="font-medium">{headingFor(o)}</TableCell>
                      <TableCell className="font-mono text-xs">{o.code}</TableCell>
                      <TableCell className="text-sm">{dateTimeBR(o.created_at)}</TableCell>
                      <TableCell className="font-mono">{o.items.length}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{o.operator_name}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{brl(o.total || o.subtotal)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => nav(`/comanda/${o.id}`)} data-testid={`btn-abrir-comanda-${o.id}`}>Abrir</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">Nenhuma comanda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
