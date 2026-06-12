import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadTeams,
  loadMatches,
  loadPredictions,
  loadRealResults,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Esegue `fn` con timeout: non si appende oltre `ms`. */
async function step<T>(name: string, ms: number, fn: () => Promise<T>) {
  const start = Date.now();
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms),
      ),
    ]);
    return { name, ok: true, ms: Date.now() - start, value };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Riproduce i passi della home isolati, ognuno con timeout 12s.
 * Curl con la cookie di sessione -> il primo step `ok:false` con
 * "timeout" è il colpevole del 504.
 */
export async function GET() {
  const h = await headers();

  const sessionStep = await step("getSession", 12000, () =>
    auth.api.getSession({ headers: h }),
  );
  const userId =
    sessionStep.ok && sessionStep.value
      ? (sessionStep.value as { user: { id: string } }).user.id
      : null;

  const raw = [
    { ...sessionStep, value: userId ? "(session ok)" : sessionStep.value },
    await step("loadTeams", 12000, loadTeams),
    await step("loadMatches", 12000, loadMatches),
    await step("loadPredictions", 12000, () =>
      loadPredictions(userId ?? "00000000"),
    ),
    await step("loadRealResults", 12000, loadRealResults),
  ];

  // Conteggi al posto degli array per non gonfiare la risposta.
  const steps = raw.map((s) =>
    Array.isArray(s.value) ? { ...s, value: `${s.value.length} righe` } : s,
  );

  return NextResponse.json(
    { hasCookie: h.get("cookie")?.includes("session_token") ?? false, steps },
    { status: 200 },
  );
}
