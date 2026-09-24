import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { name: "", document: "", email: "", phone: "", address: "" };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin", "gerente");

  const load = () => api.get("/customers", { params: query ? { q: query } : {} }).then(r => setCustomers(r.data));
  useEffect(() => { load(); }, [query]);

  const save = async () => {
    try {
      const payload = { ...form, email: form.email || null };
      if (form.id) await api.put(`/customers/${form.id}`, payload);
      else await api.post("/customers", payload);
      toast.success("Cliente salvo");
      setForm(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Excluir ${c.name}?`)) return;
    try {
      await api.delete(`/customers/${c.id}`);
      toast.success("Cliente excluído");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <Layout>
      <PageHeader
        title="Clientes"
        subtitle={`${customers.length} clientes cadastrados`}
        actions={<Button onClick={() => setForm({ ...empty })} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-novo-cliente"><Plus className="w-4 h-4 mr-1" /> Novo cliente</Button>}
      />

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar por nome, CPF/CNPJ ou telefone..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" data-testid="input-buscar-cliente" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} data-testid={`row-cliente-${c.id}`}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="font-mono text-xs text-slate-500">{c.document || "-"}</TableCell>
                <TableCell className="text-slate-600">{c.email || "-"}</TableCell>
                <TableCell className="text-slate-600">{c.phone || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ ...c })} data-testid={`btn-editar-cliente-${c.id}`}><Pencil className="w-4 h-4" /></Button>
                    {canEdit && <Button size="icon" variant="ghost" onClick={() => remove(c)} className="text-rose-600" data-testid={`btn-excluir-cliente-${c.id}`}><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">Nenhum cliente</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-cliente-nome" />
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input value={form.document || ""} onChange={(e) => setForm({ ...form, document: e.target.value })} data-testid="input-cliente-doc" />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-cliente-telefone" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>E-mail</Label>
                <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-cliente-email" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Endereço</Label>
                <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-cliente-endereco" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-salvar-cliente">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
