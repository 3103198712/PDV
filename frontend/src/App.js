import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import PDV from "@/pages/PDV";
import Products from "@/pages/Products";
import Customers from "@/pages/Customers";
import Sales from "@/pages/Sales";
import Stock from "@/pages/Stock";
import Reports from "@/pages/Reports";
import Users from "@/pages/Users";

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/pdv" element={<Protected><PDV /></Protected>} />
            <Route path="/vendas" element={<Protected><Sales /></Protected>} />
            <Route path="/produtos" element={<Protected><Products /></Protected>} />
            <Route path="/estoque" element={<Protected roles={["admin", "gerente"]}><Stock /></Protected>} />
            <Route path="/clientes" element={<Protected><Customers /></Protected>} />
            <Route path="/relatorios" element={<Protected roles={["admin", "gerente"]}><Reports /></Protected>} />
            <Route path="/usuarios" element={<Protected roles={["admin"]}><Users /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
