import type { CloudflareEnv } from "@/types/cloudflare";

/**
 * Access the Cloudflare Workers runtime environment bindings safely on the
 * server. Ensures D1 and other bindings are NEVER exposed to client components.
 *
 * Binding resolution order:
 *
 * 1. `globalThis.__CLOUDFLARE_ENV__` — explicit adapter/test override. Nothing
 *    in the deployed vinext Worker assigns it; it exists for hosts and unit
 *    tests that construct the environment themselves.
 * 2. The official `cloudflare:workers` runtime module — how vinext/@cloudflare
 *    vite-plugin expose the deployed Worker's real bindings (vars, secrets,
 *    D1) at runtime. `env` is a live per-request getter on that module, so it
 *    is read on every call, never cached. The module only exists in workerd;
 *    in Node runtimes (next dev/build, vitest, tsx scripts) the dynamic import
 *    rejects and resolution falls through. `src/instrumentation.ts` awaits
 *    this warm-up before any request is served, so the first request already
 *    sees runtime bindings.
 * 3. `process.env` — Node fallback for local development and tests. Wrangler
 *    runtime bindings are NOT available here; getDb() additionally falls back
 *    to the local D1 adapter.
 *
 * The `@vite-ignore`/`webpackIgnore` directives keep every bundler from trying
 * to resolve the specifier at build time — workerd resolves built-in modules
 * natively at runtime, and Node simply rejects it (caught below).
 */

interface RuntimeCloudflareWorkersModule {
  env: Partial<CloudflareEnv>;
}

let runtimeCloudflareModule: RuntimeCloudflareWorkersModule | undefined;
let runtimeModulePromise: Promise<void> | null = null;

/**
 * The module specifier is computed at runtime so that no bundler tries to
 * resolve it at build time: workerd resolves built-in modules natively, and
 * Node runtimes simply reject the import (caught below).
 */
const CLOUDFLARE_WORKERS_MODULE_SPECIFIER = "cloudflare:" + "workers";

/**
 * Resolves (once) the official `cloudflare:workers` runtime module so that
 * `getCloudflareEnv()` can read live Worker bindings synchronously. Safe to
 * call in any runtime: outside workerd it resolves without effect.
 */
export function ensureCloudflareEnvLoaded(): Promise<void> {
  if (!runtimeModulePromise) {
    runtimeModulePromise = import(
      /* @vite-ignore */ /* webpackIgnore: true */ CLOUDFLARE_WORKERS_MODULE_SPECIFIER
    )
      .then((mod) => {
        runtimeCloudflareModule = mod as unknown as RuntimeCloudflareWorkersModule;
      })
      .catch(() => {
        // Not running in workerd (next dev/build, vitest, tsx scripts):
        // getCloudflareEnv() falls back to global/process.env resolution.
      });
  }
  return runtimeModulePromise;
}

// Warm up as early as possible; src/instrumentation.ts additionally awaits
// this before the first request is served in every runtime.
void ensureCloudflareEnvLoaded();

export function getCloudflareEnv(): Partial<CloudflareEnv> {
  if (
    typeof window !== "undefined" &&
    !process.env.VITEST &&
    process.env.NODE_ENV !== "test"
  ) {
    throw new Error(
      "SECURITY VIOLATION: getCloudflareEnv() must never be invoked in client components."
    );
  }

  // 1. Explicit adapter/test override wins.
  if (typeof globalThis !== "undefined" && globalThis.__CLOUDFLARE_ENV__) {
    return globalThis.__CLOUDFLARE_ENV__;
  }

  // 2. Official runtime bindings (workerd only). `env` is a live getter that
  //    reflects the current request's bindings — never cache the object.
  const runtimeEnv = runtimeCloudflareModule?.env;
  if (runtimeEnv && typeof runtimeEnv === "object") {
    return extractKnownBindings({
      ENVIRONMENT: runtimeEnv.ENVIRONMENT,
      SESSION_SECRET: runtimeEnv.SESSION_SECRET,
      RESEND_API_KEY: runtimeEnv.RESEND_API_KEY,
      EMAIL_FROM: runtimeEnv.EMAIL_FROM,
      NEXT_PUBLIC_APP_URL: runtimeEnv.NEXT_PUBLIC_APP_URL,
      ENABLE_TEST_AUTH_MOCK: runtimeEnv.ENABLE_TEST_AUTH_MOCK,
      DB:
        runtimeEnv.DB && typeof runtimeEnv.DB.prepare === "function"
          ? runtimeEnv.DB
          : undefined,
    });
  }

  // 3. Node fallback (local development, tests, scripts).
  const nodeEnv = (typeof process !== "undefined" ? process.env : {}) as unknown as Record<
    string,
    unknown
  >;
  return extractKnownBindings({
    ENVIRONMENT: (nodeEnv.ENVIRONMENT || nodeEnv.NODE_ENV || "development") as string,
    SESSION_SECRET: typeof nodeEnv.SESSION_SECRET === "string" ? nodeEnv.SESSION_SECRET : undefined,
    RESEND_API_KEY: typeof nodeEnv.RESEND_API_KEY === "string" ? nodeEnv.RESEND_API_KEY : undefined,
    EMAIL_FROM: typeof nodeEnv.EMAIL_FROM === "string" ? nodeEnv.EMAIL_FROM : undefined,
    NEXT_PUBLIC_APP_URL:
      typeof nodeEnv.NEXT_PUBLIC_APP_URL === "string" ? nodeEnv.NEXT_PUBLIC_APP_URL : undefined,
    ENABLE_TEST_AUTH_MOCK:
      typeof nodeEnv.ENABLE_TEST_AUTH_MOCK === "string" ? nodeEnv.ENABLE_TEST_AUTH_MOCK : undefined,
    DB: nodeEnv.DB && typeof (nodeEnv.DB as { prepare?: unknown }).prepare === "function" ? (nodeEnv.DB as D1Database) : undefined,
  });
}

function extractKnownBindings(source: {
  ENVIRONMENT?: string;
  SESSION_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  NEXT_PUBLIC_APP_URL?: string;
  ENABLE_TEST_AUTH_MOCK?: string;
  DB?: D1Database;
}): Partial<CloudflareEnv> {
  const env: Partial<CloudflareEnv> = {
    ENVIRONMENT: source.ENVIRONMENT,
    SESSION_SECRET: source.SESSION_SECRET,
    RESEND_API_KEY: source.RESEND_API_KEY,
    EMAIL_FROM: source.EMAIL_FROM,
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    ENABLE_TEST_AUTH_MOCK: source.ENABLE_TEST_AUTH_MOCK,
  };
  if (source.DB) {
    env.DB = source.DB;
  }
  return env;
}
