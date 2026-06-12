import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { team, match, realResult } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { demo?: boolean };
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    if (!apiKey || body.demo) {
        const n = await syncDemo();
        return NextResponse.json({
            ok: true,
            mode: "demo",
            updated: n,
            message: apiKey
                ? "Modo demo richiesto: risultati simulati."
                : "Nessuna API key football-data.org: generati risultati demo deterministici.",
        });
    }

    try {
        const n = await syncReal(apiKey);
        return NextResponse.json({ ok: true, mode: "real", updated: n });
    } catch (e) {
        return NextResponse.json(
            { error: "Sync reale fallito", detail: (e as Error).message },
            { status: 502 }
        );
    }
}

/**
 * Risultati demo deterministici per le partite dei gironi (no rete).
 * Solo per i match già iniziati (kickoff <= adesso): quelli non ancora
 * giocati restano vuoti, come i risultati reali non ancora arrivati.
 */
async function syncDemo(): Promise<number> {
    const groupMatches = await db.select().from(match);
    const now = new Date();

    // Pulizia: rimuovi i risultati di partite non ancora giocate (es. invented
    // da sync precedenti) così restano vuote finché non arrivano davvero.
    const notPlayedIds = groupMatches
        .filter((m) => !m.kickoff || new Date(m.kickoff) > now)
        .map((m) => m.id);
    if (notPlayedIds.length > 0) {
        await db
            .delete(realResult)
            .where(inArray(realResult.matchId, notPlayedIds));
    }

    let count = 0;
    for (const m of groupMatches) {
        if (m.stage !== "GROUP" || !m.homeTeamId || !m.awayTeamId) continue;
        if (!m.kickoff || new Date(m.kickoff) > now) continue; // non ancora giocata
        // pseudo-casuale deterministico dal matchNumber
        const h = (m.matchNumber * 7) % 4;
        const a = (m.matchNumber * 3) % 3;
        await db
            .insert(realResult)
            .values({
                matchId: m.id,
                homeScore: h,
                awayScore: a,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                finished: true,
                syncedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [realResult.matchId],
                set: {
                    homeScore: h,
                    awayScore: a,
                    homeTeamId: m.homeTeamId,
                    awayTeamId: m.awayTeamId,
                    finished: true,
                    syncedAt: new Date(),
                },
            });
        count++;
    }
    return count;
}

/**
 * Sync reale da football-data.org. Mappa le partite FINISHED alle nostre
 * tramite la coppia di external id delle squadre.
 */
async function syncReal(apiKey: string): Promise<number> {
    const comp = process.env.FOOTBALL_DATA_COMPETITION ?? "WC";
    const res = await fetch(
        `https://api.football-data.org/v4/competitions/${comp}/matches`,
        { headers: { "X-Auth-Token": apiKey } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
        matches?: {
            homeTeam: { id: number; tla: string | null };
            awayTeam: { id: number; tla: string | null };
            status: string;
            score: { fullTime: { home: number | null; away: number | null } };
        }[];
    };

    // I nostri team.id sono i codici TLA (MEX, RSA, …) = stessi tla di football-data.
    const teams = await db.select().from(team);
    const ourIds = new Set(teams.map((t) => t.id));

    // Mappa per COPPIA non orientata -> nostro match (i gironi hanno gli stessi
    // accoppiamenti, ma l'ordine casa/ospite può differire dal nostro calendario).
    const pairKey = (a: string, b: string) => [a, b].sort().join("|");
    const matchByPair = new Map<
        string,
        { id: string; homeTeamId: string; awayTeamId: string }
    >();
    const ourMatches = await db.select().from(match);
    for (const m of ourMatches) {
        if (m.homeTeamId && m.awayTeamId) {
            matchByPair.set(pairKey(m.homeTeamId, m.awayTeamId), {
                id: m.id,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
            });
        }
    }

    let count = 0;
    for (const am of data.matches ?? []) {
        if (am.status !== "FINISHED") continue;
        const h = am.homeTeam.tla;
        const a = am.awayTeam.tla;
        if (!h || !a || !ourIds.has(h) || !ourIds.has(a)) continue;
        const m = matchByPair.get(pairKey(h, a));
        if (!m) continue;

        const apiHome = am.score.fullTime.home ?? 0;
        const apiAway = am.score.fullTime.away ?? 0;
        // riallinea i punteggi all'orientamento casa/ospite del NOSTRO match
        const sameOrient = m.homeTeamId === h;
        const hs = sameOrient ? apiHome : apiAway;
        const as = sameOrient ? apiAway : apiHome;

        await db
            .insert(realResult)
            .values({
                matchId: m.id,
                homeScore: hs,
                awayScore: as,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                finished: true,
                syncedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [realResult.matchId],
                set: {
                    homeScore: hs,
                    awayScore: as,
                    homeTeamId: m.homeTeamId,
                    awayTeamId: m.awayTeamId,
                    finished: true,
                    syncedAt: new Date(),
                },
            });
        count++;
    }
    return count;
}
