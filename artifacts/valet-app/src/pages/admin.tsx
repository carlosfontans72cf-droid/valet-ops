import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListShifts,
  useCreateShift,
  useUpdateShift,
  getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Clock, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function AdminPanel() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [newLabel, setNewLabel] = useState("Turno Principal");

  const { data: shifts, isLoading } = useListShifts(
    { eventId: session?.eventId || 0 },
    {
      query: {
        enabled: !!session?.eventId,
        queryKey: getListShiftsQueryKey({ eventId: session?.eventId || 0 }),
        refetchInterval: 30000,
      },
    }
  );

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();

  const openShift = shifts?.find((s) => s.isOpen);
  const closedShifts = shifts?.filter((s) => !s.isOpen) || [];

  const handleOpenShift = async () => {
    if (!session?.eventId) return;
    try {
      await createShift.mutateAsync({
        data: {
          eventId: session.eventId,
          label: newLabel.trim() || "Turno Principal",
          openedBy: session.driverName || "Administrador",
        },
      });
      queryClient.invalidateQueries({
        queryKey: getListShiftsQueryKey({ eventId: session.eventId }),
      });
      toast.success("Turno abierto");
    } catch (err: any) {
      toast.error(err?.message || "Error al abrir turno");
    }
  };

  const handleCloseShift = async () => {
    if (!openShift) return;
    try {
      await updateShift.mutateAsync({
        shiftId: openShift.id,
        data: { isOpen: false },
      });
      queryClient.invalidateQueries({
        queryKey: getListShiftsQueryKey({ eventId: session?.eventId || 0 }),
      });
      toast.success("Turno cerrado");
    } catch (err: any) {
      toast.error(err?.message || "Error al cerrar turno");
    }
  };

  if (!session?.eventId) {
    return (
      <div className="p-4 text-center mt-10 text-muted-foreground">
        Sin evento asignado.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 pt-1">
        <ShieldAlert className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight">Panel Admin</h1>
      </div>

      {/* Current shift status */}
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : openShift ? (
        <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <p className="font-bold text-green-500 text-lg">Turno Abierto</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold text-xl">{openShift.label}</p>
            <p className="text-sm text-muted-foreground">
              Abierto por: {openShift.openedBy}
            </p>
            <p className="text-sm text-muted-foreground">
              Desde:{" "}
              {new Date(openShift.openedAt).toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
          <Button
            onClick={handleCloseShift}
            disabled={updateShift.isPending}
            className="w-full h-14 font-bold text-base rounded-xl bg-red-600 hover:bg-red-700 text-white"
            data-testid="btn-close-shift"
          >
            {updateShift.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              "CERRAR TURNO"
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-muted-foreground" />
            <p className="font-bold text-muted-foreground">Sin turno activo</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Nombre del Turno
            </label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Ej. Turno Tarde"
              className="h-14 text-base bg-card/50 border-border rounded-xl"
              data-testid="input-shift-label"
            />
          </div>

          <Button
            onClick={handleOpenShift}
            disabled={createShift.isPending}
            className="w-full h-14 font-bold text-base rounded-xl bg-green-600 hover:bg-green-700 text-white"
            data-testid="btn-open-shift"
          >
            {createShift.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              "ABRIR TURNO"
            )}
          </Button>
        </div>
      )}

      {/* Shift history */}
      {closedShifts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" /> Turnos Anteriores
          </h2>
          {closedShifts.map((shift) => (
            <div
              key={shift.id}
              className="bg-card border border-border rounded-xl p-4"
              data-testid={`row-shift-${shift.id}`}
            >
              <p className="font-bold">{shift.label}</p>
              <p className="text-sm text-muted-foreground">
                {shift.openedBy} —{" "}
                {new Date(shift.openedAt).toLocaleString("es-ES", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {shift.closedAt &&
                  ` → ${new Date(shift.closedAt).toLocaleTimeString("es-ES", { timeStyle: "short" })}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
