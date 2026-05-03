import { Router } from "express";
import { db } from "@workspace/db";
import { eventsTable, shiftsTable, valetTicketsTable, parkingLocationsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { CreateEventBody, UpdateEventBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/events — public so the login page can load active events for the selector
router.get("/events", async (_req, res) => {
  const events = await db.query.eventsTable.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });

  const withShift = await Promise.all(
    events.map(async (event) => {
      const openShift = await db.query.shiftsTable.findFirst({
        where: and(eq(shiftsTable.eventId, event.id), eq(shiftsTable.isOpen, true)),
      });
      return {
        ...event,
        hasOpenShift: !!openShift,
        activeShiftId: openShift?.id ?? null,
      };
    }),
  );

  res.json(withShift);
});

// POST /api/events
router.post("/events", requireAuth(["owner"]), async (req, res) => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: parsed.error.message });
    return;
  }

  const [event] = await db.insert(eventsTable).values(parsed.data).returning();
  res.status(201).json({ ...event, hasOpenShift: false, activeShiftId: null });
});

// GET /api/events/:eventId
router.get("/events/:eventId", requireAuth(), async (req, res) => {
  const eventId = parseInt(req.params.eventId as string);
  const event = await db.query.eventsTable.findFirst({
    where: eq(eventsTable.id, eventId),
  });
  if (!event) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const openShift = await db.query.shiftsTable.findFirst({
    where: and(eq(shiftsTable.eventId, eventId), eq(shiftsTable.isOpen, true)),
  });
  res.json({ ...event, hasOpenShift: !!openShift, activeShiftId: openShift?.id ?? null });
});

// PATCH /api/events/:eventId
router.patch("/events/:eventId", requireAuth(["owner"]), async (req, res) => {
  const eventId = parseInt(req.params.eventId as string);
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const [updated] = await db
    .update(eventsTable)
    .set(parsed.data)
    .where(eq(eventsTable.id, eventId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const openShift = await db.query.shiftsTable.findFirst({
    where: and(eq(shiftsTable.eventId, eventId), eq(shiftsTable.isOpen, true)),
  });
  res.json({ ...updated, hasOpenShift: !!openShift, activeShiftId: openShift?.id ?? null });
});

// DELETE /api/events/:eventId
router.delete("/events/:eventId", requireAuth(["owner"]), async (req, res) => {
  const eventId = parseInt(req.params.eventId as string);
  await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
  res.json({ success: true });
});

// POST /api/events/:eventId/clear-history
router.post("/events/:eventId/clear-history", requireAuth(["owner"]), async (req, res) => {
  const eventId = parseInt(req.params.eventId as string);
  await db.delete(valetTicketsTable).where(eq(valetTicketsTable.eventId, eventId));
  res.json({ success: true });
});

// GET /api/events/:eventId/stats
router.get("/events/:eventId/stats", requireAuth(), async (req, res) => {
  const eventId = parseInt(req.params.eventId as string);

  const tickets = await db.query.valetTicketsTable.findMany({
    where: eq(valetTicketsTable.eventId, eventId),
  });

  const locations = await db.query.parkingLocationsTable.findMany({
    where: eq(parkingLocationsTable.isActive, true),
  });

  const totalActive = tickets.filter((t) => t.status === "active").length;
  const totalDelivered = tickets.filter((t) => t.status === "delivered").length;
  const totalInTransit = tickets.filter((t) => t.status === "in_transit").length;
  const totalRelocated = tickets.filter((t) => t.status === "relocated").length;

  const byLocation = locations.map((loc) => ({
    locationId: loc.id,
    locationName: loc.name,
    colorHex: loc.colorHex,
    count: tickets.filter(
      (t) =>
        (t.parkingLocationId === loc.id || t.relocatedToLocationId === loc.id) &&
        t.status !== "delivered",
    ).length,
    capacity: loc.capacity,
  }));

  res.json({ totalActive, totalDelivered, totalInTransit, totalRelocated, byLocation });
});

export default router;
