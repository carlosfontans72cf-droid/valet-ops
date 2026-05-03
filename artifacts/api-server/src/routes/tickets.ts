import { Router } from "express";
import { db } from "@workspace/db";
import { valetTicketsTable, parkingLocationsTable, ticketMovementsTable } from "@workspace/db";
import { eq, and, ne, asc } from "drizzle-orm";
import { CreateTicketBody, UpdateTicketBody } from "@workspace/api-zod";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router();

async function enrichTicket(ticket: typeof valetTicketsTable.$inferSelect) {
  let parkingLocationName: string | null = null;
  let relocatedToLocationName: string | null = null;

  if (ticket.parkingLocationId) {
    const loc = await db.query.parkingLocationsTable.findFirst({
      where: eq(parkingLocationsTable.id, ticket.parkingLocationId),
    });
    parkingLocationName = loc?.name ?? null;
  }

  if (ticket.relocatedToLocationId) {
    const loc = await db.query.parkingLocationsTable.findFirst({
      where: eq(parkingLocationsTable.id, ticket.relocatedToLocationId),
    });
    relocatedToLocationName = loc?.name ?? null;
  }

  return { ...ticket, parkingLocationName, relocatedToLocationName };
}

// GET /api/tickets?eventId=&shiftId=&status=&search=
router.get("/tickets", requireAuth(), async (req, res) => {
  const eventId = parseInt(req.query.eventId as string);
  if (!eventId) {
    res.status(400).json({ error: "eventId required" });
    return;
  }

  let tickets = await db.query.valetTicketsTable.findMany({
    where: eq(valetTicketsTable.eventId, eventId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  // Filter out delivered tickets from normal list (they still appear in history)
  tickets = tickets.filter((t) => t.status !== "delivered");

  if (req.query.shiftId) {
    const shiftId = parseInt(req.query.shiftId as string);
    tickets = tickets.filter((t) => t.shiftId === shiftId);
  }

  if (req.query.status) {
    tickets = tickets.filter((t) => t.status === req.query.status);
  }

  if (req.query.search) {
    const search = (req.query.search as string).trim();
    tickets = tickets.filter((t) => t.valetNumber === search);
  }

  const enriched = await Promise.all(tickets.map(enrichTicket));
  res.json(enriched);
});

// POST /api/tickets
router.post("/tickets", requireAuth(["owner", "admin", "driver"]), async (req: AuthRequest, res) => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: parsed.error.message });
    return;
  }

  // Check for duplicate valet number in same event (only active/in_transit/relocated)
  const existing = await db.query.valetTicketsTable.findFirst({
    where: and(
      eq(valetTicketsTable.eventId, parsed.data.eventId),
      eq(valetTicketsTable.valetNumber, parsed.data.valetNumber),
      ne(valetTicketsTable.status, "delivered"),
    ),
  });

  if (existing) {
    res.status(409).json({
      error: "duplicate_valet_number",
      message: `El número de valet ${parsed.data.valetNumber} ya está en uso`,
    });
    return;
  }

  const [ticket] = await db
    .insert(valetTicketsTable)
    .values({
      ...parsed.data,
      vehicleDamages: parsed.data.vehicleDamages ?? [],
      status: "active",
    })
    .returning();

  // Record "parked" movement
  const performer = (req as AuthRequest).session?.driverName ?? "Desconocido";
  let locationName: string | null = null;
  if (parsed.data.parkingLocationId) {
    const loc = await db.query.parkingLocationsTable.findFirst({
      where: eq(parkingLocationsTable.id, parsed.data.parkingLocationId),
    });
    locationName = loc?.name ?? null;
  }
  await db.insert(ticketMovementsTable).values({
    ticketId: ticket.id,
    action: "parked",
    performedBy: performer,
    locationName,
  });

  res.status(201).json(await enrichTicket(ticket));
});

// GET /api/tickets/history?eventId=&from=&to=
router.get("/tickets/history", requireAuth(["owner"]), async (req, res) => {
  const eventId = parseInt(req.query.eventId as string);
  if (!eventId) {
    res.status(400).json({ error: "eventId required" });
    return;
  }

  const tickets = await db.query.valetTicketsTable.findMany({
    where: eq(valetTicketsTable.eventId, eventId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const enriched = await Promise.all(tickets.map(enrichTicket));
  res.json(enriched);
});

// GET /api/tickets/search/:valetNumber?eventId=
router.get("/tickets/search/:valetNumber", requireAuth(), async (req, res) => {
  const eventId = parseInt(req.query.eventId as string);
  const valetNumber = req.params.valetNumber as string;

  if (!eventId) {
    res.status(400).json({ error: "eventId required" });
    return;
  }

  const ticket = await db.query.valetTicketsTable.findFirst({
    where: and(
      eq(valetTicketsTable.eventId, eventId),
      eq(valetTicketsTable.valetNumber, valetNumber),
      ne(valetTicketsTable.status, "delivered"),
    ),
  });

  if (!ticket) {
    res.status(404).json({ error: "not_found", message: `Valet #${valetNumber} no encontrado` });
    return;
  }

  res.json(await enrichTicket(ticket));
});

// GET /api/tickets/:ticketId
router.get("/tickets/:ticketId", requireAuth(), async (req, res) => {
  const ticketId = parseInt(req.params.ticketId as string);
  const ticket = await db.query.valetTicketsTable.findFirst({
    where: eq(valetTicketsTable.id, ticketId),
  });

  if (!ticket) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  res.json(await enrichTicket(ticket));
});

// PATCH /api/tickets/:ticketId
router.patch("/tickets/:ticketId", requireAuth(["owner", "admin", "driver"]), async (req, res) => {
  const ticketId = parseInt(req.params.ticketId as string);
  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const updateData: Partial<typeof valetTicketsTable.$inferInsert> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.keyLocation !== undefined) updateData.keyLocation = parsed.data.keyLocation;
  if (parsed.data.parkingLocationId !== undefined) updateData.parkingLocationId = parsed.data.parkingLocationId;
  if (parsed.data.relocatedToLocationId !== undefined) updateData.relocatedToLocationId = parsed.data.relocatedToLocationId;
  if (parsed.data.vehicleDamages !== undefined) updateData.vehicleDamages = parsed.data.vehicleDamages;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.status === "delivered") updateData.deliveredAt = new Date();

  const [updated] = await db
    .update(valetTicketsTable)
    .set(updateData)
    .where(eq(valetTicketsTable.id, ticketId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  // Record movement when status changes
  if (parsed.data.status) {
    const performer = (req as AuthRequest).session?.driverName ?? "Desconocido";
    let movLocationName: string | null = null;
    const locId = parsed.data.relocatedToLocationId ?? parsed.data.parkingLocationId ?? updated.relocatedToLocationId ?? updated.parkingLocationId;
    if (locId) {
      const loc = await db.query.parkingLocationsTable.findFirst({
        where: eq(parkingLocationsTable.id, locId),
      });
      movLocationName = loc?.name ?? null;
    }
    await db.insert(ticketMovementsTable).values({
      ticketId: updated.id,
      action: parsed.data.status,
      performedBy: performer,
      locationName: movLocationName,
    });
  }

  res.json(await enrichTicket(updated));
});

// GET /api/tickets/:ticketId/movements
router.get("/tickets/:ticketId/movements", requireAuth(), async (req, res) => {
  const ticketId = parseInt(req.params.ticketId as string);
  const movements = await db.query.ticketMovementsTable.findMany({
    where: eq(ticketMovementsTable.ticketId, ticketId),
    orderBy: [asc(ticketMovementsTable.createdAt)],
  });
  res.json(movements);
});

// DELETE /api/tickets/:ticketId (owner + admin only)
router.delete("/tickets/:ticketId", requireAuth(["owner", "admin"]), async (req, res) => {
  const ticketId = parseInt(req.params.ticketId as string);
  const deleted = await db.delete(valetTicketsTable).where(eq(valetTicketsTable.id, ticketId)).returning();
  if (!deleted.length) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ success: true });
});

export default router;
