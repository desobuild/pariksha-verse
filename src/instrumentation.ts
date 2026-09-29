/**
 * Next.js/vinext instrumentation hook — the official server-startup boundary.
 *
 * vinext bakes `register()` as a top-level await into the generated RSC entry
 * (and awaits instrumentation before serving any request); Next.js runs it at
 * server startup. Resolving the Cloudflare runtime bindings here guarantees
 * `getCloudflareEnv()` sees the real `cloudflare:workers` bindings before the
 * first route handler executes — closing the first-request race that a plain
 * fire-and-forget import inside env.ts would otherwise have.
 *
 * In Node runtimes (next dev/build, vitest, tsx scripts) the import inside
 * env.ts rejects and the process.env fallback remains in charge — local
 * behavior is unchanged.
 */
export async function register(): Promise<void> {
  const { ensureCloudflareEnvLoaded } = await import("@/lib/cloudflare/env");
  await ensureCloudflareEnvLoaded();
}
