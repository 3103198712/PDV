import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { dateTimeBR } from "@/lib/format";
import { Plus, ArrowUpCircle, ArrowDownCircle, Scale } from "lucide-react";

export default function Stock() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);

  const load = () => {
    api.get("/stock/movements").then(r => setMovements(r.data));
    api.get("/products").then(r => setProducts(r.data));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/stock/movements", {
        product_id: form.product_id,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason || null,
      });
      toast.success("Movimentação registrada");
      setForm(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const iconOf = (t) => t === "entrada" ? <ArrowUpCircle className="w-4 h-4 text-emerald-600" /> : t === "saida" ? <ArrowDownCircle className="w-4 h-4 text-rose-600" /> : <Scale className="w-4 h-4 text-amber-600" />;
  const labelOf = (t) => ({ entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" }[t] || t);

  return (
    <Layout>
      <PageHeader
        title="Estoque"
        subtitle="Movimentações e ajustes de inventário"
        actions={<Button onClick={() => setForm({ product_id: "", type: "entrada", quantity: 0, reason: "" })} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-nova-movimentacao"><Plus className="w-4 h-4 mr-1" /> Nova movimentação</Button>}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((m) => (
              <TableRow key={m.id} data-testid={`row-mov-${m.id}`}>
                <TableCell className="text-sm">{dateTimeBR(m.created_at)}</TableCell>
                <TableCell className="font-medium">{m.product_name}</TableCell>
                <TableCell><div className="flex items-center gap-2">{iconOf(m.type)}<Badge variant="outline">{labelOf(m.type)}</Badge></div></TableCell>
                <TableCell className="text-right font-mono font-semibold">{m.quantity}</TableCell>
                <TableCell className="text-slate-600 text-sm">{m.reason}</TableCell>
                <TableCell className="text-slate-600 text-sm">{m.created_by}</TableCell>
              </TableRow>
            ))}
            {movements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">Nenhuma movimentação</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Produto</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger data-testid="select-mov-produto"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger data-testid="select-mov-tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                    <SelectItem value="ajuste">Ajuste (definir estoque)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} data-testid="input-mov-qty" />
              </div>
              <div className="space-y-1">
                <Label>Motivo (opcional)</Label>
                <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="input-mov-motivo" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-salvar-mov">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
