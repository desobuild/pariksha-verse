import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Access the Cloudflare Workers environment bindings safely on the server.
 * Ensures D1 and other bindings are NEVER exposed to client components.
 */
export function getCloudflareEnv(): Partial<CloudflareEnv> {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: getCloudflareEnv() must never be invoked in client components."
    );
  }

  // Check global worker context
  if (typeof globalThis !== "undefined" && globalThis.__CLOUDFLARE_ENV__) {
    return globalThis.__CLOUDFLARE_ENV__;
  }

  // Check process.env for local node / wrangler proxy
  const nodeEnv = process.env as unknown as Record<string, unknown>;
  if (nodeEnv.DB && typeof (nodeEnv.DB as { prepare?: unknown }).prepare === "function") {
    return {
      DB: nodeEnv.DB as unknown as D1Database,
      ENVIRONMENT: process.env.NODE_ENV,
    };
  }

  return {
    ENVIRONMENT: process.env.NODE_ENV || "development",
  };
}
