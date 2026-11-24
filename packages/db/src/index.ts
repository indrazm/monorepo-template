import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });
  return { db, pool };
}

export type Database = import("drizzle-orm/pg-core").PgDatabase<
  import("drizzle-orm/pg-core").PgQueryResultHKT,
  typeof schema
>;
