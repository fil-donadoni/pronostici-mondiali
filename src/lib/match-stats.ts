import { outcome } from "@/lib/tournament/compare";
import type { MatchInfo, RealResult, TeamInfo } from "@/lib/tournament/types";
import type { LeaderboardPrediction, LeaderboardUser } from "@/lib/leaderboard";

/**
 * Statistiche "bizzarre" cross-utente: aggregano TUTTI i pronostici di TUTTI i
 * giocatori sulle partite dei Gironi con un Risultato reale concluso. Logica
 * PURA (no DB), come buildLeaderboard. Confronto solo sui Gironi (stesse
 * squadre), coerente con la Differenza di livello A.
 */

/** Aggregato di una singola Partita su tutti i pronostici dei giocatori. */
export type MatchStat = {
    matchId: string;
    /** Etichetta "Casa – Trasferta" con i nomi reali delle squadre. */
    label: string;
    real: { home: number; away: number };
    /** Pronostici confrontati (giocatori con pronostico su questa partita). */
    total: number;
    /** Pronostici col punteggio esatto. */
    exactCount: number;
    /** Pronostici con l'esito (1/X/2) corretto, inclusi gli esatti. */
    outcomeCount: number;
    /** Quota esiti azzeccati (0..1), 0 se nessun pronostico. */
    outcomeRate: number;
};

/** Un singolo pronostico sbagliato ma "vicino" al risultato reale. */
export type NearMiss = {
    userName: string;
    matchId: string;
    label: string;
    predicted: { home: number; away: number };
    real: { home: number; away: number };
    /** Distanza a gol: |ph-rh| + |pa-ra|. Più è bassa, più era vicino. */
    distance: number;
    /** L'esito (1/X/2) era comunque corretto. */
    outcomeMatch: boolean;
};

export type Statistiche = {
    /** Partita col maggior numero di punteggi esatti. */
    mostExact: MatchStat | null;
    /** Partita col maggior numero di esiti azzeccati. */
    mostOutcome: MatchStat | null;
    /** Partita meno azzeccata: quota esiti corretti più bassa. */
    leastGuessed: MatchStat | null;
    /** Pronostici sbagliati ma più vicini all'esatto, dal più vicino. */
    nearMisses: NearMiss[];
    /** Numero di partite dei gironi con almeno un confronto. */
    matchesCompared: number;
};

/** Quanti near-miss mostrare in tabella. */
const NEAR_MISS_LIMIT = 12;

function teamLabel(
    match: MatchInfo,
    real: RealResult,
    names: Map<string, string>
): string {
    // Le squadre dei gironi sono note dal seed; in fallback uso il risultato.
    const homeId = match.homeTeamId ?? real.homeTeamId;
    const awayId = match.awayTeamId ?? real.awayTeamId;
    const home = (homeId && names.get(homeId)) ?? homeId ?? "?";
    const away = (awayId && names.get(awayId)) ?? awayId ?? "?";
    return `${home} – ${away}`;
}

export function buildStatistiche(
    users: LeaderboardUser[],
    predictions: LeaderboardPrediction[],
    reals: RealResult[],
    matches: MatchInfo[],
    teams: TeamInfo[]
): Statistiche {
    const names = new Map(teams.map((t) => [t.id, t.name]));
    const userNames = new Map(users.map((u) => [u.id, u.name]));
    const realMap = new Map(
        reals.filter((r) => r.finished).map((r) => [r.matchId, r])
    );
    const groupMatches = matches.filter(
        (m) => m.stage === "GROUP" && realMap.has(m.id)
    );

    const stats: MatchStat[] = [];
    const nearMisses: NearMiss[] = [];

    for (const m of groupMatches) {
        const r = realMap.get(m.id)!;
        const label = teamLabel(m, r, names);
        const realOutcome = outcome(r.homeScore, r.awayScore);
        let total = 0;
        let exactCount = 0;
        let outcomeCount = 0;

        for (const p of predictions) {
            if (p.matchId !== m.id) continue;
            total++;
            const exact =
                p.homeScore === r.homeScore && p.awayScore === r.awayScore;
            const outcomeMatch =
                outcome(p.homeScore, p.awayScore) === realOutcome;
            if (exact) exactCount++;
            if (outcomeMatch) outcomeCount++;
            // Near-miss: ogni pronostico non esatto (azzecchi o no l'esito).
            if (!exact) {
                nearMisses.push({
                    userName: userNames.get(p.userId) ?? "?",
                    matchId: m.id,
                    label,
                    predicted: { home: p.homeScore, away: p.awayScore },
                    real: { home: r.homeScore, away: r.awayScore },
                    distance:
                        Math.abs(p.homeScore - r.homeScore) +
                        Math.abs(p.awayScore - r.awayScore),
                    outcomeMatch,
                });
            }
        }

        stats.push({
            matchId: m.id,
            label,
            real: { home: r.homeScore, away: r.awayScore },
            total,
            exactCount,
            outcomeCount,
            outcomeRate: total > 0 ? outcomeCount / total : 0,
        });
    }

    const withPreds = stats.filter((s) => s.total > 0);

    const mostExact =
        withPreds.length === 0
            ? null
            : withPreds.reduce((best, s) =>
                  s.exactCount > best.exactCount ? s : best
              );

    const mostOutcome =
        withPreds.length === 0
            ? null
            : withPreds.reduce((best, s) =>
                  s.outcomeCount > best.outcomeCount ? s : best
              );

    // Meno azzeccata: quota esiti più bassa; a parità, più pronostici (più
    // "clamoroso") e poi id stabile per determinismo.
    const leastGuessed =
        withPreds.length === 0
            ? null
            : withPreds.reduce((worst, s) => {
                  if (s.outcomeRate !== worst.outcomeRate)
                      return s.outcomeRate < worst.outcomeRate ? s : worst;
                  if (s.total !== worst.total)
                      return s.total > worst.total ? s : worst;
                  return s.matchId < worst.matchId ? s : worst;
              });

    nearMisses.sort(
        (a, b) =>
            a.distance - b.distance ||
            // A parità, prima chi aveva l'esito giusto, poi ordine stabile.
            Number(b.outcomeMatch) - Number(a.outcomeMatch) ||
            a.matchId.localeCompare(b.matchId) ||
            a.userName.localeCompare(b.userName)
    );

    return {
        mostExact,
        mostOutcome,
        leastGuessed,
        nearMisses: nearMisses.slice(0, NEAR_MISS_LIMIT),
        matchesCompared: withPreds.length,
    };
}
