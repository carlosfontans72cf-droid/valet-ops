import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// App-level configuration (singleton row)
export const appConfigTable = pgTable("app_config", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull().default("Valet App"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Owner access code (permanent, not event-specific)
export const accessCodesTable = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id"), // null = owner code (works always), set = event-specific
  code: text("code").notNull().unique(),
  role: text("role").notNull(), // 'owner' | 'admin' | 'driver'
  label: text("label").notNull(), // e.g. "Admin Turno 1" or "Chofer Juan"
  isActive: boolean("is_active").notNull().default(true),
  expiresAfterShiftClose: boolean("expires_after_shift_close")
    .notNull()
    .default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Events
export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eventDate: text("event_date").notNull(), // stored as YYYY-MM-DD
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shifts - open/close periods within an event
export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  label: text("label").notNull(), // e.g. "Turno Mañana"
  openedBy: text("opened_by").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  isOpen: boolean("is_open").notNull().default(true),
});

// Parking locations
export const parkingLocationsTable = pgTable("parking_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  colorHex: text("color_hex").notNull().default("#3B82F6"),
  isActive: boolean("is_active").notNull().default(true),
});

// Valet tickets
export const valetTicketsTable = pgTable("valet_tickets", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  shiftId: integer("shift_id").notNull(),
  valetNumber: text("valet_number").notNull(),
  driverName: text("driver_name").notNull(),
  keyLocation: text("key_location").notNull(), // 'drawer' | 'board' | 'not_found' | 'with_owner'
  parkingLocationId: integer("parking_location_id"),
  status: text("status").notNull().default("active"), // 'active' | 'in_transit' | 'delivered' | 'relocated'
  vehicleDamages: jsonb("vehicle_damages")
    .$type<string[]>()
    .notNull()
    .default([]),
  notes: text("notes"),
  relocatedToLocationId: integer("relocated_to_location_id"),
  vehicleColor: text("vehicle_color"),
  vehicleBrand: text("vehicle_brand"),
  licensePlate: text("license_plate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
});

// Login rate limiting — tracks failed attempts per IP
export const loginAttemptsTable = pgTable("login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull().default(0),
  blocked: boolean("blocked").notNull().default(false),
  lastAttempt: timestamp("last_attempt").defaultNow().notNull(),
});

// Persistent sessions (survives server restarts)
export const sessionsTable = pgTable("sessions", {
  token: text("token").primaryKey(),
  role: text("role").notNull(),
  driverName: text("driver_name"),
  eventId: integer("event_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;

// Insert schemas
export const insertAppConfigSchema = createInsertSchema(appConfigTable).omit({
  id: true,
  updatedAt: true,
});
export const insertAccessCodeSchema = createInsertSchema(accessCodesTable).omit(
  { id: true, createdAt: true },
);
export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
});
export const insertShiftSchema = createInsertSchema(shiftsTable).omit({
  id: true,
  openedAt: true,
});
export const insertParkingLocationSchema = createInsertSchema(
  parkingLocationsTable,
).omit({ id: true });
export const insertValetTicketSchema = createInsertSchema(
  valetTicketsTable,
).omit({ id: true, createdAt: true });

// Types
export type AppConfig = typeof appConfigTable.$inferSelect;
export type AccessCode = typeof accessCodesTable.$inferSelect;
export type Event = typeof eventsTable.$inferSelect;
export type Shift = typeof shiftsTable.$inferSelect;
export type ParkingLocation = typeof parkingLocationsTable.$inferSelect;
export type ValetTicket = typeof valetTicketsTable.$inferSelect;

export type InsertAppConfig = z.infer<typeof insertAppConfigSchema>;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type InsertParkingLocation = z.infer<typeof insertParkingLocationSchema>;
export type InsertValetTicket = z.infer<typeof insertValetTicketSchema>;
