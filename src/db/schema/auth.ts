import { sqliteTable, text, integer, uniqueIndex, index, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./users";

/**
 * Phase 14E — server-side auth security tables.
 *
 * These tables back the three server-side guarantees added in Phase 14E:
 * - verification_tokens: one-time-use magic-link tokens (digest-only storage;
 *   the raw HMAC token never touches the database).
 * - user_sessions: server-side session records that make logout/revocation
 *   effective against a stolen pv_session cookie (identifier-only storage).
 * - rate_limit_buckets: D1-backed fixed-window abuse counters for the
 *   authentication endpoints.
 *
 * All three are infrastructure tables: rows are transient, never seeded, and
 * cleaned up opportunistically by the issuing code paths.
 */

/**
 * One-time magic-link verification tokens.
 *
 * `token_hash` is the SHA-256 hex digest of the exact signed token string —
 * storing the digest (not the raw bearer token) means a database leak cannot
 * be replayed against the verify endpoint.
 *
 * `consumed_nonce` is a per-attempt random UUID written by the atomic consume
 * UPDATE. The unique index makes double-consumption impossible even under
 * concurrent verify requests: only the UPDATE that flips NULL → nonce wins,
 * and the nonce lets the winner identify its own row.
 */
export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    consumedAt: integer("consumed_at", { mode: "timestamp" }),
    consumedNonce: text("consumed_nonce"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("verification_tokens_token_hash_unique").on(table.tokenHash),
    uniqueIndex("verification_tokens_consumed_nonce_unique").on(table.consumedNonce),
  ]
);

/**
 * Server-side session records for the pv_session cookie.
 *
 * `id` is the `jti` embedded in the HMAC-signed session payload. getSession()
 * requires a live, unrevoked row to match the signed jti, so logout can
 * invalidate a session server-side and a stolen cookie dies with it. Raw
 * session tokens are never stored.
 */
export const userSessions = sqliteTable(
  "user_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

/**
 * Fixed-window rate-limit counters for authentication endpoints.
 *
 * `key` is "<rule>:<identifier>" (identifier is the client IP or the email
 * being authenticated). `window_start` is the epoch-second start of the
 * window, part of the primary key so window rollover naturally starts a fresh
 * counter. Increment + read happens in a single atomic upsert.
 */
export const rateLimitBuckets = sqliteTable(
  "rate_limit_buckets",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index("rate_limit_buckets_window_start_idx").on(table.windowStart),
  ]
);

export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type NewRateLimitBucket = typeof rateLimitBuckets.$inferInsert;
