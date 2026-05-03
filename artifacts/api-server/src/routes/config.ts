import { Router } from "express";
import { db } from "@workspace/db";
import { appConfigTable } from "@workspace/db";
import { UpdateConfigBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// GET /api/config
router.get("/config", async (_req, res) => {
  let config = await db.query.appConfigTable.findFirst();
  if (!config) {
    const [created] = await db
      .insert(appConfigTable)
      .values({ appName: "Valet App" })
      .returning();
    config = created;
  }
  res.json(config);
});

// PATCH /api/config (owner only)
router.patch("/config", requireAuth(["owner"]), async (req, res) => {
  const parsed = UpdateConfigBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  let config = await db.query.appConfigTable.findFirst();
  if (!config) {
    const [created] = await db
      .insert(appConfigTable)
      .values({ appName: parsed.data.appName ?? "Valet App" })
      .returning();
    res.json(created);
    return;
  }

  const [updated] = await db
    .update(appConfigTable)
    .set({ appName: parsed.data.appName ?? config.appName, updatedAt: new Date() })
    .returning();
  res.json(updated);
});

export default router;
