import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Minimal health check verification table.
 * Used strictly to verify D1 + Drizzle connectivity and migrations in Phase 1.
 * Application business tables will be finalized and introduced in Phase 2.
 */
export const healthCheck = sqliteTable("health_check", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  checkedAt: integer("checked_at", { mode: "timestamp" }).notNull(),
});

export type HealthCheck = typeof healthCheck.$inferSelect;
export type NewHealthCheck = typeof healthCheck.$inferInsert;
