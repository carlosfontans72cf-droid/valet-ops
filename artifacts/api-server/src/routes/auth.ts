import { Router, Request } from "express";
import { db } from "@workspace/db";
import {
  accessCodesTable,
  shiftsTable,
  eventsTable,
  sessionsTable,
  loginAttemptsTable,
} from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_ATTEMPTS = 5;

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

async function createSession(data: {
  role: string;
  driverName?: string;
  eventId?: number;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionsTable).values({ token, expiresAt, ...data });
  return token;
}

async function getSession(token: string) {
  const row = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.token, token),
  });
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    return null;
  }
  return row;
}

// Cleanup expired sessions (fire-and-forget)
async function cleanExpired() {
  try {
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  } catch {}
}

async function recordFailedAttempt(ip: string): Promise<boolean> {
  const existing = await db.query.loginAttemptsTable.findFirst({
    where: eq(loginAttemptsTable.ip, ip),
  });

  const newCount = (existing?.count ?? 0) + 1;
  const shouldBlock = newCount >= MAX_ATTEMPTS;

  await db
    .insert(loginAttemptsTable)
    .values({ ip, count: newCount, blocked: shouldBlock, lastAttempt: new Date() })
    .onConflictDoUpdate({
      target: loginAttemptsTable.ip,
      set: { count: newCount, blocked: shouldBlock, lastAttempt: new Date() },
    });

  return shouldBlock;
}

async function resetAttempts(ip: string) {
  await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ip, ip));
}

async function isBlocked(ip: string): Promise<boolean> {
  const row = await db.query.loginAttemptsTable.findFirst({
    where: eq(loginAttemptsTable.ip, ip),
  });
  return row?.blocked === true;
}

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  cleanExpired();

  const ip = getClientIp(req);

  // Check if IP is blocked
  if (await isBlocked(ip)) {
    res.status(429).json({
      error: "ip_blocked",
      message: "Dispositivo bloqueado por demasiados intentos fallidos. Contacta al dueño.",
    });
    return;
  }

  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", message: "Datos inválidos" });
    return;
  }

  const { code, driverName, eventId } = parsed.data;

  const accessCode = await db.query.accessCodesTable.findFirst({
    where: and(
      eq(accessCodesTable.code, code),
      eq(accessCodesTable.isActive, true),
    ),
  });

  if (!accessCode) {
    const blocked = await recordFailedAttempt(ip);
    if (blocked) {
      res.status(429).json({
        error: "ip_blocked",
        message: `Demasiados intentos fallidos. Dispositivo bloqueado. Contacta al dueño.`,
      });
    } else {
      res.status(401).json({ error: "invalid_code", message: "Código inválido" });
    }
    return;
  }

  // Owner: can always log in, no event required
  if (accessCode.role === "owner") {
    await resetAttempts(ip);
    const token = await createSession({ role: "owner" });
    res.json({ role: "owner", sessionToken: token });
    return;
  }

  // Admin/Driver: need eventId
  if (!eventId) {
    res.status(400).json({
      error: "event_required",
      message: "Se requiere el ID del evento para admin/chofer",
    });
    return;
  }

  // Validate the code belongs to this event (or is global for this role)
  if (accessCode.eventId !== null && accessCode.eventId !== eventId) {
    const blocked = await recordFailedAttempt(ip);
    if (blocked) {
      res.status(429).json({
        error: "ip_blocked",
        message: `Demasiados intentos fallidos. Dispositivo bloqueado. Contacta al dueño.`,
      });
    } else {
      res.status(401).json({ error: "invalid_code", message: "Código no válido para este evento" });
    }
    return;
  }

  // Check event exists and is active
  const event = await db.query.eventsTable.findFirst({
    where: and(eq(eventsTable.id, eventId), eq(eventsTable.isActive, true)),
  });

  if (!event) {
    res.status(401).json({ error: "event_inactive", message: "Evento inactivo o no encontrado" });
    return;
  }

  // Driver: driverName required
  if (accessCode.role === "driver" && !driverName?.trim()) {
    res.status(400).json({ error: "name_required", message: "Se requiere nombre del chofer" });
    return;
  }

  // Check there's an open shift for the event
  const openShift = await db.query.shiftsTable.findFirst({
    where: and(
      eq(shiftsTable.eventId, eventId),
      eq(shiftsTable.isOpen, true),
    ),
  });

  if (!openShift) {
    res.status(403).json({
      error: "no_open_shift",
      message: "No hay un turno abierto. Contacta al administrador.",
    });
    return;
  }

  await resetAttempts(ip);
  const token = await createSession({
    role: accessCode.role,
    driverName: driverName?.trim(),
    eventId,
  });

  res.json({
    role: accessCode.role,
    driverName: driverName?.trim(),
    eventId,
    sessionToken: token,
  });
});

// GET /api/auth/me
router.get("/auth/me", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  const session = await getSession(token);
  if (!session) {
    res.status(401).json({ error: "session_expired" });
    return;
  }

  res.json({
    role: session.role,
    driverName: session.driverName,
    eventId: session.eventId,
  });
});

// POST /api/auth/logout
router.post("/auth/logout", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ success: true });
});

// GET /api/auth/blocked-ips — owner only
router.get("/auth/blocked-ips", requireAuth(["owner"]), async (_req, res) => {
  const rows = await db.query.loginAttemptsTable.findMany({
    where: eq(loginAttemptsTable.blocked, true),
  });
  res.json(rows.map((r) => ({ ip: r.ip, count: r.count, lastAttempt: r.lastAttempt })));
});

// DELETE /api/auth/blocked-ips/:ip — owner only
router.delete("/auth/blocked-ips/:ip", requireAuth(["owner"]), async (req, res) => {
  const ip = decodeURIComponent(req.params.ip as string);
  await db.delete(loginAttemptsTable).where(eq(loginAttemptsTable.ip, ip));
  res.json({ success: true });
});

export default router;
