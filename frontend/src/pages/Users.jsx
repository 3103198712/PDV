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
import { roleLabel, dateBR } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const empty = { email: "", password: "", name: "", role: "operador" };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(null);
  const { user: current } = useAuth();

  const load = () => api.get("/users").then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      await api.post("/auth/register", form);
      toast.success("Usuário criado");
      setForm(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (u) => {
    if (!window.confirm(`Excluir ${u.name}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast.success("Usuário excluído");
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const roleColor = (r) => ({
    admin: "bg-purple-100 text-purple-700 hover:bg-purple-100",
    gerente: "bg-blue-100 text-blue-700 hover:bg-blue-100",
    operador: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  }[r]);

  return (
    <Layout>
      <PageHeader
        title="Usuários"
        subtitle={`${users.length} usuários cadastrados`}
        actions={<Button onClick={() => setForm({ ...empty })} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-novo-usuario"><Plus className="w-4 h-4 mr-1" /> Novo usuário</Button>}
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`row-usuario-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-slate-600">{u.email}</TableCell>
                <TableCell><Badge className={roleColor(u.role)}>{roleLabel(u.role)}</Badge></TableCell>
                <TableCell className="text-slate-600 text-sm">{dateBR(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  {u.id !== current?.id && (
                    <Button size="icon" variant="ghost" onClick={() => remove(u)} className="text-rose-600" data-testid={`btn-excluir-user-${u.id}`}><Trash2 className="w-4 h-4" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-user-nome" /></div>
              <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-user-email" /></div>
              <div className="space-y-1"><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="input-user-senha" /></div>
              <div className="space-y-1">
                <Label>Papel</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="operador">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-salvar-user">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
