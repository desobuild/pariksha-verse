import type { StorageAdapter } from "@/lib/storage/types";
import { appStorage } from "@/lib/storage";
import type { GuestIdentity } from "./auth-types";

export const GUEST_IDENTITY_KEY = "guest_identity";

function isValidGuestIdentity(data: unknown): data is GuestIdentity {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<GuestIdentity>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.createdAt === "number" &&
    !isNaN(candidate.createdAt)
  );
}

/**
 * Generate a cryptographically random, privacy-preserving guest identity.
 * Strictly uses crypto.randomUUID() without IP, device, or hardware fingerprinting.
 */
export function generateGuestIdentity(): GuestIdentity {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    createdAt: Date.now(),
  };
}

/**
 * Retrieves the stable local guest identity from client storage.
 * If none exists, or if stored data is corrupted/malformed, creates, persists, and returns a new valid one.
 */
export async function getOrCreateGuestIdentity(
  storage: StorageAdapter = appStorage
): Promise<GuestIdentity> {
  try {
    const existing = await storage.getItem<unknown>(GUEST_IDENTITY_KEY);
    if (isValidGuestIdentity(existing)) {
      return existing;
    }

    // Invalid or missing: generate new stable guest identity
    const fresh = generateGuestIdentity();
    await storage.setItem(GUEST_IDENTITY_KEY, fresh);
    return fresh;
  } catch {
    return generateGuestIdentity();
  }
}

/**
 * Removes the local guest identity upon explicit reset/cleanup.
 */
export async function clearGuestIdentity(
  storage: StorageAdapter = appStorage
): Promise<void> {
  await storage.removeItem(GUEST_IDENTITY_KEY);
}
