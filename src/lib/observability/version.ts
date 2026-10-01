import { BUILD_COMMIT_SHA, BUILD_VERSION } from "./build-info.generated";

/**
 * Phase 14G — application version / deployment identification.
 *
 * Both values are produced by `scripts/generate-build-info.mjs`, which runs
 * before every build (see package.json `build` / `vinext:build` / `cf:build`)
 * and on `postinstall`. There is no manually maintained version string:
 *
 * - BUILD_VERSION comes from package.json `version` (the existing source of
 *   truth for the application version).
 * - BUILD_COMMIT_SHA is the exact git commit the build was produced from,
 *   which doubles as the deterministic deployment identifier (Cloudflare's
 *   own per-deployment version id is not exposed to Worker code, and the
 *   Workers Logs dashboard tags every log line with it server-side).
 *
 * Only these two non-sensitive identifiers are exported; nothing here may
 * carry environment configuration, secrets, or runtime state. The generated
 * module is gitignored — a missing/failing git checkout degrades the SHA to
 * "unknown" without breaking the build.
 */

export const APP_VERSION = BUILD_VERSION;
export const APP_COMMIT_SHA = BUILD_COMMIT_SHA;

/** True when the build could not be attributed to a git commit. */
export function isCommitShaKnown(): boolean {
  return APP_COMMIT_SHA !== "unknown";
}
