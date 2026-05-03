import React, { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogin, useListEvents, getListEventsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CarFront, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { setToken } = useAuth();
  const [, setLocation] = useLocation();

  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [eventId, setEventId] = useState<string>("");
  const codeInputRef = useRef<HTMLInputElement>(null);

  const { data: events, isLoading: isLoadingEvents } = useListEvents({
    query: { queryKey: getListEventsQueryKey() },
  });
  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { toast.error("Código es requerido"); return; }

    try {
      const res = await loginMutation.mutateAsync({
        data: {
          code: code.trim(),
          driverName: driverName.trim() || undefined,
          eventId: eventId ? parseInt(eventId) : undefined,
        },
      });

      setToken(res.sessionToken);
      setLocation("/");
      toast.success("Acceso concedido");
    } catch (err: any) {
      toast.error(err?.message || "Código inválido o error de acceso");
      setCode("");
      codeInputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto bg-background text-foreground p-6 justify-center">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-primary/10 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <CarFront className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight">Valet Ops</h1>
        <p className="text-muted-foreground mt-2">Ingresa tu código de acceso</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Code field — supports letters + numbers */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Código de acceso <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <Input
              ref={codeInputRef}
              type={showCode ? "text" : "password"}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. OWNER2024"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="h-16 text-2xl font-black text-center tracking-widest bg-card border-border rounded-xl pr-14"
              data-testid="input-code"
            />
            <button
              type="button"
              onClick={() => setShowCode((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Driver name */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Nombre (Pilotos)
          </Label>
          <Input
            placeholder="Ej. Juan Pérez"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            className="h-14 text-lg bg-card/50 rounded-xl"
            data-testid="input-driver-name"
          />
        </div>

        {/* Event selector */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Evento (Pilotos / Admin)
          </Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="h-14 text-base bg-card/50 rounded-xl">
              <SelectValue placeholder="Selecciona un evento..." />
            </SelectTrigger>
            <SelectContent>
              {isLoadingEvents ? (
                <SelectItem value="loading" disabled>Cargando...</SelectItem>
              ) : (
                events?.filter((e) => e.isActive).map((event) => (
                  <SelectItem key={event.id} value={event.id.toString()}>
                    {event.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            className="w-full h-16 text-lg font-bold rounded-2xl"
            disabled={loginMutation.isPending || !code.trim()}
            data-testid="btn-login"
          >
            {loginMutation.isPending ? <Loader2 className="animate-spin" /> : "INGRESAR"}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-1">
          Dueño: solo código. Admin/Piloto: código + evento.
        </p>
      </form>
    </div>
  );
}
