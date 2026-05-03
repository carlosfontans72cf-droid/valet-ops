import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { offlineQueue } from "@/lib/offline-queue";
import {
  useListTickets,
  useUpdateTicket,
  useDeleteTicket,
  useListEvents,
  useListShifts,
  useListParkingLocations,
  useGetTicketMovements,
  getListTicketsQueryKey,
  getListEventsQueryKey,
  getListShiftsQueryKey,
  getListParkingLocationsQueryKey,
  getGetTicketMovementsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Car, Key, MapPin, Trash2, History, ParkingCircle, ArrowRight, CheckCircle, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ACTION_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  parked:     { label: "Estacionado",  color: "text-primary",    Icon: ParkingCircle },
  in_transit: { label: "En camino",    color: "text-yellow-400", Icon: Navigation },
  relocated:  { label: "Reubicado",    color: "text-blue-400",   Icon: ArrowRight },
  delivered:  { label: "Entregado",    color: "text-green-400",  Icon: CheckCircle },
};

function MovementLog({ ticketId }: { ticketId: number }) {
  const { data: movements, isLoading } = useGetTicketMovements(ticketId, {
    query: {
      queryKey: getGetTicketMovementsQueryKey(ticketId),
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="animate-spin w-4 h-4 text-muted-foreground" />
      </div>
    );
  }

  if (!movements || movements.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">Sin movimientos registrados</p>
    );
  }

  return (
    <div className="space-y-2">
      {movements.map((mov) => {
        const cfg = ACTION_CONFIG[mov.action] ?? { label: mov.action, color: "text-muted-foreground", Icon: History };
        const { label, color, Icon } = cfg;
        return (
          <div key={mov.id} className="flex items-start gap-2">
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-bold ${color}`}>{label}</span>
              <span className="text-xs text-foreground font-semibold"> · {mov.performedBy}</span>
              {mov.locationName && (
                <span className="text-xs text-muted-foreground"> → {mov.locationName}</span>
              )}
              <p className="text-[10px] text-muted-foreground">
                {new Date(mov.createdAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {new Date(mov.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const KEY_COLORS: Record<string, string> = {
  drawer: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  board: "text-green-400 bg-green-500/10 border-green-500/30",
  not_found: "text-red-400 bg-red-500/10 border-red-500/30",
  with_owner: "text-orange-400 bg-orange-500/10 border-orange-500/30",
};

const KEY_LABELS: Record<string, string> = {
  drawer: "Cajón",
  board: "Tablero",
  not_found: "No Encontrada",
  with_owner: "Con Dueño",
};

const STATUS_BAR: Record<string, string> = {
  active: "bg-primary/20 border-l-4 border-l-primary",
  in_transit: "bg-yellow-500/10 border-l-4 border-l-yellow-400",
  relocated: "bg-blue-500/10 border-l-4 border-l-blue-400",
};

const STATUS_LABEL: Record<string, string> = {
  in_transit: "EN CAMINO",
  relocated: "REUBICADO",
};

export default function Work() {
  const { session } = useAuth();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(
    session?.eventId ?? null
  );
  const [relocatingTicketId, setRelocatingTicketId] = useState<number | null>(null);
  const [expandedLogTicketId, setExpandedLogTicketId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const isOwner = session?.role === "owner";
  const effectiveEventId = isOwner ? selectedEventId : (session?.eventId ?? null);

  const { data: events } = useListEvents({
    query: { enabled: isOwner, queryKey: getListEventsQueryKey() },
  });

  const saveOwnerEvent = (id: number) => {
    localStorage.setItem("owner_event_id", String(id));
    setSelectedEventId(id);
  };

  const { data: shifts } = useListShifts(
    { eventId: effectiveEventId || 0 },
    { query: { enabled: !!effectiveEventId, queryKey: getListShiftsQueryKey({ eventId: effectiveEventId || 0 }) } }
  );
  const openShift = shifts?.find((s) => s.isOpen);

  const ticketParams = { eventId: effectiveEventId || 0 };
  const { data: tickets, isLoading } = useListTickets(
    ticketParams,
    {
      query: {
        enabled: !!effectiveEventId,
        queryKey: getListTicketsQueryKey(ticketParams),
        refetchInterval: 15000,
      },
    }
  );

  const { data: locations } = useListParkingLocations(
    { eventId: effectiveEventId ?? undefined },
    {
      query: {
        enabled: !!effectiveEventId && relocatingTicketId !== null,
        queryKey: getListParkingLocationsQueryKey({ eventId: effectiveEventId ?? undefined }),
      },
    }
  );

  const isOnline = useOnlineStatus();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const canDelete = session?.role === "owner" || session?.role === "admin";

  const handleDelete = async (ticketId: number, valetNumber: string) => {
    if (!window.confirm(`¿Borrar el ticket #${valetNumber}? Esta acción no se puede deshacer.`)) return;
    if (!isOnline) {
      offlineQueue.add({ type: "deleteTicket", payload: { ticketId }, label: `Borrar ticket #${valetNumber}` });
      toast.info("Sin conexión — acción guardada, se sincronizará al reconectar");
      return;
    }
    try {
      await deleteTicket.mutateAsync({ ticketId });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey(ticketParams) });
      toast.success(`Ticket #${valetNumber} eliminado`);
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
  };

  const handleAction = async (
    ticketId: number,
    status: "in_transit" | "delivered" | "relocated",
    relocateLocationId?: number,
    valetNumber?: string
  ) => {
    if (!isOnline) {
      offlineQueue.add({
        type: "updateTicket",
        payload: { ticketId, data: { status, ...(relocateLocationId ? { relocatedToLocationId: relocateLocationId } : {}) } },
        label: `Estado #${valetNumber ?? ticketId}: ${status}`,
      });
      if (status === "delivered") toast.info("Sin conexión — entrega guardada, se sincronizará al reconectar");
      else if (status === "in_transit") toast.info("Sin conexión — estado guardado, se sincronizará al reconectar");
      else toast.info("Sin conexión — reubicación guardada, se sincronizará al reconectar");
      setRelocatingTicketId(null);
      return;
    }
    try {
      await updateTicket.mutateAsync({
        ticketId,
        data: {
          status,
          ...(relocateLocationId ? { relocatedToLocationId: relocateLocationId } : {}),
        },
      });
      queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey(ticketParams) });
      if (status === "delivered") toast.success("Auto entregado ✓");
      else if (status === "in_transit") toast.success("Auto en camino 🚗");
      else toast.success("Auto reubicado 📍");
      setRelocatingTicketId(null);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    }
  };

  const filteredTickets = tickets?.filter((t) =>
    searchTerm.trim() === "" || t.valetNumber === searchTerm.trim()
  ) ?? [];

  // Owner: event picker if no event selected
  if (isOwner && !selectedEventId) {
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-2xl font-black tracking-tight">Tickets Activos</h1>
        <p className="text-sm text-muted-foreground">
          Seleccioná el evento que querés ver:
        </p>
        <div className="space-y-2">
          {events
            ?.filter((e) => e.isActive)
            .map((event) => (
              <button
                key={event.id}
                onClick={() => saveOwnerEvent(event.id)}
                className="w-full h-16 rounded-xl bg-card border border-border font-bold text-left px-5 hover:bg-accent transition-colors active:scale-[0.99]"
              >
                {event.name}
                <span className="block text-sm font-normal text-muted-foreground">
                  {event.eventDate}
                </span>
              </button>
            ))}
          {events?.filter((e) => e.isActive).length === 0 && (
            <p className="text-center text-muted-foreground p-8">
              No hay eventos activos. Creá uno desde el Panel.
            </p>
          )}
        </div>
      </div>
    );
  }

  const shiftWarning = effectiveEventId && !openShift && !isLoading;

  return (
    <div className="space-y-3">
      {/* Event selector for owner */}
      {isOwner && (
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-black tracking-tight truncate">
            {events?.find((e) => e.id === selectedEventId)?.name ?? "Tickets"}
          </h1>
          <button
            onClick={() => setSelectedEventId(null)}
            className="text-xs text-muted-foreground underline ml-2 shrink-0"
          >
            Cambiar
          </button>
        </div>
      )}

      {shiftWarning && (
        <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 text-center">
          <p className="text-yellow-400 text-sm font-bold">
            Turno cerrado — abrí el turno desde Inicio para registrar tickets
          </p>
        </div>
      )}

      {/* Search + add button */}
      <div className="flex gap-2 sticky top-0 bg-background pt-1 pb-3 z-10">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por número..."
            className="pl-10 h-14 text-lg bg-card/50 rounded-2xl"
          />
        </div>
        <Button
          onClick={() => setLocation("/new-ticket")}
          className="h-14 w-14 rounded-2xl shrink-0"
          data-testid="btn-new-ticket"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {/* Ticket list */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
          <Car className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium text-lg">No hay tickets activos</p>
          <p className="text-sm">
            Tocá <strong>+</strong> para registrar el primer valet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const isRelocating = relocatingTicketId === ticket.id;
            const statusBar = STATUS_BAR[ticket.status] ?? "";
            const statusLabel = STATUS_LABEL[ticket.status];
            return (
              <div
                key={ticket.id}
                className={`border border-border rounded-2xl overflow-hidden shadow-sm ${statusBar}`}
                data-testid={`ticket-${ticket.id}`}
              >
                {/* Status strip */}
                {statusLabel && (
                  <div className={`px-4 py-1 text-[10px] font-black uppercase tracking-widest ${
                    ticket.status === "in_transit" ? "text-yellow-400" : "text-blue-400"
                  }`}>
                    ● {statusLabel}
                  </div>
                )}

                {/* Ticket info */}
                <div className="px-4 pb-3 pt-2 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      TICKET
                    </span>
                    <p className="text-4xl font-black tracking-tighter leading-none">
                      {ticket.valetNumber}
                    </p>
                    {ticket.driverName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {ticket.driverName}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(ticket.id, ticket.valetNumber)}
                        disabled={deleteTicket.isPending}
                        className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                        title="Borrar ticket"
                        data-testid={`btn-delete-${ticket.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs px-2 py-1 uppercase font-bold tracking-wider ${KEY_COLORS[ticket.keyLocation] ?? ""}`}
                    >
                      <Key className="w-3 h-3 mr-1 inline" />
                      {KEY_LABELS[ticket.keyLocation] ?? ticket.keyLocation}
                    </Badge>
                    {(ticket.parkingLocationName || ticket.relocatedToLocationName) && (
                      <Badge
                        variant="outline"
                        className="text-xs px-2 py-1 uppercase font-bold tracking-wider bg-card"
                      >
                        <MapPin className="w-3 h-3 mr-1 inline text-muted-foreground" />
                        {ticket.relocatedToLocationName ?? ticket.parkingLocationName}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Vehicle info */}
                {(ticket.vehicleBrand || ticket.vehicleColor || ticket.licensePlate) && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {ticket.vehicleBrand && (
                      <span className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-2 py-0.5">
                        {ticket.vehicleBrand}
                      </span>
                    )}
                    {ticket.vehicleColor && (
                      <span className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-2 py-0.5">
                        {ticket.vehicleColor}
                      </span>
                    )}
                    {ticket.licensePlate && (
                      <span className="text-xs font-mono font-bold bg-card border border-border rounded-lg px-2 py-0.5">
                        {ticket.licensePlate}
                      </span>
                    )}
                  </div>
                )}

                {/* Historial de movimientos */}
                <div className="border-t border-border">
                  <button
                    onClick={() => setExpandedLogTicketId(expandedLogTicketId === ticket.id ? null : ticket.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    <History className="w-3 h-3" />
                    {expandedLogTicketId === ticket.id ? "Ocultar historial" : "Ver historial"}
                  </button>
                  {expandedLogTicketId === ticket.id && (
                    <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-border/50">
                      <MovementLog ticketId={ticket.id} />
                    </div>
                  )}
                </div>

                {/* Action buttons — 3 in a row */}
                <div className="grid grid-cols-3 gap-0 border-t border-border">
                  <button
                    onClick={() => handleAction(ticket.id, "in_transit", undefined, ticket.valetNumber)}
                    disabled={ticket.status === "in_transit" || updateTicket.isPending}
                    className="py-3.5 font-bold text-xs uppercase tracking-wide text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 active:scale-95 transition-all disabled:opacity-30 border-r border-border"
                    data-testid={`btn-in-transit-${ticket.id}`}
                  >
                    En Camino
                  </button>
                  <button
                    onClick={() => {
                      setRelocatingTicketId(isRelocating ? null : ticket.id);
                    }}
                    disabled={updateTicket.isPending}
                    className={`py-3.5 font-bold text-xs uppercase tracking-wide transition-all active:scale-95 border-r border-border ${
                      isRelocating
                        ? "bg-blue-500/30 text-blue-300"
                        : "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                    }`}
                    data-testid={`btn-relocate-${ticket.id}`}
                  >
                    Reubicar
                  </button>
                  <button
                    onClick={() => handleAction(ticket.id, "delivered", undefined, ticket.valetNumber)}
                    disabled={updateTicket.isPending}
                    className="py-3.5 font-bold text-xs uppercase tracking-wide text-green-400 bg-green-500/10 hover:bg-green-500/20 active:scale-95 transition-all disabled:opacity-40"
                    data-testid={`btn-delivered-${ticket.id}`}
                  >
                    Entregado
                  </button>
                </div>

                {/* Relocation picker — expands inline below the ticket */}
                {isRelocating && (
                  <div className="border-t border-border p-3 bg-blue-500/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Mover a zona:
                    </p>
                    {!locations ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="animate-spin text-muted-foreground w-5 h-5" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {locations
                          .filter((l) => l.id !== ticket.parkingLocationId)
                          .map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleAction(ticket.id, "relocated", loc.id, ticket.valetNumber)}
                              disabled={updateTicket.isPending}
                              className="h-12 rounded-xl font-bold text-sm text-white active:scale-95 transition-all disabled:opacity-60"
                              style={{ backgroundColor: loc.colorHex }}
                              data-testid={`btn-relocate-to-${loc.id}`}
                            >
                              {loc.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
