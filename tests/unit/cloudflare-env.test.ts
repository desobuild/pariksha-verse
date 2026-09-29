import { afterEach, describe, expect, it } from "vitest";
import { ensureCloudflareEnvLoaded, getCloudflareEnv } from "@/lib/cloudflare/env";
import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Phase 13A.4 — Cloudflare runtime binding resolution.
 *
 * getCloudflareEnv() must prefer (1) the explicit __CLOUDFLARE_ENV__ adapter
 * override, then (2) the official cloudflare:workers runtime module (available
 * only in workerd — absent under vitest, where the warm-up import rejects),
 * then (3) process.env for Node runtimes.
 */
describe("getCloudflareEnv binding resolution", () => {
  const originalEnv = { ...process.env };
  const originalGlobalEnv = globalThis.__CLOUDFLARE_ENV__;

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.__CLOUDFLARE_ENV__ = originalGlobalEnv;
  });

  it("prefers the explicit __CLOUDFLARE_ENV__ adapter override", () => {
    globalThis.__CLOUDFLARE_ENV__ = {
      ENVIRONMENT: "staging",
      SESSION_SECRET: "override_secret_at_least_32_characters_long",
    } as unknown as CloudflareEnv;
    process.env.ENVIRONMENT = "development";

    const env = getCloudflareEnv();
    expect(env.ENVIRONMENT).toBe("staging");
    expect(env.SESSION_SECRET).toBe("override_secret_at_least_32_characters_long");
  });

  it("falls back to process.env outside workerd when no override exists", () => {
    globalThis.__CLOUDFLARE_ENV__ = undefined;
    process.env.ENVIRONMENT = "staging";
    process.env.SESSION_SECRET = "fallback_secret_at_least_32_characters_long";

    const env = getCloudflareEnv();
    expect(env.ENVIRONMENT).toBe("staging");
    expect(env.SESSION_SECRET).toBe("fallback_secret_at_least_32_characters_long");
    // A string DB value from process.env is not a D1 binding and must be dropped.
    (process.env as unknown as Record<string, unknown>).DB = "not-a-binding";
    expect(getCloudflareEnv().DB).toBeUndefined();
  });

  it("falls back to NODE_ENV, then development, when ENVIRONMENT is unset", () => {
    globalThis.__CLOUDFLARE_ENV__ = undefined;
    delete process.env.ENVIRONMENT;

    // vitest sets NODE_ENV=test; the Node fallback honors it before the
    // "development" default.
    expect(getCloudflareEnv().ENVIRONMENT).toBe(process.env.NODE_ENV || "development");
  });

  it("ensureCloudflareEnvLoaded resolves outside workerd and keeps Node fallback", async () => {
    globalThis.__CLOUDFLARE_ENV__ = undefined;
    process.env.ENVIRONMENT = "staging";

    await expect(ensureCloudflareEnvLoaded()).resolves.toBeUndefined();
    expect(getCloudflareEnv().ENVIRONMENT).toBe("staging");
    expect(getCloudflareEnv().DB).toBeUndefined();
  });
});
