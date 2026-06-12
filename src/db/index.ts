import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL non impostata");
}

// Riusa il client tra hot-reload in dev
const globalForDb = globalThis as unknown as {
  client?: ReturnType<typeof postgres>;
};

// Supabase/Vercel: il transaction pooler (porta 6543) non supporta i
// prepared statement; i pooler limitano le connessioni -> pool piccolo.
const isPooler = /pooler\.supabase\.com/.test(connectionString);
const isTransactionPooler = /:6543|pgbouncer=true/.test(connectionString);
const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: isPooler ? 1 : 10,
    prepare: isTransactionPooler ? false : undefined,
  });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
