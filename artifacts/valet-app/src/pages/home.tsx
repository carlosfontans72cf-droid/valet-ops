import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import {
  useGetEventStats,
  useListEvents,
  useListShifts,
  useCreateShift,
  useUpdateShift,
  getGetEventStatsQueryKey,
  getListEventsQueryKey,
  getListShiftsQueryKey,
  getListParkingLocationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const { session } = useAuth();

  if (!session) return null;
  if (session.role === "driver") return <Redirect to="/work" />;
  if (session.role === "admin") return <Redirect to="/admin" />;

  return <OwnerDashboard />;
}

function OwnerDashboard() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  // If owner previously picked an event in TICKETS tab, honour that selection
  const storedEventId = localStorage.getItem("owner_event_id")
    ? parseInt(localStorage.getItem("owner_event_id")!)
    : null;

  const { data: events, isLoading: isLoadingEvents } = useListEvents({
    query: { refetchInterval: 15000, queryKey: getListEventsQueryKey() },
  });

  // Prefer the owner's stored selection; fall back to first active event
  const activeEvent = storedEventId
    ? (events?.find((e) => e.id === storedEventId) ?? events?.find((e) => e.isActive))
    : events?.find((e) => e.isActive);

  const { data: shifts, isLoading: isLoadingShifts } = useListShifts(
    { eventId: activeEvent?.id || 0 },
    {
      query: {
        enabled: !!activeEvent?.id,
        queryKey: getListShiftsQueryKey({ eventId: activeEvent?.id || 0 }),
        refetchInterval: 15000,
      },
    }
  );

  const { data: stats, isLoading: isLoadingStats } = useGetEventStats(
    activeEvent?.id || 0,
    {
      query: {
        enabled: !!activeEvent?.id,
        queryKey: getGetEventStatsQueryKey(activeEvent?.id || 0),
        refetchInterval: 15000,
      },
    }
  );

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();

  const openShift = shifts?.find((s) => s.isOpen);

  const handleOpenShift = async () => {
    if (!activeEvent) return;
    try {
      await createShift.mutateAsync({
        data: {
          eventId: activeEvent.id,
          label: "Turno Principal",
          openedBy: "Dueño",
        },
      });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getListShiftsQueryKey({ eventId: activeEvent.id }),
      });
      toast.success("Turno abierto — los pilotos ya pueden operar");
    } catch (err: any) {
      toast.error(err?.message || "Error al abrir el turno");
    }
  };

  const handleCloseShift = async () => {
    if (!openShift) return;
    try {
      await updateShift.mutateAsync({
        shiftId: openShift.id,
        data: { isOpen: false },
      });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getListShiftsQueryKey({ eventId: activeEvent?.id || 0 }),
      });
      toast.success("Turno cerrado");
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar el turno");
    }
  };

  if (isLoadingEvents) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="space-y-4 pt-2">
        <h1 className="text-2xl font-black tracking-tight">Resumen General</h1>
        <Card className="bg-card">
          <CardContent className="p-6 text-center text-muted-foreground">
            No hay ningún evento activo.{" "}
            <span className="font-semibold text-foreground">
              Ve a Panel → Eventos para crear y activar uno.
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  const shiftLoading = createShift.isPending || updateShift.isPending || isLoadingShifts;

  return (
    <div className="space-y-5 pt-2">
      {/* Event header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">{activeEvent.name}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(activeEvent.eventDate.slice(0, 10) + "T12:00:00").toLocaleDateString("es-ES", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Shift status + action */}
      {isLoadingShifts ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : openShift ? (
        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="font-bold text-green-500">Turno Abierto</p>
              <p className="text-xs text-muted-foreground">
                {openShift.label} · desde{" "}
                {new Date(openShift.openedAt).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <Button
            onClick={handleCloseShift}
            disabled={shiftLoading}
            className="w-full h-12 font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white"
          >
            {shiftLoading ? <Loader2 className="animate-spin" /> : "CERRAR TURNO"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="font-bold text-destructive">Turno Cerrado</p>
              <p className="text-xs text-muted-foreground">
                Los pilotos no pueden operar hasta que abras el turno
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenShift}
            disabled={shiftLoading}
            className="w-full h-14 text-base font-bold rounded-xl bg-green-600 hover:bg-green-700 text-white"
          >
            {shiftLoading ? <Loader2 className="animate-spin" /> : "ABRIR TURNO"}
          </Button>
        </div>
      )}

      {/* Stats */}
      {isLoadingStats ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard title="Activos" value={stats.totalActive} color="text-primary" bg="bg-primary/10" />
            <StatCard title="Entregados" value={stats.totalDelivered} color="text-green-500" bg="bg-green-500/10" />
            <StatCard title="En Camino" value={stats.totalInTransit} color="text-yellow-400" bg="bg-yellow-500/10" />
            <StatCard title="Reubicados" value={stats.totalRelocated} color="text-blue-400" bg="bg-blue-500/10" />
          </div>

          {stats.byLocation && stats.byLocation.length > 0 && (() => {
            const occupied = stats.byLocation.filter((l) => l.count > 0);
            const empty = stats.byLocation.filter((l) => l.count === 0);
            const totalVehicles = stats.byLocation.reduce((s, l) => s + l.count, 0);
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Ocupación por Zona
                  </h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {totalVehicles} vehículos
                  </span>
                </div>

                {occupied.length === 0 ? (
                  <div className="rounded-xl bg-card border border-border p-6 text-center text-muted-foreground text-sm">
                    Sin vehículos estacionados en este momento
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...occupied]
                      .sort((a, b) => b.count - a.count)
                      .map((loc) => {
                        const pct = loc.capacity > 0 ? Math.round((loc.count / loc.capacity) * 100) : 0;
                        const barColor =
                          pct >= 90 ? "#ef4444" : pct >= 70 ? "#eab308" : "#22c55e";
                        return (
                          <div
                            key={loc.locationId}
                            className="rounded-xl bg-card border border-border overflow-hidden"
                          >
                            <div className="flex items-center justify-between px-3 pt-3 pb-1">
                              <span className="font-bold text-sm">{loc.locationName}</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-black"
                                  style={{ color: barColor }}
                                >
                                  {pct}%
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {loc.count}/{loc.capacity}
                                </span>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mx-3 mb-3 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  backgroundColor: (loc as any).colorHex ?? barColor,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    {empty.length > 0 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        {empty.length} zona{empty.length !== 1 ? "s" : ""} sin vehículos
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  bg,
}: {
  title: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-xl p-4 flex flex-col items-center justify-center ${bg}`}>
      <span className="text-xs uppercase font-bold text-muted-foreground mb-1">{title}</span>
      <span className={`text-4xl font-black ${color}`}>{value}</span>
    </div>
  );
}
