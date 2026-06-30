import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { team, match, realResult, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { type ApiScore, parseApiScore } from "@/lib/football-data";
import { loadMatches, loadRealResults, loadTeams } from "@/lib/queries";
import {
    advancerOf,
    computeDemoResults,
    resolveRealBracket,
} from "@/lib/tournament/real-bracket";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 ora

export async function POST(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const userId = session.user.id;

    // Il primo utente registrato (user 1) è esente dal rate limit.
    const [firstUser] = await db
        .select({ id: user.id })
        .from(user)
        .orderBy(asc(user.createdAt))
        .limit(1);
    const isFirstUser = firstUser?.id === userId;

    if (!isFirstUser) {
        const [me] = await db
            .select({ lastSyncAt: user.lastSyncAt })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);
        const last = me?.lastSyncAt ? new Date(me.lastSyncAt).getTime() : 0;
        const elapsed = Date.now() - last;
        if (elapsed < SYNC_INTERVAL_MS) {
            const retryAfter = Math.ceil((SYNC_INTERVAL_MS - elapsed) / 1000);
            const minutes = Math.ceil(retryAfter / 60);
            return NextResponse.json(
                {
                    error: `Puoi sincronizzare una volta all'ora. Riprova tra ${minutes} min.`,
                    retryAfter,
                },
                { status: 429, headers: { "Retry-After": String(retryAfter) } }
            );
        }
    }

    const body = (await req.json().catch(() => ({}))) as { demo?: boolean };
    const apiKey = process.env.FOOTBALL_DATA_API_KEY;

    if (!apiKey || body.demo) {
        const n = await syncDemo();
        await touchLastSync(userId);
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
        await touchLastSync(userId);
        return NextResponse.json({ ok: true, mode: "real", updated: n });
    } catch (e) {
        return NextResponse.json(
            { error: "Sync reale fallito", detail: (e as Error).message },
            { status: 502 }
        );
    }
}

async function touchLastSync(userId: string): Promise<void> {
    await db
        .update(user)
        .set({ lastSyncAt: new Date() })
        .where(eq(user.id, userId));
}

/**
 * Risultati demo deterministici per le partite dei gironi (no rete).
 * Solo per i match già iniziati (kickoff <= adesso): quelli non ancora
 * giocati restano vuoti, come i risultati reali non ancora arrivati.
 */
async function syncDemo(): Promise<number> {
    const now = new Date();
    const [teams, matches] = await Promise.all([loadTeams(), loadMatches()]);

    // Calcolo puro: Gironi + knockout demo (con chi-passa) per le partite già
    // giocate (kickoff <= now). Vedi computeDemoResults.
    const rows = computeDemoResults(teams, matches, now);
    const playedIds = new Set(rows.map((r) => r.matchId));

    // Pulizia: rimuovi i risultati di partite non ancora giocate (es. invented
    // da sync precedenti) così restano vuote finché non arrivano davvero.
    const notPlayedIds = matches
        .map((m) => m.id)
        .filter((id) => !playedIds.has(id));
    if (notPlayedIds.length > 0) {
        await db
            .delete(realResult)
            .where(inArray(realResult.matchId, notPlayedIds));
    }

    for (const r of rows) {
        const values = {
            matchId: r.matchId,
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            homeTeamId: r.homeTeamId,
            awayTeamId: r.awayTeamId,
            advancerTeamId: r.advancerTeamId,
            finished: true,
            syncedAt: new Date(),
        };
        await db
            .insert(realResult)
            .values(values)
            .onConflictDoUpdate({
                target: [realResult.matchId],
                set: {
                    homeScore: values.homeScore,
                    awayScore: values.awayScore,
                    homeTeamId: values.homeTeamId,
                    awayTeamId: values.awayTeamId,
                    advancerTeamId: values.advancerTeamId,
                    finished: true,
                    syncedAt: values.syncedAt,
                },
            });
    }
    return rows.length;
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
            score: ApiScore;
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

    // Indicizza le partite FINISHED dell'API per COPPIA non orientata di TLA.
    const apiByPair = new Map<
        string,
        {
            h: string;
            a: string;
            homeScore: number;
            awayScore: number;
            winnerTla: string | null;
        }
    >();
    for (const am of data.matches ?? []) {
        if (am.status !== "FINISHED") continue;
        const h = am.homeTeam.tla;
        const a = am.awayTeam.tla;
        if (!h || !a || !ourIds.has(h) || !ourIds.has(a)) continue;
        const { homeScore, awayScore, winnerTla } = parseApiScore(
            am.score,
            h,
            a
        );
        apiByPair.set(pairKey(h, a), {
            h,
            a,
            homeScore,
            awayScore,
            winnerTla,
        });
    }

    // Insert-only: NON aggiorna i risultati già presenti. Così una correzione
    // manuale di un errore dell'API non viene annullata ai sync successivi.
    // Ritorna true se la riga è stata davvero inserita (mancante).
    const insertMissing = async (row: {
        matchId: string;
        homeScore: number;
        awayScore: number;
        homeTeamId: string;
        awayTeamId: string;
        advancerTeamId: string | null;
    }): Promise<boolean> => {
        const inserted = await db
            .insert(realResult)
            .values({ ...row, finished: true, syncedAt: new Date() })
            .onConflictDoNothing({ target: [realResult.matchId] })
            .returning({ matchId: realResult.matchId });
        return inserted.length > 0;
    };

    const written = new Set<string>();
    let insertedCount = 0;

    // 1) Gironi: accoppiamenti fissi, nessun chi-passa.
    for (const m of ourMatches) {
        if (m.stage !== "GROUP" || !m.homeTeamId || !m.awayTeamId) continue;
        const api = apiByPair.get(pairKey(m.homeTeamId, m.awayTeamId));
        if (!api) continue;
        const sameOrient = m.homeTeamId === api.h;
        if (
            await insertMissing({
                matchId: m.id,
                homeScore: sameOrient ? api.homeScore : api.awayScore,
                awayScore: sameOrient ? api.awayScore : api.homeScore,
                homeTeamId: m.homeTeamId,
                awayTeamId: m.awayTeamId,
                advancerTeamId: null,
            })
        ) {
            insertedCount++;
        }
        written.add(m.id);
    }

    // 2) Knockout: gli slot reali si risolvono dalle Classifiche reali; man mano
    //    che scriviamo i chi-passa, i turni successivi diventano risolvibili.
    //    Iteriamo finché non ci sono più Partite nuove da mappare.
    const [teamInfos, matchInfos] = await Promise.all([
        loadTeams(),
        loadMatches(),
    ]);
    for (let pass = 0; pass < 6; pass++) {
        const realResults = await loadRealResults();
        const bracket = resolveRealBracket(teamInfos, matchInfos, realResults);
        let wroteThisPass = 0;
        for (const [matchId, slot] of bracket) {
            if (written.has(matchId)) continue;
            const homeId = slot.homeTeamId;
            const awayId = slot.awayTeamId;
            if (!homeId || !awayId) continue;
            const api = apiByPair.get(pairKey(homeId, awayId));
            if (!api) continue;
            const sameOrient = homeId === api.h;
            const winner: "home" | "away" | null = !api.winnerTla
                ? null
                : api.winnerTla === homeId
                  ? "home"
                  : "away";
            const homeScore = sameOrient ? api.homeScore : api.awayScore;
            const awayScore = sameOrient ? api.awayScore : api.homeScore;
            if (
                await insertMissing({
                    matchId,
                    homeScore,
                    awayScore,
                    homeTeamId: homeId,
                    awayTeamId: awayId,
                    advancerTeamId: advancerOf(
                        homeId,
                        awayId,
                        homeScore,
                        awayScore,
                        winner
                    ),
                })
            ) {
                insertedCount++;
            }
            written.add(matchId);
            wroteThisPass++;
        }
        if (wroteThisPass === 0) break;
    }

    return insertedCount;
}
