import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import Layout, { PageHeader } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHead, TableRow, TableCell, TableBody, TableHeader } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Printer, Terminal, CheckCircle2, XCircle, Clock } from "lucide-react";
import { dateTimeBR } from "@/lib/format";

const SECTOR_LABEL = {
  cozinha_quente: "Cozinha Quente",
  cozinha_fria: "Cozinha Fria",
  bar: "Bar",
  buffet: "Buffet",
  caixa: "Caixa (cupom final)",
};

const empty = { name: "", sector: "cozinha_quente", ip: "", port: 9100, active: true };

export default function Printers() {
  const [printers, setPrinters] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("impressoras");

  const load = () => {
    api.get("/printers").then((r) => setPrinters(r.data));
    api.get("/print/jobs", { params: { limit: 50 } }).then((r) => setJobs(r.data));
  };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, []);

  const save = async () => {
    try {
      const payload = { ...form, port: Number(form.port) };
      if (form.id) await api.put(`/printers/${form.id}`, payload);
      else await api.post("/printers", payload);
      toast.success("Impressora salva");
      setForm(null);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Excluir ${p.name}?`)) return;
    try { await api.delete(`/printers/${p.id}`); toast.success("Excluída"); load(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  const jobBadge = (status) => {
    const map = {
      pending: <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>,
      done: <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="w-3 h-3 mr-1" />Impresso</Badge>,
      failed: <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100"><XCircle className="w-3 h-3 mr-1" />Falha</Badge>,
    };
    return map[status] || <Badge>{status}</Badge>;
  };

  return (
    <Layout>
      <PageHeader
        title="Impressoras & Fila"
        subtitle="Configure impressoras térmicas de rede por setor e monitore a fila do agente"
        actions={<Button onClick={() => setForm({ ...empty })} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-nova-impressora"><Plus className="w-4 h-4 mr-1" /> Nova impressora</Button>}
      />

      <Card className="p-4 mb-6 bg-slate-50 border-dashed">
        <div className="flex items-start gap-3">
          <Terminal className="w-5 h-5 text-slate-500 mt-0.5" />
          <div className="text-sm text-slate-700 leading-relaxed">
            <div className="font-semibold text-slate-900">Agente local de impressão</div>
            Para imprimir direto nas suas impressoras térmicas de rede, rode o agente Python no PC da rede local. Instruções completas em <code className="bg-white px-1.5 py-0.5 rounded border">/app/print_agent/README.md</code>. O agente faz login com seu usuário, busca a fila e envia via TCP <code className="bg-white px-1.5 py-0.5 rounded border">IP:9100</code>.
          </div>
        </div>
      </Card>

      <div className="border-b mb-4 flex gap-4">
        <button onClick={() => setTab("impressoras")} className={`pb-2 text-sm font-semibold ${tab === "impressoras" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500"}`} data-testid="tab-impressoras">Impressoras ({printers.length})</button>
        <button onClick={() => setTab("fila")} className={`pb-2 text-sm font-semibold ${tab === "fila" ? "border-b-2 border-emerald-600 text-emerald-700" : "text-slate-500"}`} data-testid="tab-fila">Fila de impressão ({jobs.filter(j => j.status === "pending").length})</button>
      </div>

      {tab === "impressoras" && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Porta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((p) => (
                <TableRow key={p.id} data-testid={`row-printer-${p.id}`}>
                  <TableCell className="font-medium"><Printer className="w-4 h-4 inline mr-2 text-slate-400" />{p.name}</TableCell>
                  <TableCell><Badge variant="outline">{SECTOR_LABEL[p.sector]}</Badge></TableCell>
                  <TableCell className="font-mono">{p.ip}</TableCell>
                  <TableCell className="font-mono">{p.port}</TableCell>
                  <TableCell><Badge className={p.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-100"}>{p.active ? "Ativa" : "Desativada"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setForm({ ...p })} data-testid={`btn-edit-printer-${p.id}`}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p)} className="text-rose-600"><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {printers.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">Nenhuma impressora cadastrada. Adicione uma para começar a imprimir por IP.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "fila" && (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criado</TableHead>
                <TableHead>Impressora</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Comanda</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id} data-testid={`row-job-${j.id}`}>
                  <TableCell className="text-xs">{dateTimeBR(j.created_at)}</TableCell>
                  <TableCell>{j.printer_name}</TableCell>
                  <TableCell><Badge variant="outline">{SECTOR_LABEL[j.sector] || j.sector}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{j.order_code}</TableCell>
                  <TableCell className="text-xs">{j.kind}</TableCell>
                  <TableCell>{jobBadge(j.status)}</TableCell>
                  <TableCell className="text-center">{j.attempts}</TableCell>
                </TableRow>
              ))}
              {jobs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-500">Nenhum job na fila</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form?.id ? "Editar" : "Nova"} impressora</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <div className="space-y-1"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-printer-nome" placeholder="Ex: Cozinha Quente 1" /></div>
              <div className="space-y-1">
                <Label>Setor</Label>
                <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                  <SelectTrigger data-testid="select-printer-setor"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cozinha_quente">Cozinha Quente</SelectItem>
                    <SelectItem value="cozinha_fria">Cozinha Fria</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="buffet">Buffet</SelectItem>
                    <SelectItem value="caixa">Caixa (cupom)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>IP</Label><Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} data-testid="input-printer-ip" placeholder="192.168.1.201" /></div>
                <div className="space-y-1"><Label>Porta</Label><Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} data-testid="input-printer-porta" /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="switch-printer-ativa" />
                <Label className="cursor-pointer">Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="btn-salvar-printer">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
