import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

/**
 * Prompt users on Android to add PDV Pro to their home screen.
 * Renders a floating bar on eligible mobile browsers.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      // Only show if user is logged in and on a mobile-ish view
      if (localStorage.getItem("pdvpro_token") && window.innerWidth < 900) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || installed || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3" data-testid="pwa-install-prompt">
      <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center font-extrabold">P</div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">Instalar PDV Pro</div>
        <div className="text-xs text-slate-400">Adicione à tela inicial para virar app do garçom</div>
      </div>
      <Button size="sm" onClick={async () => { deferred.prompt(); await deferred.userChoice; setShow(false); }} className="bg-emerald-500 hover:bg-emerald-600" data-testid="btn-install-pwa">
        <Download className="w-4 h-4 mr-1" /> Instalar
      </Button>
      <button onClick={() => setShow(false)} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
    </div>
  );
}
