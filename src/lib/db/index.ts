import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    // Tight timeouts because Supabase's transaction pooler closes idle
    // connections aggressively. Without these, a warm Vercel function
    // hangs forever trying to reuse a dead socket on the next request.
    const client = postgres(process.env.DATABASE_URL!, {
      prepare: false,
      max: 1,
      idle_timeout: 5,          // drop sockets the pooler likely already killed
      max_lifetime: 60 * 5,     // rotate every 5 min regardless
      connect_timeout: 10,      // fail fast on connect rather than hang
      ssl: "require",
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Proxy that lazily initializes the DB connection
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
