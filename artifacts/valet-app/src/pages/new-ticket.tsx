import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { offlineQueue } from "@/lib/offline-queue";
import {
  useCreateTicket,
  useListParkingLocations,
  useListShifts,
  getListTicketsQueryKey,
  getListParkingLocationsQueryKey,
  getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Link } from "wouter";

const KEY_LOCATIONS = [
  { value: "drawer", label: "Llave en Cajón", color: "bg-blue-600 hover:bg-blue-700 text-white border-blue-700" },
  { value: "board", label: "Llave Colgada en Tablero", color: "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700" },
  { value: "not_found", label: "Llave No Encontrada", color: "bg-red-600 hover:bg-red-700 text-white border-red-700" },
  { value: "with_owner", label: "Llave con Dueño", color: "bg-orange-500 hover:bg-orange-600 text-white border-orange-600" },
] as const;

const DAMAGE_OPTIONS = [
  { value: "front_door", label: "Puerta Dañada" },
  { value: "rear_bumper", label: "Paragolpe Trasero" },
  { value: "front_bumper", label: "Paragolpe Delantero" },
  { value: "rear_light", label: "Faro Trasero" },
  { value: "front_light", label: "Faro Delantero" },
  { value: "hood", label: "Capó Dañado" },
];

export default function NewTicket() {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Owner has no eventId in session — read from localStorage (set by /work)
  const effectiveEventId =
    session?.eventId ??
    (localStorage.getItem("owner_event_id")
      ? parseInt(localStorage.getItem("owner_event_id")!)
      : null);

  const [valetNumber, setValetNumber] = useState("");
  const [keyLocation, setKeyLocation] = useState<string>("");
  const [parkingLocationId, setParkingLocationId] = useState<number | null>(null);
  const [damages, setDamages] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: locations, isLoading: locLoading } = useListParkingLocations(
    { eventId: effectiveEventId ?? undefined },
    { query: { enabled: !!effectiveEventId, queryKey: getListParkingLocationsQueryKey({ eventId: effectiveEventId ?? undefined }) } }
  );

  const { data: shifts } = useListShifts(
    { eventId: effectiveEventId || 0 },
    { query: { enabled: !!effectiveEventId, queryKey: getListShiftsQueryKey({ eventId: effectiveEventId || 0 }) } }
  );

  const openShift = shifts?.find((s) => s.isOpen);
  const createTicket = useCreateTicket();
  const isOnline = useOnlineStatus();

  const errors = submitted
    ? {
        valetNumber: !valetNumber.trim() ? "Número de valet es obligatorio" : null,
        keyLocation: !keyLocation ? "Ubicación de llave es obligatoria" : null,
        parkingLocationId: !parkingLocationId ? "Lugar de estacionamiento es obligatorio" : null,
      }
    : { valetNumber: null, keyLocation: null, parkingLocationId: null };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!valetNumber.trim() || !keyLocation || !parkingLocationId) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    if (!effectiveEventId) {
      toast.error("Seleccioná un evento primero desde Tickets");
      return;
    }
    if (!openShift) {
      toast.error("No hay un turno abierto — abrí el turno desde Inicio");
      return;
    }

    const ticketData = {
      eventId: effectiveEventId,
      shiftId: openShift.id,
      valetNumber: valetNumber.trim(),
      driverName: session!.driverName || (session!.role === "owner" ? "Dueño" : "Admin"),
      keyLocation: keyLocation as "drawer" | "board" | "not_found" | "with_owner",
      parkingLocationId,
      vehicleDamages: damages as any,
      notes: notes.trim() || undefined,
      vehicleColor: vehicleColor.trim() || undefined,
      vehicleBrand: vehicleBrand.trim() || undefined,
      licensePlate: licensePlate.trim() || undefined,
    };

    if (!isOnline) {
      offlineQueue.add({ type: "createTicket", payload: ticketData as any, label: `Ticket #${valetNumber.trim()}` });
      toast.info(`Valet #${valetNumber.trim()} guardado sin conexión — se registrará al reconectar`);
      setLocation("/work");
      return;
    }

    try {
      await createTicket.mutateAsync({ data: ticketData });
      queryClient.invalidateQueries({
        queryKey: getListTicketsQueryKey({ eventId: effectiveEventId }),
      });
      toast.success(`Valet #${valetNumber} registrado`);
      setLocation("/work");
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes("409") || err?.message?.includes("duplicate")) {
        toast.error(`El número ${valetNumber} ya está en uso en este evento`);
      } else {
        toast.error(err?.message || "Error al crear el ticket");
      }
    }
  };

  const toggleDamage = (val: string) => {
    setDamages((d) => (d.includes(val) ? d.filter((x) => x !== val) : [...d, val]));
  };

  if (!effectiveEventId) {
    return (
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <Link href="/work">
            <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-black tracking-tight">Nuevo Ticket</h1>
        </div>
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-6 text-center">
          <p className="text-yellow-400 font-bold">Seleccioná un evento primero</p>
          <p className="text-sm text-muted-foreground mt-2">
            Ve a la sección Tickets y elegí el evento antes de registrar un valet.
          </p>
          <Button
            onClick={() => setLocation("/work")}
            className="mt-4 h-12 font-bold rounded-xl"
          >
            Ir a Tickets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex items-center gap-3 pt-1">
        <Link href="/work">
          <Button variant="ghost" size="icon" className="rounded-xl h-12 w-12">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-black tracking-tight">Nuevo Ticket</h1>
      </div>

      {!openShift && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
          <p className="text-yellow-400 text-sm font-bold">
            Turno cerrado — abrí el turno desde Inicio para registrar
          </p>
        </div>
      )}

      {/* Valet Number */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          Número de Valet <span className="text-red-500">*</span>
        </label>
        <Input
          type="number"
          inputMode="numeric"
          value={valetNumber}
          onChange={(e) => setValetNumber(e.target.value)}
          placeholder="Ej. 42"
          className="h-16 text-3xl font-black text-center bg-card border-border rounded-xl"
          data-testid="input-valet-number"
          autoFocus
        />
        {errors.valetNumber && (
          <div className="flex items-center gap-1 text-red-500 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> {errors.valetNumber}
          </div>
        )}
      </div>

      {/* Key Location */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          Ubicación de Llave <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {KEY_LOCATIONS.map((loc) => (
            <button
              key={loc.value}
              type="button"
              onClick={() => setKeyLocation(loc.value)}
              data-testid={`btn-key-${loc.value}`}
              className={`h-16 rounded-xl font-bold text-sm border-2 transition-all active:scale-95 ${
                keyLocation === loc.value
                  ? loc.color + " ring-2 ring-offset-2 ring-offset-background ring-white/30 scale-[1.02]"
                  : "bg-card border-border text-foreground hover:bg-accent"
              }`}
            >
              {loc.label}
            </button>
          ))}
        </div>
        {errors.keyLocation && (
          <div className="flex items-center gap-1 text-red-500 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> {errors.keyLocation}
          </div>
        )}
      </div>

      {/* Parking Location */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          Estacionamiento <span className="text-red-500">*</span>
        </label>
        {locLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {locations?.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => setParkingLocationId(loc.id)}
                data-testid={`btn-parking-${loc.id}`}
                className="h-16 rounded-xl font-bold text-sm border-2 transition-all active:scale-95"
                style={{
                  backgroundColor: parkingLocationId === loc.id ? loc.colorHex : "transparent",
                  borderColor: parkingLocationId === loc.id ? loc.colorHex : "hsl(var(--border))",
                  color: parkingLocationId === loc.id ? "#fff" : "hsl(var(--foreground))",
                  boxShadow: parkingLocationId === loc.id ? `0 0 0 3px ${loc.colorHex}44` : "none",
                }}
              >
                <span className="block leading-tight px-2">{loc.name}</span>
                <span className="block text-xs opacity-75 mt-0.5">
                  {loc.currentCount}/{loc.capacity}
                </span>
              </button>
            ))}
          </div>
        )}
        {errors.parkingLocationId && (
          <div className="flex items-center gap-1 text-red-500 text-sm font-medium">
            <AlertCircle className="w-4 h-4" /> {errors.parkingLocationId}
          </div>
        )}
      </div>

      {/* Vehicle Damage */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Daños del Vehículo (opcional)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {DAMAGE_OPTIONS.map((dmg) => (
            <button
              key={dmg.value}
              type="button"
              onClick={() => toggleDamage(dmg.value)}
              data-testid={`btn-damage-${dmg.value}`}
              className={`h-14 rounded-xl font-semibold text-sm border-2 transition-all active:scale-95 ${
                damages.includes(dmg.value)
                  ? "bg-red-600 border-red-700 text-white ring-2 ring-red-500/30"
                  : "bg-card border-border text-foreground hover:bg-red-500/10 hover:border-red-500/40"
              }`}
            >
              {dmg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Datos del Vehículo (opcional)
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Color</span>
            <Input
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
              placeholder="Ej. Rojo"
              className="h-12 bg-card border-border rounded-xl"
              data-testid="input-vehicle-color"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Marca / Modelo</span>
            <Input
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
              placeholder="Ej. Toyota Corolla"
              className="h-12 bg-card border-border rounded-xl"
              data-testid="input-vehicle-brand"
            />
          </div>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Patente</span>
          <Input
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="Ej. ABC123"
            className="h-12 bg-card border-border rounded-xl font-mono tracking-widest"
            data-testid="input-license-plate"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Observaciones (opcional)
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Rayones, daños adicionales, etc."
          className="bg-card border-border rounded-xl min-h-[80px]"
          data-testid="input-notes"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={createTicket.isPending}
        className="w-full h-16 text-lg font-black rounded-xl bg-primary hover:bg-primary/90"
        data-testid="btn-submit-ticket"
      >
        {createTicket.isPending ? <Loader2 className="animate-spin" /> : "REGISTRAR VALET"}
      </Button>
    </div>
  );
}
