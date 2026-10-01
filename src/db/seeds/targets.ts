/**
 * Phase 14D — environment-explicit seed targets.
 *
 * The seed target is never inferred from ambient configuration: every target
 * is pinned to the exact database name declared for that environment in
 * wrangler.jsonc, and remote targets additionally pass wrangler's --env and
 * --remote flags so wrangler resolves the matching d1_databases block. A
 * mismatch between this map and wrangler.jsonc is a tested regression
 * (tests/unit/production-seed-boundary.test.ts).
 */

export type SeedEnvironment = "local" | "staging" | "production";

export interface SeedTarget {
  environment: SeedEnvironment;
  /** Database name passed to `wrangler d1 execute <name>` — mirrors wrangler.jsonc. */
  databaseName: string;
  /** Wrangler flags that pin the environment/remote-ness of the execution. */
  wranglerArgs: string[];
}

export const SEED_TARGETS: Record<SeedEnvironment, Omit<SeedTarget, "environment">> = {
  local: {
    databaseName: "pariksha-verse-db-local",
    wranglerArgs: ["--local"],
  },
  staging: {
    databaseName: "pariksha-verse-db-staging",
    wranglerArgs: ["--env", "staging", "--remote"],
  },
  production: {
    databaseName: "pariksha-verse-db-production",
    wranglerArgs: ["--env", "production", "--remote"],
  },
};

export function listSeedTargets(): Record<SeedEnvironment, string> {
  return Object.fromEntries(
    Object.entries(SEED_TARGETS).map(([env, t]) => [env, t.databaseName])
  ) as Record<SeedEnvironment, string>;
}

/**
 * Resolves the seed target from CLI args. Supports `--env=<name>` and
 * `--env <name>`. Defaults to local; unknown values are rejected instead of
 * being silently mapped onto some database.
 */
export function resolveSeedTarget(argv: string[]): SeedTarget {
  let envName: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env") {
      envName = argv[i + 1];
      break;
    }
    if (arg.startsWith("--env=")) {
      envName = arg.slice("--env=".length);
      break;
    }
  }

  if (envName === undefined) {
    return { environment: "local", ...SEED_TARGETS.local };
  }

  const normalized = envName.trim().toLowerCase();
  if (normalized === "local" || normalized === "development") {
    return { environment: "local", ...SEED_TARGETS.local };
  }
  if (normalized === "staging") {
    return { environment: "staging", ...SEED_TARGETS.staging };
  }
  if (normalized === "production" || normalized === "prod") {
    return { environment: "production", ...SEED_TARGETS.production };
  }

  throw new Error(
    `Unknown seed environment "${envName}". Allowed: local, staging, production.`
  );
}
