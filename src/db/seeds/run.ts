import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { generateSeedSql } from "./generate-sql";

export async function runSeed() {
  console.log("Generating seed SQL from canonical NEET dataset...");
  const sql = generateSeedSql();
  const sqlPath = path.resolve(process.cwd(), "src/db/seeds/seed-neet.sql");
  fs.writeFileSync(sqlPath, sql, "utf-8");
  console.log(`Wrote seed SQL to ${sqlPath}`);

  console.log("Applying seed to local D1 database...");
  try {
    const cmd = `pnpm wrangler d1 execute pariksha-verse-db --local --file=src/db/seeds/seed-neet.sql`;
    execSync(cmd, { stdio: "inherit", shell: process.env.ComSpec || "cmd.exe" });
    console.log("Seeding completed successfully!");
  } catch (err) {
    console.error("Failed to execute D1 seed:", err);
    throw err;
  }
}

if (require.main === module || (process.argv[1] && process.argv[1].endsWith("run.ts"))) {
  runSeed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
