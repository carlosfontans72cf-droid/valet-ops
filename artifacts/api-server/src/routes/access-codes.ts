import { Router } from "express";
import { db } from "@workspace/db";
import { accessCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateAccessCodeBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import crypto from "crypto";

const router = Router();

function randomCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(length))
    .map((b) => chars[b % chars.length])
    .join("");
}

// GET /api/access-codes?eventId=
router.get("/access-codes", requireAuth(["owner"]), async (req, res) => {
  const eventId = parseInt(req.query.eventId as string);
  if (!eventId) {
    res.status(400).json({ error: "eventId required" });
    return;
  }

  const codes = await db.query.accessCodesTable.findMany({
    where: eq(accessCodesTable.eventId, eventId),
    orderBy: (t, { asc }) => [asc(t.role)],
  });

  res.json(codes);
});

// POST /api/access-codes
router.post("/access-codes", requireAuth(["owner"]), async (req, res) => {
  const parsed = CreateAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: parsed.error.message });
    return;
  }

  const [code] = await db
    .insert(accessCodesTable)
    .values({
      ...parsed.data,
      isActive: true,
      expiresAfterShiftClose: parsed.data.expiresAfterShiftClose ?? true,
    })
    .returning();

  res.status(201).json(code);
});

// POST /api/access-codes/bulk — generate N driver + M admin codes at once
router.post("/access-codes/bulk", requireAuth(["owner"]), async (req, res) => {
  const body = req.body as { eventId?: unknown; driverCount?: unknown; adminCount?: unknown };
  const eventId = typeof body.eventId === "number" ? body.eventId : NaN;
  const driverCount = typeof body.driverCount === "number" ? body.driverCount : NaN;
  const adminCount = typeof body.adminCount === "number" ? body.adminCount : NaN;

  if (!Number.isInteger(eventId) || eventId <= 0 ||
      !Number.isInteger(driverCount) || driverCount < 0 || driverCount > 50 ||
      !Number.isInteger(adminCount) || adminCount < 0 || adminCount > 20) {
    res.status(400).json({ error: "invalid_body", message: "Parámetros inválidos" });
    return;
  }
  const total = driverCount + adminCount;
  if (total === 0) {
    res.status(400).json({ error: "invalid_body", message: "Debe generar al menos 1 código" });
    return;
  }

  const values: Array<{
    eventId: number;
    code: string;
    role: string;
    label: string;
    isActive: boolean;
    expiresAfterShiftClose: boolean;
  }> = [];

  for (let i = 1; i <= driverCount; i++) {
    values.push({
      eventId,
      code: randomCode(),
      role: "driver",
      label: `Chofer ${i}`,
      isActive: true,
      expiresAfterShiftClose: true,
    });
  }

  for (let i = 1; i <= adminCount; i++) {
    values.push({
      eventId,
      code: randomCode(),
      role: "admin",
      label: `Administrador ${i}`,
      isActive: true,
      expiresAfterShiftClose: true,
    });
  }

  const created = await db.insert(accessCodesTable).values(values).returning();
  res.status(201).json(created);
});

// DELETE /api/access-codes/:codeId
router.delete("/access-codes/:codeId", requireAuth(["owner"]), async (req, res) => {
  const codeId = parseInt(req.params.codeId as string);
  await db.delete(accessCodesTable).where(eq(accessCodesTable.id, codeId));
  res.json({ success: true });
});

export default router;
