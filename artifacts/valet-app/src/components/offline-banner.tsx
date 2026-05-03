import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { offlineQueue } from "@/lib/offline-queue";
import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    setPendingCount(offlineQueue.count());
    const interval = setInterval(() => {
      setPendingCount(offlineQueue.count());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setJustReconnected(true);
      const t = setTimeout(() => setJustReconnected(false), 4000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  if (isOnline && pendingCount === 0 && !justReconnected) return null;

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 py-2 px-4 shadow-lg">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>
          Sin conexión
          {pendingCount > 0 && ` — ${pendingCount} ${pendingCount === 1 ? "acción pendiente" : "acciones pendientes"}`}
        </span>
      </div>
    );
  }

  if (justReconnected || pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 py-2 px-4 shadow-lg">
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
        <span>Conectado — sincronizando acciones...</span>
      </div>
    );
  }

  return null;
}
