import { asc, eq } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { examAttempts, users, type User, type UserWorkspace } from "@/db/schema";
import { getCloudflareEnv } from "@/lib/cloudflare/env";
import { ensureWorkspaceForUser } from "@/lib/workspaces/ensure-workspace";

/**
 * Phase 13A.3 — Staging-only demo authentication.
 *
 * Provides a frictionless, no-email sign-in for the friends-only staging
 * deployment. Identity is NEVER accepted from the client: the caller can only
 * pick a slot from this fixed, server-side roster. Every entry point fails
 * closed unless the trusted server-side ENVIRONMENT is exactly "staging".
 *
 * This module must only be imported from server code (route handlers).
 */

export interface StagingDemoIdentity {
  /** Client-visible slot key. The only value the client may choose. */
  slot: string;
  /** Human-friendly label rendered in the staging UI. */
  label: string;
  /** Deterministic user ID (stable across deploys so upserts are idempotent). */
  userId: string;
  /**
   * Non-deliverable identifier email. Uses the RFC 2606 reserved ".invalid"
   * TLD so it can never collide with a real person's address and can never
   * receive mail.
   */
  email: string;
}

export const STAGING_DEMO_IDENTITIES: readonly StagingDemoIdentity[] = [
  {
    slot: "friend-1",
    label: "Friend 1",
    userId: "usr_demo_staging_friend1",
    email: "demo-friend-1@staging.parikshaverse.invalid",
  },
  {
    slot: "friend-2",
    label: "Friend 2",
    userId: "usr_demo_staging_friend2",
    email: "demo-friend-2@staging.parikshaverse.invalid",
  },
  {
    slot: "friend-3",
    label: "Friend 3",
    userId: "usr_demo_staging_friend3",
    email: "demo-friend-3@staging.parikshaverse.invalid",
  },
  {
    slot: "friend-4",
    label: "Friend 4",
    userId: "usr_demo_staging_friend4",
    email: "demo-friend-4@staging.parikshaverse.invalid",
  },
  {
    slot: "friend-5",
    label: "Friend 5",
    userId: "usr_demo_staging_friend5",
    email: "demo-friend-5@staging.parikshaverse.invalid",
  },
];

export const DEFAULT_STAGING_DEMO_SLOT = "friend-1";

/**
 * Resolves the environment from trusted server-side configuration only
 * (Cloudflare bindings or server process env). Client input is never
 * consulted.
 */
export function resolveServerEnvironment(): string {
  const isServerOrTest =
    typeof window === "undefined" || !!process.env.VITEST || process.env.NODE_ENV === "test";
  if (!isServerOrTest) return "";

  const cfEnv = getCloudflareEnv();
  // Strict comparison: no trimming or normalization. Any value that is not
  // exactly "staging" (case-insensitive) fails closed.
  return String(cfEnv.ENVIRONMENT || process.env?.ENVIRONMENT || "").toLowerCase();
}

/**
 * Staging demo authentication is enabled ONLY when the trusted server-side
 * environment is exactly "staging". Fails closed everywhere else
 * (production, development, test, unset, or any client-claimed value).
 */
export function isStagingDemoAuthEnabled(): boolean {
  if (typeof window !== "undefined" && !process.env.VITEST && process.env.NODE_ENV !== "test") {
    return false;
  }

  if (resolveServerEnvironment() !== "staging") {
    return false;
  }

  // Belt-and-braces: never enable on known non-Workers production platforms.
  if (
    typeof process !== "undefined" &&
    (process.env?.VERCEL_ENV === "production" || process.env?.CF_PAGES === "1")
  ) {
    return false;
  }

  return true;
}

/**
 * Public-safe demo identity options for the staging UI. Contains only slots
 * and labels — never user IDs, emails, or any other implementation detail.
 */
export function getStagingDemoAuthOptions(): { slot: string; label: string }[] {
  if (!isStagingDemoAuthEnabled()) return [];
  return STAGING_DEMO_IDENTITIES.map(({ slot, label }) => ({ slot, label }));
}

/**
 * Maps a client-chosen slot to the fixed server-side demo identity.
 * Returns null for anything outside the roster.
 */
export function resolveStagingDemoIdentity(slot?: string): StagingDemoIdentity | null {
  const key = (slot ?? DEFAULT_STAGING_DEMO_SLOT).trim().toLowerCase();
  return STAGING_DEMO_IDENTITIES.find((i) => i.slot === key) ?? null;
}

/**
 * Idempotently provisions the fixed staging demo user row in D1.
 * Never creates user records derived from untrusted client input.
 */
export async function upsertStagingDemoUser(
  db: DatabaseInstance,
  identity: StagingDemoIdentity
): Promise<User> {
  const existing = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
  if (existing[0]) {
    return existing[0];
  }

  const now = new Date();
  await db
    .insert(users)
    .values({
      id: identity.userId,
      email: identity.email,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const created = await db.select().from(users).where(eq(users.id, identity.userId)).limit(1);
  if (!created[0]) {
    throw new Error("Failed to provision staging demo user.");
  }
  return created[0];
}

/**
 * Provisions (or reuses) a workspace for the demo user, reusing the existing
 * ownership-safe find-or-create path. The exam attempt is resolved entirely
 * server-side (active attempt first, else the first seeded attempt) — never
 * from client input. Returns null when no exam attempt exists, leaving
 * workspace creation to the normal onboarding flow.
 */
export async function ensureStagingDemoWorkspace(
  db: DatabaseInstance,
  userId: string
): Promise<UserWorkspace | null> {
  const attemptId = await resolveStagingExamAttemptId(db);
  if (!attemptId) return null;

  const result = await ensureWorkspaceForUser(db, userId, attemptId);
  return result.ok ? result.workspace : null;
}

async function resolveStagingExamAttemptId(db: DatabaseInstance): Promise<string | null> {
  const active = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.status, "active"))
    .orderBy(asc(examAttempts.createdAt), asc(examAttempts.id))
    .limit(1);
  if (active[0]) return active[0].id;

  const any = await db
    .select()
    .from(examAttempts)
    .orderBy(asc(examAttempts.createdAt), asc(examAttempts.id))
    .limit(1);
  return any[0]?.id ?? null;
}
