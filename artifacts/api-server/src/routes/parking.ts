import { Router } from "express";
import { db } from "@workspace/db";
import { parkingLocationsTable, valetTicketsTable } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { CreateParkingLocationBody, UpdateParkingLocationBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/parking-locations?eventId=
router.get("/parking-locations", requireAuth(), async (req, res) => {
  const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;

  const locations = await db.query.parkingLocationsTable.findMany({
    where: eq(parkingLocationsTable.isActive, true),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  // Count current tickets per location for this event
  const enriched = await Promise.all(
    locations.map(async (loc) => {
      let currentCount = 0;
      if (eventId) {
        const tickets = await db.query.valetTicketsTable.findMany({
          where: and(
            eq(valetTicketsTable.eventId, eventId),
            ne(valetTicketsTable.status, "delivered"),
          ),
        });
        currentCount = tickets.filter(
          (t) =>
            t.parkingLocationId === loc.id ||
            t.relocatedToLocationId === loc.id,
        ).length;
      }
      return { ...loc, currentCount };
    }),
  );

  res.json(enriched);
});

// POST /api/parking-locations
router.post("/parking-locations", requireAuth(["owner"]), async (req, res) => {
  const parsed = CreateParkingLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const [location] = await db
    .insert(parkingLocationsTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({ ...location, currentCount: 0 });
});

// PATCH /api/parking-locations/:locationId
router.patch("/parking-locations/:locationId", requireAuth(["owner"]), async (req, res) => {
  const locationId = parseInt(req.params.locationId as string);
  const parsed = UpdateParkingLocationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const [updated] = await db
    .update(parkingLocationsTable)
    .set(parsed.data)
    .where(eq(parkingLocationsTable.id, locationId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({ ...updated, currentCount: 0 });
});

// DELETE /api/parking-locations/:locationId
router.delete("/parking-locations/:locationId", requireAuth(["owner"]), async (req, res) => {
  const locationId = parseInt(req.params.locationId as string);
  await db.delete(parkingLocationsTable).where(eq(parkingLocationsTable.id, locationId));
  res.json({ success: true });
});

export default router;
