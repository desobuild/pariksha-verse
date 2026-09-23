import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "@/lib/storage/memory-storage";
import {
  generateGuestIdentity,
  getOrCreateGuestIdentity,
  clearGuestIdentity,
  GUEST_IDENTITY_KEY,
} from "@/lib/auth/guest-identity";

describe("Guest Identity Lifecycle", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it("generates a cryptographically random, privacy-preserving UUID", () => {
    const identity1 = generateGuestIdentity();
    const identity2 = generateGuestIdentity();

    expect(identity1.id).toBeDefined();
    expect(identity2.id).toBeDefined();
    expect(identity1.id).not.toBe(identity2.id);
    expect(identity1.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("creates and persists guest identity if none exists", async () => {
    const identity = await getOrCreateGuestIdentity(storage);

    expect(identity.id).toBeDefined();
    const stored = await storage.getItem(GUEST_IDENTITY_KEY);
    expect(stored).toEqual(identity);
  });

  it("returns the existing stable guest identity across reloads and checks", async () => {
    const firstCall = await getOrCreateGuestIdentity(storage);
    const secondCall = await getOrCreateGuestIdentity(storage);

    expect(secondCall.id).toBe(firstCall.id);
    expect(secondCall.createdAt).toBe(firstCall.createdAt);
  });

  it("safely replaces malformed or corrupted stored guest identity", async () => {
    // Inject corrupt data
    await storage.setItem(GUEST_IDENTITY_KEY, { invalid: "junk_data" });

    const recovered = await getOrCreateGuestIdentity(storage);
    expect(recovered.id).toBeDefined();
    expect(typeof recovered.id).toBe("string");
    expect(typeof recovered.createdAt).toBe("number");
    expect(recovered.id).not.toBe("junk_data");
  });

  it("clears guest identity upon explicit reset", async () => {
    await getOrCreateGuestIdentity(storage);
    await clearGuestIdentity(storage);

    const stored = await storage.getItem(GUEST_IDENTITY_KEY);
    expect(stored).toBeNull();
  });
});
