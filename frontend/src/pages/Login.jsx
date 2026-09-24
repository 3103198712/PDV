import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { formatApiError } from "@/lib/api";
import { Store, ShoppingBag, TrendingUp, Package } from "lucide-react";

const QUICK = [
  { role: "admin", email: "admin@pdvpro.com", password: "admin123", label: "Admin" },
  { role: "gerente", email: "gerente@pdvpro.com", password: "gerente123", label: "Gerente" },
  { role: "operador", email: "operador@pdvpro.com", password: "operador123", label: "Operador" },
];

export default function Login() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bem-vindo!");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u) => {
    setLoading(true);
    try {
      await login(u.email, u.password);
      toast.success(`Entrando como ${u.label}`);
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 text-white overflow-hidden"
        style={{ backgroundColor: "hsl(222 47% 11%)" }}>
        <div className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, #10b98155 0%, transparent 40%), radial-gradient(circle at 80% 80%, #3b82f633 0%, transparent 40%)",
          }} />
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Store className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-xl">PDV Pro</div>
            <div className="text-xs text-slate-400">Sistema completo de gestão</div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
            Toda a operação do seu <span className="text-emerald-400">PDV</span> em um só lugar.
          </h2>
          <p className="text-slate-400 max-w-md leading-relaxed">
            Frente de caixa rápida, gestão de estoque, relatórios em tempo real e controle total de vendas e clientes.
          </p>

          <div className="grid grid-cols-3 gap-3 pt-6">
            {[
              { icon: ShoppingBag, label: "Frente de Caixa" },
              { icon: Package, label: "Estoque" },
              { icon: TrendingUp, label: "Relatórios" },
            ].map((f) => (
              <div key={f.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <f.icon className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-xs font-medium text-slate-300">{f.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © 2026 PDV Pro · Todos os direitos reservados
        </div>
      </div>

      {/* Right login form */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Bem-vindo de volta</h1>
            <p className="text-slate-500 mt-2">Acesse sua conta para continuar</p>
          </div>

          <Card className="p-6 shadow-sm">
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="login-input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="login-input-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
                data-testid="login-form-submit-button"
              >
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Card>

          <div className="mt-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Acesso rápido de teste</div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.map((u) => (
                <button
                  key={u.role}
                  onClick={() => quickLogin(u)}
                  disabled={loading}
                  className="p-3 rounded-lg border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-sm text-sm font-medium text-slate-700 hover:text-emerald-700 transition"
                  data-testid={`quick-login-${u.role}`}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
