import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostica connessione DB, isolata dal resto della app.
 * - host: mostra solo l'host della connection string (no password) per
 *   verificare quale endpoint Supabase sta usando Vercel.
 * - latencyMs: tempo della singola `SELECT 1`.
 * In timeout/errore restituisce 500 con il messaggio reale entro ~15s
 * (statement_timeout) invece di appendere la function a 300s.
 */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url.replace(/^[^@]*@/, "").split("/")[0] || "(non impostata)";
  const start = Date.now();
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, host, latencyMs: Date.now() - start });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        host,
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
