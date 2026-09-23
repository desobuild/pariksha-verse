import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme", { enum: ["light", "dark", "system"] })
    .notNull()
    .default("system"),
  dailyStudyGoalMinutes: integer("daily_study_goal_minutes").notNull().default(120),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  /**
   * Phase 5 onboarding: current preparation stage (see domain/preparation.ts).
   * Nullable so existing preference rows remain valid before onboarding.
   */
  preparationStage: text("preparation_stage", {
    enum: [
      "just_starting",
      "building_fundamentals",
      "practicing_regularly",
      "revising",
      "final_preparation",
    ],
  }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const notificationPreferences = sqliteTable("notification_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  studyReminders: integer("study_reminders", { mode: "boolean" }).notNull().default(true),
  revisionReminders: integer("revision_reminders", { mode: "boolean" }).notNull().default(true),
  mockTestReminders: integer("mock_test_reminders", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreferences = typeof notificationPreferences.$inferInsert;
