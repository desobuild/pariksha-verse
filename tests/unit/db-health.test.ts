import { describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/d1";
import { healthCheck } from "@/db/schema/health";

/**
 * Creates an in-memory mock D1Database adhering to the Cloudflare D1 interface
 * for local isolated testing without requiring production cloud infrastructure.
 */
function createMockD1Database(): D1Database {
  const records = new Map<string, Record<string, unknown>>();

  const mockDb = {
    prepare(query: string) {
      let boundValues: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return statement;
        },
        async all<T = Record<string, unknown>>() {
          return {
            results: Array.from(records.values()) as T[],
            success: true,
            meta: {},
          };
        },
        async run() {
          if (query.toLowerCase().includes("insert into") && boundValues.length >= 3) {
            records.set(String(boundValues[0]), {
              id: boundValues[0],
              status: boundValues[1],
              checked_at: boundValues[2],
            });
          }
          return {
            success: true,
            meta: { changes: 1 },
          };
        },
        async first<T = Record<string, unknown>>() {
          const first = Array.from(records.values())[0];
          return (first as T) || null;
        },
        async raw<T = unknown[]>() {
          return Array.from(records.values()).map((r) => Object.values(r)) as T[];
        },
      } as unknown as D1PreparedStatement;
      return statement;
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.all());
      }
      return results as D1Result<T>[];
    },
    async exec() {
      return { count: 0, duration: 0 };
    },
    withSession() {
      return mockDb;
    },
  };

  return mockDb as unknown as D1Database;
}

describe("Cloudflare D1 & Drizzle Health Integration", () => {
  it("initializes Drizzle client with mock D1 binding and executes insert/select without cloud infra", async () => {
    const mockD1 = createMockD1Database();
    const db = drizzle(mockD1, { schema: { healthCheck } });

    // Execute insert via Drizzle
    const now = new Date();
    await db.insert(healthCheck).values({
      id: "test-node-1",
      status: "healthy",
      checkedAt: now,
    });

    // Execute query via Drizzle
    const rows = await db.select().from(healthCheck);
    expect(rows).toBeDefined();
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].id).toBe("test-node-1");
    expect(rows[0].status).toBe("healthy");
  });
});
