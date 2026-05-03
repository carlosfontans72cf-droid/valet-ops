import React from "react";
import { useAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Home, KeySquare, Search, History, Settings, ShieldAlert } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const [location] = useLocation();

  if (!session) {
    return <>{children}</>;
  }

  const { role } = session;

  return (
    <div className="min-h-[100dvh] flex flex-col w-full max-w-md mx-auto bg-background text-foreground shadow-2xl relative">
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
