import { Router } from "express";
import { db } from "@workspace/db";
import { shiftsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateShiftBody, UpdateShiftBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/shifts?eventId=
router.get("/shifts", requireAuth(), async (req, res) => {
  const eventId = parseInt(req.query.eventId as string);
  if (!eventId) {
    res.status(400).json({ error: "eventId required" });
    return;
  }
  const shifts = await db.query.shiftsTable.findMany({
    where: eq(shiftsTable.eventId, eventId),
    orderBy: (t, { desc }) => [desc(t.openedAt)],
  });
  res.json(shifts);
});

// POST /api/shifts
router.post("/shifts", requireAuth(["owner", "admin"]), async (req, res) => {
  const parsed = CreateShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: parsed.error.message });
    return;
  }

  const [shift] = await db
    .insert(shiftsTable)
    .values({ ...parsed.data, isOpen: true })
    .returning();
  res.status(201).json(shift);
});

// PATCH /api/shifts/:shiftId
router.patch("/shifts/:shiftId", requireAuth(["owner", "admin"]), async (req, res) => {
  const shiftId = parseInt(req.params.shiftId as string);
  const parsed = UpdateShiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const updateData: Partial<typeof shiftsTable.$inferInsert> = {};
  if (parsed.data.label !== undefined) updateData.label = parsed.data.label;
  if (parsed.data.isOpen !== undefined) updateData.isOpen = parsed.data.isOpen;
  if (parsed.data.closedAt !== undefined)
    updateData.closedAt = new Date(parsed.data.closedAt);
  if (parsed.data.isOpen === false && !parsed.data.closedAt)
    updateData.closedAt = new Date();

  const [updated] = await db
    .update(shiftsTable)
    .set(updateData)
    .where(eq(shiftsTable.id, shiftId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(updated);
});

export default router;
