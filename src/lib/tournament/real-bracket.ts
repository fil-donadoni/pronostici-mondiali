import {
    computeStandings,
    resolveBracketWith,
    teamsReachingStage,
} from "./engine";
import type { GroupCode } from "./structure";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    ResolvedKnockout,
    StandingRow,
    TeamInfo,
} from "./types";

/**
 * Logica PURA del Tabellone REALE (no DB): risolve il bracket dai Risultati
 * reali (Classifiche reali dei Gironi + chi-passa salvato a ogni turno) e
 * genera i Risultati demo deterministici. Verità condivisa per il Bonus (#5) e
 * per il punto "chi-passa" della Fase 2 (#6). Vedi docs/adr/0003.
 */

const demoScore = (matchNumber: number): [number, number] => [
    (matchNumber * 7) % 4,
    (matchNumber * 3) % 3,
];

const isPlayed = (m: MatchInfo, now: Date): boolean =>
    !!m.kickoff && new Date(m.kickoff).getTime() <= now.getTime();

/**
 * Squadra avanzata (chi-passa) da punteggio ed eventuale vincitore esplicito.
 * `winner` ha precedenza (knockout reale: incl. supplementari/rigori). Senza
 * vincitore esplicito si deduce dal punteggio; un pari resta indeciso (null).
 */
export function advancerOf(
    homeId: string | null,
    awayId: string | null,
    homeScore: number,
    awayScore: number,
    winner?: "home" | "away" | null
): string | null {
    if (!homeId || !awayId) return null;
    if (winner === "home") return homeId;
    if (winner === "away") return awayId;
    if (homeScore > awayScore) return homeId;
    if (awayScore > homeScore) return awayId;
    return null;
}

/** Mappa i Risultati reali dei Gironi conclusi in Pronostici per le Classifiche. */
function groupResultsAsPredictions(
    realResults: RealResult[]
): Map<string, Prediction> {
    const predMap = new Map<string, Prediction>();
    for (const r of realResults) {
        if (!r.finished) continue;
        predMap.set(r.matchId, {
            matchId: r.matchId,
            homeScore: r.homeScore,
            awayScore: r.awayScore,
            penaltyWinner: null,
        });
    }
    return predMap;
}

/** Classifiche REALI dei Gironi dai Risultati reali conclusi. */
export function realStandings(
    teams: TeamInfo[],
    matches: MatchInfo[],
    realResults: RealResult[]
): Map<GroupCode, StandingRow[]> {
    return computeStandings(
        teams,
        matches,
        groupResultsAsPredictions(realResults)
    );
}

/**
 * Tabellone REALE: ogni slot risolto dalle Classifiche reali, il vincente è il
 * chi-passa salvato (advancerTeamId) della Partita. Gli slot dei turni
 * successivi si riempiono propagando i chi-passa già noti.
 */
export function resolveRealBracket(
    teams: TeamInfo[],
    matches: MatchInfo[],
    realResults: RealResult[]
): Map<string, ResolvedKnockout> {
    const standings = realStandings(teams, matches, realResults);
    const byId = new Map(
        realResults.filter((r) => r.finished).map((r) => [r.matchId, r])
    );
    return resolveBracketWith(standings, (matchId, homeId, awayId) => {
        const adv = byId.get(matchId)?.advancerTeamId ?? null;
        if (!adv || !homeId || !awayId) {
            return { winnerId: null, loserId: null };
        }
        if (adv !== homeId && adv !== awayId) {
            return { winnerId: null, loserId: null };
        }
        return { winnerId: adv, loserId: adv === homeId ? awayId : homeId };
    });
}

/** Insiemi di squadre REALMENTE arrivate a ciascun turno (set-based, per il Bonus). */
export function realReaching(
    teams: TeamInfo[],
    matches: MatchInfo[],
    realResults: RealResult[]
): Record<string, string[]> {
    return teamsReachingStage(resolveRealBracket(teams, matches, realResults));
}

/**
 * Risultati DEMO deterministici (no rete) per le Partite già iniziate
 * (kickoff <= now): Gironi col punteggio pseudo-casuale dal matchNumber, e
 * knockout propagato dal bracket demo (niente pareggi: chi-passa = casa sul
 * pari). Gli avanzanti del knockout sono valorizzati; i Gironi hanno
 * advancerTeamId null.
 */
export function computeDemoResults(
    teams: TeamInfo[],
    matches: MatchInfo[],
    now: Date
): RealResult[] {
    const groupRows: RealResult[] = [];
    const groupPred = new Map<string, Prediction>();
    for (const m of matches) {
        if (m.stage !== "GROUP" || !m.homeTeamId || !m.awayTeamId) continue;
        if (!isPlayed(m, now)) continue;
        const [h, a] = demoScore(m.matchNumber);
        groupRows.push({
            matchId: m.id,
            homeScore: h,
            awayScore: a,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            advancerTeamId: null,
            finished: true,
        });
        groupPred.set(m.id, {
            matchId: m.id,
            homeScore: h,
            awayScore: a,
            penaltyWinner: null,
        });
    }

    const standings = computeStandings(teams, matches, groupPred);
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const koRows: RealResult[] = [];

    resolveBracketWith(standings, (matchId, homeId, awayId) => {
        const m = matchById.get(matchId);
        if (!homeId || !awayId || !m || !isPlayed(m, now)) {
            return { winnerId: null, loserId: null };
        }
        const [rawH, a] = demoScore(m.matchNumber);
        const h = rawH === a ? a + 1 : rawH; // niente pareggi nel knockout demo
        const winnerId = h > a ? homeId : awayId;
        const loserId = winnerId === homeId ? awayId : homeId;
        koRows.push({
            matchId,
            homeScore: h,
            awayScore: a,
            homeTeamId: homeId,
            awayTeamId: awayId,
            advancerTeamId: winnerId,
            finished: true,
        });
        return { winnerId, loserId };
    });

    return [...groupRows, ...koRows];
}
