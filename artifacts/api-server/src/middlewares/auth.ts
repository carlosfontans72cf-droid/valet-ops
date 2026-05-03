import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  session?: {
    role: string;
    driverName?: string;
    eventId?: number;
  };
}

export function requireAuth(roles?: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const row = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.token, token),
    });

    if (!row || row.expiresAt < new Date()) {
      res.status(401).json({ error: "session_expired" });
      return;
    }

    if (roles && !roles.includes(row.role)) {
      res.status(403).json({ error: "forbidden", message: "Sin permisos" });
      return;
    }

    req.session = {
      role: row.role,
      driverName: row.driverName ?? undefined,
      eventId: row.eventId ?? undefined,
    };
    next();
  };
}
