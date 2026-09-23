import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getCloudflareEnv } from "@/lib/cloudflare/env";

export type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: DatabaseInstance | null = null;

/**
 * Get or initialize the Drizzle database client backed by Cloudflare D1.
 * Accepts an explicit D1 binding (useful in tests/worker fetch events),
 * or resolves it safely via the server-side environment layer.
 */
export function getDb(d1Binding?: D1Database): DatabaseInstance {
  if (d1Binding) {
    return drizzle(d1Binding, { schema });
  }

  if (cachedDb) {
    return cachedDb;
  }

  const env = getCloudflareEnv();
  if (env.DB) {
    cachedDb = drizzle(env.DB, { schema });
    return cachedDb;
  }

  // If running in local Node environment (e.g. next dev or Playwright), use local SQLite D1 adapter
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getLocalD1Database } = require("./local-d1");
      const localD1 = getLocalD1Database();
      cachedDb = drizzle(localD1, { schema });
      return cachedDb;
    } catch {
      // Fall through to error
    }
  }

  throw new Error(
    "D1 database binding 'DB' is not configured or not accessible in the current environment."
  );
}

export { schema };
