import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useGetConfig,
  useUpdateConfig,
  useListEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useClearEventHistory,
  useListAccessCodes,
  useCreateAccessCode,
  useDeleteAccessCode,
  useBulkGenerateCodes,
  useListParkingLocations,
  useCreateParkingLocation,
  useUpdateParkingLocation,
  useDeleteParkingLocation,
  useGetBlockedIps,
  useUnblockIp,
  getListEventsQueryKey,
  getListAccessCodesQueryKey,
  getListParkingLocationsQueryKey,
  getGetConfigQueryKey,
  getGetBlockedIpsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CalendarDays,
  Key,
  MapPin,
  AlertTriangle,
  Shield,
  Zap,
  UnlockKeyhole,
  Download,
  Copy,
  MessageSquare,
} from "lucide-react";

export default function OwnerPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-1">
        <Settings className="w-6 h-6 text-muted-foreground" />
        <h1 className="text-2xl font-black tracking-tight">Panel Dueño</h1>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="w-full grid grid-cols-5 h-12 rounded-xl bg-card">
          <TabsTrigger value="events" className="text-[10px] font-bold rounded-lg px-1">
            Eventos
          </TabsTrigger>
          <TabsTrigger value="codes" className="text-[10px] font-bold rounded-lg px-1">
            Códigos
          </TabsTrigger>
          <TabsTrigger value="parking" className="text-[10px] font-bold rounded-lg px-1">
            Zonas
          </TabsTrigger>
          <TabsTrigger value="config" className="text-[10px] font-bold rounded-lg px-1">
            Config
          </TabsTrigger>
          <TabsTrigger value="security" className="text-[10px] font-bold rounded-lg px-1">
            Seguridad
          </TabsTrigger>
        </TabsList>
        <TabsContent value="events">
          <EventsTab />
        </TabsContent>
        <TabsContent value="codes">
          <AccessCodesTab />
        </TabsContent>
        <TabsContent value="parking">
          <ParkingTab />
        </TabsContent>
        <TabsContent value="config">
          <ConfigTab />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EventsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);

  const { data: events, isLoading } = useListEvents();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const clearHistory = useClearEventHistory();

  const handleExport = async (eventId: number, eventName: string) => {
    setExportingId(eventId);
    try {
      const token = localStorage.getItem("valet_token");
      const res = await fetch(`/api/events/${eventId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = eventName.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/ /g, "_");
      a.download = `valet_${safeName}_tickets.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Archivo descargado");
    } catch {
      toast.error("No se pudo exportar");
    } finally {
      setExportingId(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !date) {
      toast.error("Nombre y fecha son requeridos");
      return;
    }
    try {
      await createEvent.mutateAsync({ data: { name: name.trim(), eventDate: date } });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      setName("");
      setDate("");
      toast.success("Evento creado");
    } catch (err: any) {
      toast.error(err?.message || "Error al crear evento");
    }
  };

  const handleToggleActive = async (id: number, current: boolean) => {
    try {
      await updateEvent.mutateAsync({ eventId: id, data: { isActive: !current } });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      toast.success(current ? "Evento desactivado" : "Evento activado");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await deleteEvent.mutateAsync({ eventId: id });
      queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
      toast.success("Evento eliminado");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleClearHistory = async (id: number) => {
    if (!confirm("¿Borrar TODO el historial de este evento? Esta acción no se puede deshacer.")) return;
    try {
      await clearHistory.mutateAsync({ eventId: id });
      toast.success("Historial borrado");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Create event form */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <CalendarDays className="w-4 h-4" /> Nuevo Evento
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del evento"
          className="h-12 bg-background border-border rounded-xl"
          data-testid="input-event-name"
        />
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 bg-background border-border rounded-xl"
          data-testid="input-event-date"
        />
        <Button
          onClick={handleCreate}
          disabled={createEvent.isPending}
          className="w-full h-12 font-bold rounded-xl"
          data-testid="btn-create-event"
        >
          {createEvent.isPending ? <Loader2 className="animate-spin" /> : "CREAR EVENTO"}
        </Button>
      </div>

      {/* Events list */}
      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        events?.map((event) => (
          <div
            key={event.id}
            className="rounded-xl bg-card border border-border p-4 space-y-3"
            data-testid={`card-event-${event.id}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-base">{event.name}</p>
                <p className="text-sm text-muted-foreground">{event.eventDate}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      event.isActive
                        ? "bg-green-500/20 text-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {event.isActive ? "Activo" : "Inactivo"}
                  </span>
                  {event.hasOpenShift && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                      Turno Abierto
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDelete(event.id)}
                className="text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10"
                data-testid={`btn-delete-event-${event.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-12 font-bold rounded-xl text-sm"
                onClick={() => handleToggleActive(event.id, event.isActive)}
                data-testid={`btn-toggle-event-${event.id}`}
              >
                {event.isActive ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-1" /> Desactivar
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-1" /> Activar
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-12 font-bold rounded-xl text-sm text-destructive hover:bg-destructive/10"
                onClick={() => handleClearHistory(event.id)}
                data-testid={`btn-clear-history-${event.id}`}
              >
                <AlertTriangle className="w-4 h-4 mr-1" /> Borrar Historial
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full h-12 font-bold rounded-xl text-sm text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={() => handleExport(event.id, event.name)}
              disabled={exportingId === event.id}
              data-testid={`btn-export-event-${event.id}`}
            >
              {exportingId === event.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Exportar tickets CSV
            </Button>
          </div>
        ))
      )}
    </div>
  );
}

function AccessCodesTab() {
  const queryClient = useQueryClient();
  const { data: events } = useListEvents();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [code, setCode] = useState("");
  const [role, setRole] = useState<"admin" | "driver">("driver");
  const [label, setLabel] = useState("");
  const [showCodes, setShowCodes] = useState(false);
  const [bulkDrivers, setBulkDrivers] = useState("1");
  const [bulkAdmins, setBulkAdmins] = useState("0");
  const [generatedCodes, setGeneratedCodes] = useState<Array<{ label: string; role: string; code: string }>>([]);
  const bulkGenerate = useBulkGenerateCodes();

  const { data: codes, isLoading } = useListAccessCodes(
    { eventId: selectedEventId ? parseInt(selectedEventId) : 0 },
    {
      query: {
        enabled: !!selectedEventId,
        queryKey: getListAccessCodesQueryKey({
          eventId: selectedEventId ? parseInt(selectedEventId) : 0,
        }),
      },
    }
  );

  const createCode = useCreateAccessCode();
  const deleteCode = useDeleteAccessCode();

  const handleCreate = async () => {
    if (!code.trim() || !label.trim() || !selectedEventId) {
      toast.error("Completa todos los campos");
      return;
    }
    try {
      await createCode.mutateAsync({
        data: {
          eventId: parseInt(selectedEventId),
          code: code.trim(),
          role,
          label: label.trim(),
          expiresAfterShiftClose: true,
        },
      });
      queryClient.invalidateQueries({
        queryKey: getListAccessCodesQueryKey({ eventId: parseInt(selectedEventId) }),
      });
      setCode("");
      setLabel("");
      toast.success("Código creado");
    } catch (err: any) {
      toast.error(err?.message || "Error al crear código");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este código?")) return;
    try {
      await deleteCode.mutateAsync({ codeId: id });
      queryClient.invalidateQueries({
        queryKey: getListAccessCodesQueryKey({ eventId: parseInt(selectedEventId) }),
      });
      toast.success("Código eliminado");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleBulkGenerate = async () => {
    const drivers = parseInt(bulkDrivers) || 0;
    const admins = parseInt(bulkAdmins) || 0;
    if (drivers + admins === 0 || !selectedEventId) {
      toast.error("Seleccioná un evento y al menos 1 código");
      return;
    }
    try {
      const created = await bulkGenerate.mutateAsync({
        data: { eventId: parseInt(selectedEventId), driverCount: drivers, adminCount: admins },
      });
      queryClient.invalidateQueries({
        queryKey: getListAccessCodesQueryKey({ eventId: parseInt(selectedEventId) }),
      });
      setGeneratedCodes(created.map((c) => ({ label: c.label, role: c.role, code: c.code })));
      toast.success(`${created.length} códigos generados`);
    } catch (err: any) {
      toast.error(err?.message || "Error al generar códigos");
    }
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Event selector */}
      <select
        value={selectedEventId}
        onChange={(e) => { setSelectedEventId(e.target.value); setGeneratedCodes([]); }}
        className="w-full h-12 rounded-xl bg-card border border-border px-3 text-base font-medium"
        data-testid="select-event-codes"
      >
        <option value="">Seleccionar evento...</option>
        {events?.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {!selectedEventId && (
        <p className="text-xs text-muted-foreground text-center -mt-1">
          Selecciona un evento para generar códigos
        </p>
      )}

      {/* Bulk generation form — always visible */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Zap className="w-4 h-4 text-yellow-400" /> Generar Códigos en Masa
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">Choferes</p>
            <Input
              type="number"
              min="0"
              max="50"
              value={bulkDrivers}
              onChange={(e) => setBulkDrivers(e.target.value)}
              className="h-12 bg-background border-border rounded-xl text-center text-lg font-bold"
              data-testid="input-bulk-drivers"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1 font-medium">Administradores</p>
            <Input
              type="number"
              min="0"
              max="20"
              value={bulkAdmins}
              onChange={(e) => setBulkAdmins(e.target.value)}
              className="h-12 bg-background border-border rounded-xl text-center text-lg font-bold"
              data-testid="input-bulk-admins"
            />
          </div>
        </div>
        <Button
          onClick={handleBulkGenerate}
          disabled={!selectedEventId || bulkGenerate.isPending}
          className="w-full h-12 font-bold rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
          data-testid="btn-bulk-generate"
        >
          {bulkGenerate.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            `GENERAR ${(parseInt(bulkDrivers) || 0) + (parseInt(bulkAdmins) || 0)} CÓDIGO${((parseInt(bulkDrivers) || 0) + (parseInt(bulkAdmins) || 0)) !== 1 ? "S" : ""}`
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Los códigos son válidos solo para este evento. Al cerrar el evento, dejarán de funcionar automáticamente.
        </p>
      </div>

      {selectedEventId && (
        <>
          {/* Generated codes result */}
          {generatedCodes.length > 0 && (
            <div className="rounded-xl bg-card border border-emerald-500/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                  <Key className="w-4 h-4" /> {generatedCodes.length} Códigos Generados
                </p>
              </div>

              {generatedCodes.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="font-bold text-sm">{c.label}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>
                      {c.role === "admin" ? "Admin" : "Chofer"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-base tracking-widest bg-background rounded-lg px-3 py-1.5">
                      {c.code}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(c.code);
                        toast.success("Copiado");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Copiar código"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full h-12 font-bold rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => {
                  const eventName = events?.find((e) => String(e.id) === selectedEventId)?.name ?? "el evento";
                  const lines = [
                    `🚗 *VALET OPS — ${eventName}*`,
                    `Tu código de acceso para ingresar a la app:`,
                    ``,
                    ...generatedCodes.map((c) => `• ${c.label}: *${c.code}*`),
                    ``,
                    `Ingresá en la app, poné el código y tu nombre.`,
                  ];
                  navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("Texto copiado — pegalo en WhatsApp");
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Copiar todo para WhatsApp
              </Button>
            </div>
          )}

          {/* Create form */}
          <div className="rounded-xl bg-card border border-border p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Key className="w-4 h-4" /> Nuevo Código
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setRole("driver")}
                className={`h-12 rounded-xl font-bold text-sm border-2 transition-all ${
                  role === "driver"
                    ? "bg-blue-600 border-blue-700 text-white"
                    : "bg-card border-border text-foreground"
                }`}
              >
                Chofer
              </button>
              <button
                onClick={() => setRole("admin")}
                className={`h-12 rounded-xl font-bold text-sm border-2 transition-all ${
                  role === "admin"
                    ? "bg-purple-600 border-purple-700 text-white"
                    : "bg-card border-border text-foreground"
                }`}
              >
                Administrador
              </button>
            </div>

            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nombre / Descripción"
              className="h-12 bg-background border-border rounded-xl"
              data-testid="input-code-label"
            />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Código de acceso"
              className="h-12 bg-background border-border rounded-xl font-mono"
              data-testid="input-code-value"
            />
            <Button
              onClick={handleCreate}
              disabled={createCode.isPending}
              className="w-full h-12 font-bold rounded-xl"
              data-testid="btn-create-code"
            >
              {createCode.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "CREAR CÓDIGO"
              )}
            </Button>
          </div>

          {/* Toggle show codes */}
          <Button
            variant="outline"
            className="w-full h-10 text-sm font-bold rounded-xl"
            onClick={() => setShowCodes(!showCodes)}
          >
            {showCodes ? (
              <><EyeOff className="w-4 h-4 mr-2" /> Ocultar Códigos</>
            ) : (
              <><Eye className="w-4 h-4 mr-2" /> Mostrar Códigos</>
            )}
          </Button>

          {/* Codes list */}
          {isLoading ? (
            <div className="flex justify-center p-4">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            codes?.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-card border border-border p-4 flex items-center justify-between"
                data-testid={`row-code-${c.id}`}
              >
                <div>
                  <p className="font-bold">{c.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        c.role === "admin"
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {c.role === "admin" ? "Admin" : "Chofer"}
                    </span>
                    {showCodes && (
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded-lg">
                        {c.code}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(c.id)}
                  className="text-destructive hover:bg-destructive/10 rounded-xl h-10 w-10"
                  data-testid={`btn-delete-code-${c.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function ParkingTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [color, setColor] = useState("#3B82F6");

  const { data: locations, isLoading } = useListParkingLocations(
    {},
    { query: { queryKey: getListParkingLocationsQueryKey({}) } }
  );
  const create = useCreateParkingLocation();
  const update = useUpdateParkingLocation();
  const remove = useDeleteParkingLocation();

  const handleCreate = async () => {
    if (!name.trim() || !capacity) {
      toast.error("Nombre y capacidad son requeridos");
      return;
    }
    try {
      await create.mutateAsync({
        data: { name: name.trim(), capacity: parseInt(capacity), colorHex: color },
      });
      queryClient.invalidateQueries({ queryKey: getListParkingLocationsQueryKey({}) });
      setName("");
      setCapacity("");
      toast.success("Zona creada");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await update.mutateAsync({ locationId: id, data: { isActive: !current } });
      queryClient.invalidateQueries({ queryKey: getListParkingLocationsQueryKey({}) });
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta zona?")) return;
    try {
      await remove.mutateAsync({ locationId: id });
      queryClient.invalidateQueries({ queryKey: getListParkingLocationsQueryKey({}) });
      toast.success("Zona eliminada");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  return (
    <div className="space-y-4 pt-3">
      {/* Create form */}
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <MapPin className="w-4 h-4" /> Nueva Zona
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la zona"
          className="h-12 bg-background border-border rounded-xl"
        />
        <Input
          type="number"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacidad (vehículos)"
          className="h-12 bg-background border-border rounded-xl"
        />
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground font-medium">Color:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-20 rounded-lg cursor-pointer border border-border"
          />
          <div
            className="flex-1 h-10 rounded-xl font-bold text-white flex items-center justify-center text-sm"
            style={{ backgroundColor: color }}
          >
            Vista previa
          </div>
        </div>
        <Button
          onClick={handleCreate}
          disabled={create.isPending}
          className="w-full h-12 font-bold rounded-xl"
        >
          {create.isPending ? <Loader2 className="animate-spin" /> : "CREAR ZONA"}
        </Button>
      </div>

      {/* Locations list */}
      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        locations?.map((loc) => (
          <div
            key={loc.id}
            className="rounded-xl bg-card border border-border p-4 flex items-center gap-3"
            data-testid={`row-parking-${loc.id}`}
          >
            <div
              className="w-5 h-5 rounded-full shrink-0"
              style={{ backgroundColor: loc.colorHex }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{loc.name}</p>
              <p className="text-sm text-muted-foreground">Cap: {loc.capacity}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleToggle(loc.id, loc.isActive)}
                className="h-10 w-10 rounded-xl"
              >
                {loc.isActive ? (
                  <Eye className="w-4 h-4 text-green-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleDelete(loc.id)}
                className="h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ConfigTab() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetConfig({
    query: { queryKey: getGetConfigQueryKey() },
  });
  const updateConfig = useUpdateConfig();
  const [appName, setAppName] = useState("");

  const handleSave = async () => {
    const nameToSave = appName.trim() || config?.appName || "Valet App";
    try {
      await updateConfig.mutateAsync({ data: { appName: nameToSave } });
      queryClient.invalidateQueries({ queryKey: getGetConfigQueryKey() });
      toast.success("Configuración guardada");
    } catch (err: any) {
      toast.error(err?.message || "Error");
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Nombre de la App
        </p>
        {isLoading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Input
              value={appName || config?.appName || ""}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Nombre de la app"
              className="h-12 bg-background border-border rounded-xl text-base"
              data-testid="input-app-name"
            />
            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending}
              className="w-full h-12 font-bold rounded-xl"
              data-testid="btn-save-config"
            >
              {updateConfig.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "GUARDAR"
              )}
            </Button>
          </>
        )}
      </div>

      <div className="rounded-xl bg-card border border-border p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Código del Dueño (por defecto)
        </p>
        <p className="font-mono text-lg font-bold bg-background rounded-xl px-4 py-3">
          OWNER2024
        </p>
        <p className="text-xs text-muted-foreground">
          Este es el código de acceso permanente del dueño. Guárdalo de forma segura.
        </p>
      </div>
    </div>
  );
}

function SecurityTab() {
  const queryClient = useQueryClient();
  const { data: blocked, isLoading, refetch } = useGetBlockedIps({
    query: { queryKey: getGetBlockedIpsQueryKey() },
  });
  const unblock = useUnblockIp();

  const handleUnblock = async (ip: string) => {
    try {
      await unblock.mutateAsync({ ip });
      queryClient.invalidateQueries({ queryKey: getGetBlockedIpsQueryKey() });
      toast.success(`Dispositivo desbloqueado`);
    } catch (err: any) {
      toast.error(err?.message || "Error al desbloquear");
    }
  };

  return (
    <div className="space-y-4 pt-3">
      <div className="rounded-xl bg-card border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Shield className="w-4 h-4 text-red-400" /> Dispositivos Bloqueados
          </p>
          <button
            onClick={() => refetch()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Actualizar
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Un dispositivo queda bloqueado automáticamente tras 5 intentos fallidos de acceso.
          Solo el dueño puede desbloquearlo.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-4">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : blocked && blocked.length > 0 ? (
        blocked.map((b) => (
          <div
            key={b.ip}
            className="rounded-xl bg-card border border-red-500/30 p-4 flex items-center justify-between gap-3"
          >
            <div>
              <p className="font-mono font-bold text-sm">{b.ip}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {b.count} intentos fallidos
                {" · "}
                {new Date(b.lastAttempt).toLocaleString("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUnblock(b.ip)}
              disabled={unblock.isPending}
              className="shrink-0 h-10 rounded-xl border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold"
              data-testid={`btn-unblock-${b.ip}`}
            >
              <UnlockKeyhole className="w-4 h-4 mr-1" />
              Desbloquear
            </Button>
          </div>
        ))
      ) : (
        <div className="rounded-xl bg-card border border-border p-6 text-center">
          <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-400">Sin dispositivos bloqueados</p>
          <p className="text-xs text-muted-foreground mt-1">
            La app bloqueará automáticamente cualquier dispositivo con 5 intentos fallidos.
          </p>
        </div>
      )}
    </div>
  );
}
