import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import type { DatabaseInstance } from "@/db";

/**
 * Creates a fully-functional in-memory SQLite database wrapped in the
 * Cloudflare D1 interface for unit and integration testing.
 * Enforces true SQLite foreign key constraints, indexes, and unique constraints.
 */
export function createTestD1Database(): D1Database {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Read and execute migrations
  const migrationsDir = path.resolve(process.cwd(), "src/db/migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    if (fs.existsSync(filePath)) {
      const sql = fs.readFileSync(filePath, "utf-8");
      const statements = sql.split("--> statement-breakpoint");
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) {
          sqlite.exec(trimmed);
        }
      }
    }
  }

  function normalizeParam(v: unknown): string | number | bigint | null | Uint8Array {
    if (v === undefined || v === null) return null;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
    if (v instanceof Uint8Array) return v;
    return JSON.stringify(v);
  }

  const d1Mock = {
    prepare(query: string) {
      let boundValues: unknown[] = [];
      const stmtObj = {
        bind(...values: unknown[]) {
          boundValues = values;
          return stmtObj;
        },
        async all<T = Record<string, unknown>>() {
          const stmt = sqlite.prepare(query);
          const params = boundValues.map(normalizeParam);
          const results = stmt.all(...params) as T[];
          return {
            results,
            success: true,
            meta: {},
          };
        },
        async run() {
          const stmt = sqlite.prepare(query);
          const params = boundValues.map(normalizeParam);
          const result = stmt.run(...params);
          return {
            success: true,
            meta: { changes: Number(result.changes) },
          };
        },
        async first<T = Record<string, unknown>>(colName?: string) {
          const stmt = sqlite.prepare(query);
          const params = boundValues.map(normalizeParam);
          const results = stmt.all(...params) as Record<string, unknown>[];
          if (!results.length) return null;
          if (colName) return (results[0][colName] as T) ?? null;
          return (results[0] as T) ?? null;
        },
        async raw<T = unknown[]>() {
          const stmt = sqlite.prepare(query);
          const params = boundValues.map(normalizeParam);
          const results = stmt.all(...params) as Record<string, unknown>[];
          return results.map((r) => Object.values(r)) as T[];
        },
      } as unknown as D1PreparedStatement;
      return stmtObj;
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const results: D1Result<T>[] = [];
      for (const s of statements) {
        results.push(await s.all<T>());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    withSession() {
      return d1Mock;
    },
  };

  return d1Mock as unknown as D1Database;
}

export function createTestDb(): DatabaseInstance {
  const d1 = createTestD1Database();
  return drizzle(d1, { schema });
}
