import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useSearchTicketByValetNumber,
  useUpdateTicket,
  useDeleteTicket,
  useListParkingLocations,
  getSearchTicketByValetNumberQueryKey,
  getListTicketsQueryKey,
  getListParkingLocationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search as SearchIcon, Key, MapPin, Loader2, AlertCircle, Trash2 } from "lucide-react";

const KEY_LABELS: Record<string, { label: string; color: string }> = {
  drawer: { label: "Llave en Cajón", color: "bg-blue-600 text-white" },
  board: { label: "Llave Colgada en Tablero", color: "bg-emerald-600 text-white" },
  not_found: { label: "Llave No Encontrada", color: "bg-red-600 text-white" },
  with_owner: { label: "Llave con Dueño", color: "bg-orange-500 text-white" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-primary/20 text-primary border border-primary/40" },
  in_transit: { label: "En Camino", color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40" },
  relocated: { label: "Reubicado", color: "bg-blue-500/20 text-blue-400 border border-blue-500/40" },
  delivered: { label: "Entregado", color: "bg-green-500/20 text-green-400 border border-green-500/40" },
};

export default function Search() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  // Owner has no eventId in session — read from localStorage (set by /work)
  const effectiveEventId =
    session?.eventId ??
    (localStorage.getItem("owner_event_id")
      ? parseInt(localStorage.getItem("owner_event_id")!)
      : null);

  const [input, setInput] = useState("");
  const [searchedNumber, setSearchedNumber] = useState<string | null>(null);
  const [relocateMode, setRelocateMode] = useState(false);

  const { data: ticket, isLoading, error } = useSearchTicketByValetNumber(
    searchedNumber || "",
    { eventId: effectiveEventId || 0 },
    {
      query: {
        enabled: !!searchedNumber && !!effectiveEventId,
        queryKey: getSearchTicketByValetNumberQueryKey(searchedNumber || "", {
          eventId: effectiveEventId || 0,
        }),
        retry: false,
      },
    }
  );

  const { data: locations } = useListParkingLocations(
    { eventId: effectiveEventId ?? undefined },
    { query: { enabled: relocateMode, queryKey: getListParkingLocationsQueryKey({ eventId: effectiveEventId ?? undefined }) } }
  );

  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const canDelete = session?.role === "owner" || session?.role === "admin";

  const handleDelete = async () => {
    if (!ticket) return;
    if (!window.confirm(`¿Borrar el ticket #${ticket.valetNumber}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteTicket.mutateAsync({ ticketId: ticket.id });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey({ eventId: effectiveEventId || 0 }) });
      toast.success(`Ticket #${ticket.valetNumber} eliminado`);
      setSearchedNumber(null);
      setInput("");
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  };

  const handleSearch = () => {
    if (!input.trim()) return;
    setSearchedNumber(input.trim());
    setRelocateMode(false);
  };

  const handleAction = async (status: "in_transit" | "delivered" | "relocated", relocateId?: number) => {
    if (!ticket) return;
    try {
      await updateTicket.mutateAsync({
        ticketId: ticket.id,
        data: {
          status,
          ...(relocateId ? { relocatedToLocationId: relocateId } : {}),
        },
      });
      queryClient.invalidateQueries({
        queryKey: getListTicketsQueryKey({ eventId: effectiveEventId || 0 }),
      });
      queryClient.invalidateQueries({
        queryKey: getSearchTicketByValetNumberQueryKey(searchedNumber || "", {
          eventId: effectiveEventId || 0,
        }),
      });
      toast.success(
        status === "delivered"
          ? `Valet #${ticket.valetNumber} entregado`
          : status === "in_transit"
          ? `Valet #${ticket.valetNumber} en camino`
          : `Valet #${ticket.valetNumber} reubicado`
      );
      if (status === "delivered") {
        setSearchedNumber(null);
        setInput("");
      }
      setRelocateMode(false);
    } catch (err: any) {
      toast.error(err?.message || "Error al actualizar");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black tracking-tight pt-1">Buscar Vehículo</h1>

      {/* Search input */}
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Número de valet..."
          className="h-16 text-2xl font-bold text-center bg-card border-border rounded-xl"
          data-testid="input-search-valet"
        />
        <Button
          onClick={handleSearch}
          className="h-16 w-16 rounded-xl shrink-0"
          data-testid="btn-search"
        >
          <SearchIcon className="w-6 h-6" />
        </Button>
      </div>

      {/* ── RESULTADO: aparece aquí, antes del teclado ── */}
      {isLoading && (
        <div className="flex justify-center p-6">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !isLoading && searchedNumber && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-5 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="font-bold text-destructive">Valet #{searchedNumber} no encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Verifica el número e intenta de nuevo</p>
        </div>
      )}

      {ticket && !isLoading && (
        <div className="space-y-3">
          {/* Result header - always visible at top */}
          <div className="rounded-xl bg-card border border-border overflow-hidden">
            <div className="bg-primary/10 border-b border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    VALET
                  </p>
                  <p className="text-5xl font-black tracking-tighter" data-testid="text-result-valet-number">
                    #{ticket.valetNumber}
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${STATUS_LABELS[ticket.status]?.color}`}>
                  {STATUS_LABELS[ticket.status]?.label}
                </div>
              </div>
            </div>

            {/* Key Location - prominent */}
            <div className="p-4 border-b border-border" data-testid="text-result-key-location">
              <div className="flex items-center gap-2 mb-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Llave
                </span>
              </div>
              <div className={`inline-flex px-4 py-2 rounded-xl font-bold text-base ${KEY_LABELS[ticket.keyLocation]?.color}`}>
                {KEY_LABELS[ticket.keyLocation]?.label}
              </div>
            </div>

            {/* Vehicle info */}
            {(ticket.vehicleBrand || ticket.vehicleColor || ticket.licensePlate) && (
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Vehículo
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ticket.vehicleBrand && (
                    <span className="text-sm font-semibold bg-card border border-border rounded-lg px-3 py-1">
                      {ticket.vehicleBrand}
                    </span>
                  )}
                  {ticket.vehicleColor && (
                    <span className="text-sm font-semibold bg-card border border-border rounded-lg px-3 py-1">
                      {ticket.vehicleColor}
                    </span>
                  )}
                  {ticket.licensePlate && (
                    <span className="text-sm font-mono font-bold bg-card border border-border rounded-lg px-3 py-1 tracking-widest">
                      {ticket.licensePlate}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Parking location - prominent */}
            <div className="p-4" data-testid="text-result-parking-location">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Estacionamiento
                </span>
              </div>
              <p className="text-xl font-bold">
                {ticket.relocatedToLocationName || ticket.parkingLocationName || "—"}
              </p>
              {ticket.relocatedToLocationName && (
                <p className="text-sm text-muted-foreground mt-1">
                  (Reubicado desde {ticket.parkingLocationName})
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          {ticket.status !== "delivered" && (
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={() => handleAction("in_transit")}
                disabled={ticket.status === "in_transit" || updateTicket.isPending}
                className="h-14 font-bold text-base rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black active:scale-95"
                data-testid="btn-in-transit"
              >
                AUTO EN CAMINO
              </Button>
              <Button
                onClick={() => handleAction("delivered")}
                disabled={updateTicket.isPending}
                className="h-14 font-bold text-base rounded-xl bg-green-600 hover:bg-green-700 text-white active:scale-95"
                data-testid="btn-delivered"
              >
                AUTO ENTREGADO
              </Button>
              <Button
                onClick={() => setRelocateMode(!relocateMode)}
                variant="outline"
                className="h-14 font-bold text-base rounded-xl active:scale-95"
                data-testid="btn-relocate"
              >
                AUTO REUBICADO
              </Button>
            </div>
          )}

          {/* Delete ticket button — owner/admin only */}
          {canDelete && (
            <Button
              onClick={handleDelete}
              disabled={deleteTicket.isPending}
              variant="outline"
              className="w-full h-12 font-bold text-sm rounded-xl border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 active:scale-95"
              data-testid="btn-delete-ticket"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              BORRAR TICKET
            </Button>
          )}

          {/* Relocation picker */}
          {relocateMode && locations && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Seleccionar nuevo estacionamiento:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {locations
                  .filter((l) => l.id !== ticket.parkingLocationId)
                  .map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => handleAction("relocated", loc.id)}
                      disabled={updateTicket.isPending}
                      className="h-14 rounded-xl font-bold text-sm text-white active:scale-95 transition-all"
                      style={{ backgroundColor: loc.colorHex }}
                      data-testid={`btn-relocate-to-${loc.id}`}
                    >
                      {loc.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Additional info */}
          {ticket.vehicleDamages && ticket.vehicleDamages.length > 0 && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-1">
                Daños registrados
              </p>
              <p className="text-sm text-red-300">
                {ticket.vehicleDamages.join(", ")}
              </p>
            </div>
          )}

          {ticket.notes && (
            <div className="rounded-xl bg-card border border-border p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Observaciones
              </p>
              <p className="text-sm">{ticket.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Numeric keypad — siempre visible abajo para escribir rápido */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setInput((v) => v + n)}
            className="h-14 rounded-xl bg-card border border-border font-bold text-xl active:scale-95 transition-transform"
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setInput("")}
          className="h-14 rounded-xl bg-card border border-border font-bold text-sm text-muted-foreground active:scale-95 transition-transform"
        >
          LIMPIAR
        </button>
        <button
          type="button"
          onClick={() => setInput((v) => v + "0")}
          className="h-14 rounded-xl bg-card border border-border font-bold text-xl active:scale-95 transition-transform"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setInput((v) => v.slice(0, -1))}
          className="h-14 rounded-xl bg-card border border-border font-bold text-sm text-red-400 active:scale-95 transition-transform"
        >
          DEL
        </button>
      </div>
    </div>
  );
}
