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
const isPooler = /pooler\.supabase\.com|pgbouncer=true/.test(connectionString);
const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: isPooler ? 3 : 10,
    // pgbouncer (qualsiasi pooler Supabase) NON regge i prepared statement
    // named: query concorrenti via Promise.all si appendono -> disattiva.
    prepare: isPooler ? false : undefined,
    // Supabase pooler richiede TLS; fail-fast invece di appendersi per 60s.
    ssl: isPooler ? "require" : undefined,
    connect_timeout: 10,
    // Una query non torna mai -> muore a 15s con errore chiaro nei log,
    // invece di mandare in timeout la function a 300s.
    connection: { statement_timeout: 15000 },
  });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export { schema };
