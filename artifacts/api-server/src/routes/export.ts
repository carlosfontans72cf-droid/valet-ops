import { Router } from "express";
import { db } from "@workspace/db";
import { valetTicketsTable, parkingLocationsTable, shiftsTable, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toLocalDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  in_transit: "En tránsito",
  delivered: "Entregado",
  relocated: "Reubicado",
};

const KEY_LABELS: Record<string, string> = {
  drawer: "Cajón",
  board: "Tablero",
  not_found: "No encontrada",
  with_owner: "Con dueño",
};

// GET /api/events/:eventId/export — returns CSV of all tickets for an event
router.get("/events/:eventId/export", requireAuth(["owner", "admin"]), async (req, res) => {
  const eventId = parseInt(req.params.eventId);
  if (!eventId) {
    res.status(400).json({ error: "eventId inválido" });
    return;
  }

  const event = await db.query.eventsTable.findFirst({
    where: eq(eventsTable.id, eventId),
  });
  if (!event) {
    res.status(404).json({ error: "Evento no encontrado" });
    return;
  }

  const shifts = await db.query.shiftsTable.findMany({
    where: eq(shiftsTable.eventId, eventId),
  });
  const shiftMap = new Map(shifts.map((s) => [s.id, s.name]));

  const locations = await db.query.parkingLocationsTable.findMany({
    where: eq(parkingLocationsTable.eventId, eventId),
  });
  const locationMap = new Map(locations.map((l) => [l.id, l.name]));

  const tickets = await db.query.valetTicketsTable.findMany({
    where: eq(valetTicketsTable.eventId, eventId),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const headers = [
    "# Ticket",
    "Turno",
    "Chofer",
    "Estado",
    "Color",
    "Marca",
    "Patente",
    "Zona de estacionamiento",
    "Zona reubicado",
    "Llave",
    "Daños",
    "Notas",
    "Creado",
    "Entregado",
  ];

  const rows = tickets.map((t) => [
    escapeCSV(t.valetNumber),
    escapeCSV(shiftMap.get(t.shiftId) ?? t.shiftId),
    escapeCSV(t.driverName),
    escapeCSV(STATUS_LABELS[t.status] ?? t.status),
    escapeCSV(t.vehicleColor),
    escapeCSV(t.vehicleBrand),
    escapeCSV(t.licensePlate),
    escapeCSV(t.parkingLocationId ? (locationMap.get(t.parkingLocationId) ?? t.parkingLocationId) : ""),
    escapeCSV(t.relocatedToLocationId ? (locationMap.get(t.relocatedToLocationId) ?? t.relocatedToLocationId) : ""),
    escapeCSV(KEY_LABELS[t.keyLocation] ?? t.keyLocation),
    escapeCSV((t.vehicleDamages ?? []).join(" | ")),
    escapeCSV(t.notes),
    escapeCSV(toLocalDate(t.createdAt)),
    escapeCSV(toLocalDate(t.deliveredAt)),
  ]);

  const csvLines = [headers.join(","), ...rows.map((r) => r.join(","))];
  const csv = csvLines.join("\r\n");

  const safeName = event.name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/ /g, "_");
  const filename = `valet_${safeName}_tickets.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("\uFEFF" + csv); // BOM for Excel UTF-8 support
});

export default router;
