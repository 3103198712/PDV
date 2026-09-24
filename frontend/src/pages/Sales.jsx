import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { brl, dateTimeBR, paymentLabel } from "@/lib/format";
import { Eye, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [detail, setDetail] = useState(null);
  const { hasRole } = useAuth();

  const load = () => api.get("/sales", { params: { limit: 200 } }).then(r => setSales(r.data));
  useEffect(() => { load(); }, []);

  const cancel = async (s) => {
    if (!window.confirm(`Cancelar venda ${s.code}?`)) return;
    try {
      await api.post(`/sales/${s.id}/cancel`);
      toast.success("Venda cancelada");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <Layout>
      <PageHeader title="Vendas" subtitle={`${sales.length} vendas registradas`} />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Operador</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s) => (
              <TableRow key={s.id} data-testid={`row-venda-${s.id}`}>
                <TableCell className="font-mono text-xs">{s.code}</TableCell>
                <TableCell className="text-sm">{dateTimeBR(s.created_at)}</TableCell>
                <TableCell>{s.customer_name}</TableCell>
                <TableCell className="text-slate-600">{s.operator_name}</TableCell>
                <TableCell><Badge variant="outline">{paymentLabel(s.payment_method)}</Badge></TableCell>
                <TableCell>
                  <Badge className={s.status === "concluida" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-rose-100 text-rose-700 hover:bg-rose-100"}>
                    {s.status === "concluida" ? "Concluída" : "Cancelada"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">{brl(s.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDetail(s)} data-testid={`btn-detalhe-venda-${s.id}`}><Eye className="w-4 h-4" /></Button>
                    {hasRole("admin", "gerente") && s.status === "concluida" && (
                      <Button size="icon" variant="ghost" onClick={() => cancel(s)} className="text-rose-600" data-testid={`btn-cancelar-venda-${s.id}`}><XCircle className="w-4 h-4" /></Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sales.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-500">Nenhuma venda ainda</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-xl" data-testid="modal-detalhe-venda">
          <DialogHeader><DialogTitle>Detalhes da venda {detail?.code}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-500">Cliente:</span> {detail.customer_name}</div>
                <div><span className="text-slate-500">Operador:</span> {detail.operator_name}</div>
                <div><span className="text-slate-500">Data:</span> {dateTimeBR(detail.created_at)}</div>
                <div><span className="text-slate-500">Pagamento:</span> {paymentLabel(detail.payment_method)}</div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Qtd</TableHead><TableHead className="text-right">Preço</TableHead><TableHead className="text-right">Total</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.items.map((it, i) => (
                      <TableRow key={i}>
                        <TableCell>{it.product_name}</TableCell>
                        <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{brl(it.unit_price)}</TableCell>
                        <TableCell className="text-right font-mono">{brl(it.line_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm space-y-1 pt-2 border-t">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{brl(detail.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Desconto</span><span className="font-mono">-{brl(detail.discount)}</span></div>
                <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="font-mono text-emerald-700">{brl(detail.total)}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
