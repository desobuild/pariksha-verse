import { DatabaseSync } from "node:sqlite";
import * as fs from "node:fs";
import * as path from "node:path";

let localD1Instance: D1Database | null = null;

function normalizeParam(v: unknown): string | number | bigint | null | Uint8Array {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" || typeof v === "string" || typeof v === "bigint") return v;
  if (v instanceof Uint8Array) return v;
  return JSON.stringify(v);
}

/**
 * Creates a file-backed or persistent SQLite database implementing the Cloudflare D1
 * interface for local development with `next dev` and Playwright testing.
 */
export function getLocalD1Database(): D1Database {
  if (localD1Instance) {
    return localD1Instance;
  }

  const stateDir = path.resolve(process.cwd(), ".wrangler/state");
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const dbPath = path.join(stateDir, "dev.sqlite");
  const sqlite = new DatabaseSync(dbPath);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Run migrations if not yet run (ordered; idempotent — existing objects are ignored)
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
          try {
            sqlite.exec(trimmed);
          } catch {
            // Table or index may already exist
          }
        }
      }
    }
  }

  // Ensure default canonical exam exists for workspace foreign keys
  try {
    const now = Date.now();
    sqlite.exec(`
      INSERT OR IGNORE INTO exams (id, slug, name, short_name, category, status, created_at, updated_at)
      VALUES ('exam_neet', 'neet', 'National Eligibility cum Entrance Test', 'NEET', 'medical', 'active', ${now}, ${now});
      
      INSERT OR IGNORE INTO exam_attempts (id, exam_id, slug, label, status, created_at, updated_at)
      VALUES ('attempt_neet_2027', 'exam_neet', 'neet-2027', 'NEET 2027', 'active', ${now}, ${now});
    `);
  } catch {
    // Ignore
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

  localD1Instance = d1Mock as unknown as D1Database;
  return localD1Instance;
}
