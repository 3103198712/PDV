import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { name: "", barcode: "", category: "Geral", cost_price: 0, sale_price: 0, stock: 0, min_stock: 5, active: true };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "gerente");

  const load = () => api.get("/products", { params: query ? { q: query } : {} }).then((r) => setProducts(r.data));
  useEffect(() => { load(); }, [query]);

  const openNew = () => setForm({ ...empty });
  const openEdit = (p) => setForm({ ...p });

  const save = async () => {
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
        stock: Number(form.stock),
        min_stock: Number(form.min_stock),
      };
      if (form.id) await api.put(`/products/${form.id}`, payload);
      else await api.post("/products", payload);
      toast.success("Produto salvo");
      setForm(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Excluir ${p.name}?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Produto excluído");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <Layout>
      <PageHeader
        title="Produtos"
        subtitle={`${products.length} produtos cadastrados`}
        actions={canEdit && <Button onClick={openNew} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-novo-produto"><Plus className="w-4 h-4 mr-1" /> Novo produto</Button>}
      />

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar por nome, categoria ou código de barras..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" data-testid="input-buscar-produto" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Código</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} data-testid={`table-produtos-row-${p.id}`}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{p.category}</Badge></TableCell>
                <TableCell className="font-mono text-xs text-slate-500">{p.barcode || "-"}</TableCell>
                <TableCell className="text-right font-mono text-slate-500">{brl(p.cost_price)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{brl(p.sale_price)}</TableCell>
                <TableCell className="text-right">
                  <Badge className={p.stock === 0 ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : p.stock <= p.min_stock ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>
                    {p.stock}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`btn-editar-${p.id}`}><Pencil className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p)} className="text-rose-600 hover:text-rose-700" data-testid={`btn-excluir-${p.id}`}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500">Nenhum produto encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg" data-testid="modal-produto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-produto-nome" />
              </div>
              <div className="space-y-1">
                <Label>Categoria</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="input-produto-categoria" />
              </div>
              <div className="space-y-1">
                <Label>Código de barras</Label>
                <Input value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} data-testid="input-produto-barcode" />
              </div>
              <div className="space-y-1">
                <Label>Preço de custo</Label>
                <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} data-testid="input-produto-custo" />
              </div>
              <div className="space-y-1">
                <Label>Preço de venda</Label>
                <Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} data-testid="input-produto-preco" />
              </div>
              <div className="space-y-1">
                <Label>Estoque</Label>
                <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} data-testid="input-produto-estoque" />
              </div>
              <div className="space-y-1">
                <Label>Estoque mínimo</Label>
                <Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} data-testid="input-produto-min" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-salvar-produto">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
