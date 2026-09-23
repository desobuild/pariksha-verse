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

  throw new Error(
    "D1 database binding 'DB' is not configured or not accessible in the current environment."
  );
}

export { schema };
