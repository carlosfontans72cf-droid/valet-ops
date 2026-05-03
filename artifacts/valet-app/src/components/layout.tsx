import React from "react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Home, KeySquare, Search, History, Settings, ShieldAlert, Car } from "lucide-react";
import { useGetEventStats, getGetEventStatsQueryKey } from "@workspace/api-client-react";

function CarCounter({ eventId }: { eventId: number }) {
  const { data: stats } = useGetEventStats(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventStatsQueryKey(eventId),
      refetchInterval: 15000,
    },
  });

  if (!stats) return null;

  const total = (stats.totalActive ?? 0) + (stats.totalInTransit ?? 0) + (stats.totalRelocated ?? 0);

  return (
    <div className="flex items-center justify-center gap-2 bg-primary/10 border-b border-primary/20 py-2 px-4">
      <Car className="w-5 h-5 text-primary shrink-0" />
      <span className="text-sm font-bold text-primary">
        {total === 0
          ? "Sin autos en el valet"
          : total === 1
          ? "1 auto en el valet"
          : `${total} autos en el valet`}
      </span>
      {stats.totalInTransit > 0 && (
        <span className="text-xs font-semibold text-yellow-400 ml-1">
          · {stats.totalInTransit} en camino
        </span>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const [location] = useLocation();

  if (!session) {
    return <>{children}</>;
  }

  const { role } = session;

  const ownerEventId = role === "owner"
    ? (localStorage.getItem("owner_event_id") ? parseInt(localStorage.getItem("owner_event_id")!) : null)
    : null;
  const effectiveEventId = role === "owner" ? ownerEventId : (session.eventId ?? null);

  return (
    <div className="min-h-[100dvh] flex flex-col w-full max-w-md mx-auto bg-background text-foreground shadow-2xl relative">
      {effectiveEventId ? <CarCounter eventId={effectiveEventId} /> : null}
      <main className="flex-1 flex flex-col p-4 pb-24 overflow-y-auto">
        {children}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md bg-card border-t border-border flex items-center justify-around p-2 pb-safe z-50">
        <Link href="/" className={`flex flex-col items-center p-2 rounded-lg ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
          <Home className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider">INICIO</span>
        </Link>

        {(role === "driver" || role === "admin") && (
          <>
            <Link href="/work" className={`flex flex-col items-center p-2 rounded-lg ${location === "/work" ? "text-primary" : "text-muted-foreground"}`}>
              <KeySquare className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">TICKETS</span>
            </Link>
            <Link href="/search" className={`flex flex-col items-center p-2 rounded-lg ${location === "/search" ? "text-primary" : "text-muted-foreground"}`}>
              <Search className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">BUSCAR</span>
            </Link>
          </>
        )}

        {role === "admin" && (
          <Link href="/admin" className={`flex flex-col items-center p-2 rounded-lg ${location === "/admin" ? "text-primary" : "text-muted-foreground"}`}>
            <ShieldAlert className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wider">ADMIN</span>
          </Link>
        )}

        {role === "owner" && (
          <>
            <Link href="/work" className={`flex flex-col items-center p-2 rounded-lg ${location === "/work" ? "text-primary" : "text-muted-foreground"}`}>
              <KeySquare className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">TICKETS</span>
            </Link>
            <Link href="/search" className={`flex flex-col items-center p-2 rounded-lg ${location === "/search" ? "text-primary" : "text-muted-foreground"}`}>
              <Search className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">BUSCAR</span>
            </Link>
            <Link href="/history" className={`flex flex-col items-center p-2 rounded-lg ${location === "/history" ? "text-primary" : "text-muted-foreground"}`}>
              <History className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">HISTORIAL</span>
            </Link>
            <Link href="/owner" className={`flex flex-col items-center p-2 rounded-lg ${location === "/owner" ? "text-primary" : "text-muted-foreground"}`}>
              <Settings className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">PANEL</span>
            </Link>
          </>
        )}

        <button onClick={logout} className="flex flex-col items-center p-2 rounded-lg text-muted-foreground">
          <LogOut className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold uppercase tracking-wider">SALIR</span>
        </button>
      </nav>
    </div>
  );
}
