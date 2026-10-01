import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import { verificationTokens } from "@/db/schema";
import { MAGIC_LINK_TTL_SECONDS } from "./crypto-session";
import { logger } from "@/lib/observability/logger";

/**
 * Phase 14E (PART B) — server-side one-time-use magic-link tokens.
 *
 * The signed token itself remains a stateless HMAC (crypto-session), but every
 * issued token is recorded here as a SHA-256 DIGEST. The verify endpoint can
 * then consume that record atomically, so a token creates at most one session
 * even when replayed or raced. Raw tokens are never stored, logged, or
 * returned: the database only ever sees the digest, which cannot be presented
 * back to the verify endpoint as a credential.
 */

export interface RecordedVerificationToken {
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** SHA-256 hex digest of the exact token string. Edge/Workers-compatible. */
export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Records a newly issued magic-link token (by digest) so it can be consumed
 * exactly once. MUST be called before the token is delivered; if this insert
 * fails, the token must not be sent.
 */
export async function recordVerificationTokenIssued(
  db: DatabaseInstance,
  params: { email: string; token: string }
): Promise<RecordedVerificationToken> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_SECONDS * 1000);
  const tokenHash = await hashToken(params.token);
  const tokenId = `vtok_${crypto.randomUUID()}`;

  await db.insert(verificationTokens).values({
    id: tokenId,
    email: params.email.toLowerCase(),
    tokenHash,
    expiresAt,
    createdAt: now,
  });

  // Opportunistic sweep so the table cannot grow without bound; a failed
  // cleanup must never fail a sign-in.
  try {
    await cleanupVerificationTokens(db, { now });
  } catch (error) {
    // Ignore — the next issue retries the sweep. Phase 14G: surfaced as a
    // structured event; token digests are never logged.
    logger.warn("db.cleanup.failed", {
      scope: "verification_tokens",
      error_name: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return { tokenId, tokenHash, expiresAt };
}

/**
 * Atomically consumes a magic-link token by digest.
 *
 * The consume is a single conditional UPDATE: the row is flipped from
 * unconsumed to consumed (with a per-attempt nonce) only when it exists,
 * matches this digest, is not expired, and has not been consumed before.
 * SQLite/D1 serialize writes, so exactly one concurrent verifier can ever see
 * changes === 1; everyone else loses the race and gets `false`.
 *
 * Returns true when THIS call is the one successful consumption.
 */
export async function consumeVerificationToken(
  db: DatabaseInstance,
  token: string
): Promise<boolean> {
  const tokenHash = await hashToken(token);
  const consumedNonce = crypto.randomUUID();

  const result = await db
    .update(verificationTokens)
    .set({ consumedAt: new Date(), consumedNonce })
    .where(
      and(
        eq(verificationTokens.tokenHash, tokenHash),
        // Unconsumed only: the nonce flip is what makes replay impossible.
        isNull(verificationTokens.consumedNonce),
        // Belt-and-braces against clock skew: the HMAC expiry check already
        // rejects expired tokens before this runs.
        gt(verificationTokens.expiresAt, new Date())
      )
    )
    .run();

  const changes = (result as { meta?: { changes?: number } })?.meta?.changes;
  if (typeof changes === "number") {
    return changes === 1;
  }

  // Portability fallback (should not happen on D1 or the local adapter):
  // re-read the row and confirm THIS attempt's nonce won the consume.
  const rows = await db
    .select({ consumedNonce: verificationTokens.consumedNonce })
    .from(verificationTokens)
    .where(eq(verificationTokens.tokenHash, tokenHash))
    .limit(1);
  return rows[0]?.consumedNonce === consumedNonce;
}

/**
 * Deletes verification-token records that are expired, or consumed and older
 * than the retention window, so the table cannot grow without bound. Called
 * opportunistically from the token-issuing endpoints.
 */
export async function cleanupVerificationTokens(
  db: DatabaseInstance,
  options?: { now?: Date; retentionSeconds?: number }
): Promise<void> {
  const now = options?.now ?? new Date();
  const retentionSeconds = options?.retentionSeconds ?? 7 * 24 * 60 * 60; // 7 days
  const cutoff = new Date(now.getTime() - retentionSeconds * 1000);

  await db
    .delete(verificationTokens)
    .where(
      or(
        lt(verificationTokens.expiresAt, cutoff),
        and(isNotNull(verificationTokens.consumedAt), lt(verificationTokens.consumedAt, cutoff))
      )
    );
}
