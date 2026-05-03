import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListEvents,
  useListTicketHistory,
  getListTicketHistoryQueryKey,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-primary/20 text-primary" },
  in_transit: { label: "En Camino", color: "bg-yellow-500/20 text-yellow-400" },
  relocated: { label: "Reubicado", color: "bg-blue-500/20 text-blue-400" },
  delivered: { label: "Entregado", color: "bg-green-500/20 text-green-400" },
};

const KEY_LABELS: Record<string, string> = {
  drawer: "Cajón",
  board: "Tablero",
  not_found: "No Encontrada",
  with_owner: "Con Dueño",
};

export default function HistoryPage() {
  const { session } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const { data: events, isLoading: eventsLoading } = useListEvents();

  const { data: tickets, isLoading: ticketsLoading } = useListTicketHistory(
    { eventId: selectedEventId ? parseInt(selectedEventId) : 0 },
    {
      query: {
        enabled: !!selectedEventId,
        queryKey: getListTicketHistoryQueryKey({
          eventId: selectedEventId ? parseInt(selectedEventId) : 0,
        }),
      },
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-1">
        <History className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight">Historial</h1>
      </div>

      {/* Event selector */}
      <Select value={selectedEventId} onValueChange={setSelectedEventId}>
        <SelectTrigger className="h-14 bg-card border-border rounded-xl text-base">
          <SelectValue placeholder="Seleccionar evento..." />
        </SelectTrigger>
        <SelectContent>
          {eventsLoading ? (
            <SelectItem value="loading" disabled>
              Cargando eventos...
            </SelectItem>
          ) : (
            events?.map((event) => (
              <SelectItem key={event.id} value={event.id.toString()}>
                {event.name} — {event.eventDate}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Stats bar */}
      {tickets && (
        <div className="grid grid-cols-4 gap-2">
          {["active", "in_transit", "delivered", "relocated"].map((status) => {
            const count = tickets.filter((t) => t.status === status).length;
            const info = STATUS_LABELS[status];
            return (
              <div key={status} className={`rounded-xl p-3 text-center ${info.color}`}>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  {info.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {ticketsLoading && (
        <div className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      )}

      {!selectedEventId && !eventsLoading && (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
          <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="font-medium">Selecciona un evento para ver el historial</p>
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <div className="text-center p-12 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
          <p className="font-medium">No hay tickets en el historial</p>
        </div>
      )}

      {tickets && tickets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {tickets.length} tickets en total
          </p>
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start justify-between gap-3"
              data-testid={`row-ticket-${ticket.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-black">#{ticket.valetNumber}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-bold uppercase ${STATUS_LABELS[ticket.status]?.color}`}
                  >
                    {STATUS_LABELS[ticket.status]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground font-medium truncate">
                  {ticket.parkingLocationName || "Sin estacionamiento"} —{" "}
                  Llave: {KEY_LABELS[ticket.keyLocation] || ticket.keyLocation}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Chofer: {ticket.driverName}
                </p>
                {ticket.vehicleDamages && ticket.vehicleDamages.length > 0 && (
                  <p className="text-xs text-red-400 mt-1 font-medium">
                    Daños: {ticket.vehicleDamages.length}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(ticket.createdAt).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
