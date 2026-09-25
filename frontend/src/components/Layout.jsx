import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/format";
import {
  LayoutDashboard, ShoppingCart, Package, Users, Warehouse,
  BarChart3, UserCog, LogOut, Receipt, Store, Utensils, ClipboardList,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-dashboard" },
  { to: "/mesas", icon: Utensils, label: "Salão · Mesas", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-mesas" },
  { to: "/comandas", icon: ClipboardList, label: "Comandas", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-comandas" },
  { to: "/pdv", icon: ShoppingCart, label: "Balcão (Rápido)", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-pdv" },
  { to: "/vendas", icon: Receipt, label: "Vendas", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-vendas" },
  { to: "/produtos", icon: Package, label: "Produtos", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-produtos" },
  { to: "/estoque", icon: Warehouse, label: "Estoque", roles: ["admin", "gerente"], testid: "sidebar-nav-estoque" },
  { to: "/clientes", icon: Users, label: "Clientes", roles: ["admin", "gerente", "operador"], testid: "sidebar-nav-clientes" },
  { to: "/relatorios", icon: BarChart3, label: "Relatórios", roles: ["admin", "gerente"], testid: "sidebar-nav-relatorios" },
  { to: "/usuarios", icon: UserCog, label: "Usuários", roles: ["admin"], testid: "sidebar-nav-usuarios" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className="w-64 shrink-0 fixed top-0 left-0 h-screen flex flex-col text-slate-300"
        style={{ backgroundColor: "hsl(var(--sidebar-bg))" }}
        data-testid="sidebar"
      >
        <div className="px-6 py-6 border-b border-slate-800/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Store className="w-5 h-5 text-emerald-400" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-white font-bold text-lg tracking-tight">PDV Pro</div>
              <div className="text-xs text-slate-500">Gestão de Vendas</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.filter(n => n.roles.includes(user?.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              data-testid={n.testid}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <n.icon className="w-[18px] h-[18px]" strokeWidth={2} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800/70">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold text-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate" data-testid="user-name">{user?.name}</div>
              <div className="text-xs text-emerald-400 uppercase tracking-wider font-medium" data-testid="user-role-badge">{roleLabel(user?.role)}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
              data-testid="btn-logout"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900" data-testid="page-title">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
