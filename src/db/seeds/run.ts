import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { generateSeedSql } from "./generate-sql";
import { resolveSeedTarget, type SeedTarget } from "./targets";

/**
 * Phase 14D — environment-explicit canonical seed runner.
 *
 *   pnpm db:seed          -> local D1   (pariksha-verse-db-local, --local)
 *   pnpm db:seed:staging  -> staging    (pariksha-verse-db-staging, --env staging --remote)
 *   pnpm db:seed:prod     -> production (pariksha-verse-db-production, --env production --remote)
 *
 * Production seeding is therefore an explicit, opt-in operation; the default
 * bare `db:seed` can only ever touch the local database. Target resolution
 * lives in ./targets (mirrors wrangler.jsonc, unit-tested).
 */

export { resolveSeedTarget, SEED_TARGETS, listSeedTargets } from "./targets";
export type { SeedTarget, SeedEnvironment } from "./targets";

export async function runSeed(target: SeedTarget): Promise<void> {
  console.log("Generating seed SQL from canonical NEET dataset...");
  const sql = generateSeedSql();
  const sqlPath = path.resolve(process.cwd(), "src/db/seeds/seed-neet.sql");
  fs.writeFileSync(sqlPath, sql, "utf-8");
  console.log(`Wrote seed SQL to ${sqlPath}`);

  const wranglerArgs = [
    target.databaseName,
    ...target.wranglerArgs,
    `--file=src/db/seeds/seed-neet.sql`,
  ];
  console.log(
    `Applying seed to ${target.environment.toUpperCase()} database ` +
      `"${target.databaseName}" (wrangler d1 execute ${wranglerArgs.join(" ")})...`
  );

  try {
    const cmd = `pnpm wrangler d1 execute ${wranglerArgs.join(" ")}`;
    execSync(cmd, { stdio: "inherit", shell: process.env.ComSpec || "cmd.exe" });
    console.log(`Seeding completed successfully (target: ${target.environment}).`);
  } catch (err) {
    console.error("Failed to execute D1 seed:", err);
    throw err;
  }
}

async function main() {
  const target = resolveSeedTarget(process.argv.slice(2));
  await runSeed(target);
}

// ESM-safe "run directly" check (the repo ships as "type": "module", where
// require.main is unavailable under tsx/node).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
