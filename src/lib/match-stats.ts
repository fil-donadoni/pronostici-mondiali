import { outcome } from "@/lib/tournament/compare";
import { computeStandings, resolveBracket } from "@/lib/tournament/engine";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";
import {
    buildLeaderboard,
    type LeaderboardPrediction,
    type LeaderboardUser,
} from "@/lib/leaderboard";

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
    /** Etichetta corta con le sigle squadra, es. "BRA-MAR". */
    shortLabel: string;
    predicted: { home: number; away: number };
    real: { home: number; away: number };
    /** Scarto: |ph-rh| + |pa-ra|. Solo gli scarti 1 sono "quasi". */
    distance: number;
    /**
     * L'esito (1/X/2) è rimasto lo stesso. false = un solo gol ha ribaltato
     * l'esito (caso più beffardo): va in cima al ranking.
     */
    outcomeMatch: boolean;
};

/** Premio assegnato a un giocatore (oracolo, gambler). */
export type PlayerAward = {
    name: string;
    /** Punteggi esatti azzeccati. */
    exactScores: number;
    /** Esiti (1/X/2) azzeccati. */
    correctResults: number;
    /** Pronostici confrontati (con risultato reale). */
    played: number;
    /** Quota esiti azzeccati su pronostici fatti (0..1). */
    rate: number;
};

/** Squadra prevista (campione o finalista) e da quanti giocatori. */
export type TeamTally = { teamId: string; name: string; count: number };

export type Statistiche = {
    /** L'oracolo: giocatore con più punteggi esatti azzeccati. */
    oracle: PlayerAward | null;
    /** Il gambler: giocatore con la quota esiti azzeccati più bassa. */
    gambler: PlayerAward | null;
    /** Partita col maggior numero di punteggi esatti. */
    mostExact: MatchStat | null;
    /** Partita col maggior numero di esiti azzeccati. */
    mostOutcome: MatchStat | null;
    /** Partita meno azzeccata: quota esiti corretti più bassa. */
    leastGuessed: MatchStat | null;
    /** Pronostici sbagliati di un solo gol; prima i cambi esito spettacolari. */
    nearMisses: NearMiss[];
    /** Le 5 squadre più pronosticate campione del mondo (Fase 1). */
    topChampions: TeamTally[];
    /** Giocatori con un campione previsto (denominatore per topChampions). */
    championsTotal: number;
    /** Le 5 squadre più pronosticate finaliste (Fase 1). */
    topFinalists: TeamTally[];
    /** Giocatori con una Finale prevista (denominatore per topFinalists). */
    finalistsTotal: number;
    /** Numero di partite dei gironi con almeno un confronto. */
    matchesCompared: number;
};

/** Quanti near-miss mostrare in tabella. */
const NEAR_MISS_LIMIT = 12;
/** Scarto massimo per essere un "quasi": solo a un gol dal risultato reale. */
const NEAR_MISS_MAX_DISTANCE = 1;

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

    // Premi sui giocatori: riuso la logica della Classifica (cap "ritardo"
    // incluso) per avere esatti/esiti/giocate per utente.
    const entries = buildLeaderboard(users, predictions, reals, matches)
        .filter((e) => e.played > 0)
        .map((e) => ({
            name: e.name,
            exactScores: e.exactScores,
            correctResults: e.correctResults,
            played: e.played,
            rate: e.correctResults / e.played,
        }));

    // Oracolo: più punteggi esatti; a parità, quota esiti più alta poi nome.
    const oracle =
        entries.length === 0
            ? null
            : entries.reduce((best, e) =>
                  e.exactScores !== best.exactScores
                      ? e.exactScores > best.exactScores
                          ? e
                          : best
                      : e.rate !== best.rate
                        ? e.rate > best.rate
                            ? e
                            : best
                        : e.name.localeCompare(best.name) < 0
                          ? e
                          : best
              );

    // Gambler: quota esiti più bassa; a parità, più pronostici poi nome.
    const gambler =
        entries.length === 0
            ? null
            : entries.reduce((worst, e) =>
                  e.rate !== worst.rate
                      ? e.rate < worst.rate
                          ? e
                          : worst
                      : e.played !== worst.played
                        ? e.played > worst.played
                            ? e
                            : worst
                        : e.name.localeCompare(worst.name) < 0
                          ? e
                          : worst
              );

    // Campione del mondo previsto da ciascun giocatore (vincente del bracket di
    // Fase 1) -> aggregato sulle 3 squadre più gettonate.
    const byUserPreds = new Map<string, Map<string, Prediction>>();
    for (const p of predictions) {
        let m = byUserPreds.get(p.userId);
        if (!m) {
            m = new Map();
            byUserPreds.set(p.userId, m);
        }
        m.set(p.matchId, {
            matchId: p.matchId,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            penaltyWinner: p.penaltyWinner,
        });
    }
    const champCount = new Map<string, number>();
    const finalistCount = new Map<string, number>();
    let championsTotal = 0;
    let finalistsTotal = 0;
    for (const preds of byUserPreds.values()) {
        const final = resolveBracket(
            computeStandings(teams, matches, preds),
            preds
        ).get("FINAL");
        // Finalisti: entrambe le squadre della Finale prevista note.
        if (final?.homeTeamId && final.awayTeamId) {
            finalistsTotal++;
            for (const id of [final.homeTeamId, final.awayTeamId]) {
                finalistCount.set(id, (finalistCount.get(id) ?? 0) + 1);
            }
        }
        // Campione: vincente della Finale previsto.
        const champ = final?.winnerId;
        if (champ) {
            championsTotal++;
            champCount.set(champ, (champCount.get(champ) ?? 0) + 1);
        }
    }
    const toTally = (counts: Map<string, number>, limit: number): TeamTally[] =>
        [...counts.entries()]
            .map(([teamId, count]) => ({
                teamId,
                name: names.get(teamId) ?? teamId,
                count,
            }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
            .slice(0, limit);
    const topChampions = toTally(champCount, 5);
    const topFinalists = toTally(finalistCount, 5);

    const stats: MatchStat[] = [];
    const nearMisses: NearMiss[] = [];

    for (const m of groupMatches) {
        const r = realMap.get(m.id)!;
        const label = teamLabel(m, r, names);
        const shortLabel = `${m.homeTeamId ?? r.homeTeamId ?? "?"}-${
            m.awayTeamId ?? r.awayTeamId ?? "?"
        }`;
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
            // Near-miss: a un solo gol dal risultato reale.
            const distance =
                Math.abs(p.homeScore - r.homeScore) +
                Math.abs(p.awayScore - r.awayScore);
            if (!exact && distance <= NEAR_MISS_MAX_DISTANCE) {
                nearMisses.push({
                    userName: userNames.get(p.userId) ?? "?",
                    matchId: m.id,
                    label,
                    shortLabel,
                    predicted: { home: p.homeScore, away: p.awayScore },
                    real: { home: r.homeScore, away: r.awayScore },
                    distance,
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

    // Ordina per spettacolarità (gol totali reali) dentro ciascun gruppo.
    const byGoals = (a: NearMiss, b: NearMiss) =>
        b.real.home + b.real.away - (a.real.home + a.real.away) ||
        a.matchId.localeCompare(b.matchId) ||
        a.userName.localeCompare(b.userName);

    // Limite applicato PER gruppo: i cambi esito (in cima) non devono affamare
    // gli esiti azzeccati, mostrati nel box separato.
    const flips = nearMisses
        .filter((n) => !n.outcomeMatch)
        .sort(byGoals)
        .slice(0, NEAR_MISS_LIMIT);
    const kept = nearMisses
        .filter((n) => n.outcomeMatch)
        .sort(byGoals)
        .slice(0, NEAR_MISS_LIMIT);

    return {
        oracle,
        gambler,
        mostExact,
        mostOutcome,
        leastGuessed,
        nearMisses: [...flips, ...kept],
        topChampions,
        championsTotal,
        topFinalists,
        finalistsTotal,
        matchesCompared: withPreds.length,
    };
}
