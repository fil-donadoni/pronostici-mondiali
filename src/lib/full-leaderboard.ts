import { groupDiffs, scoreDiffs } from "@/lib/tournament/compare";
import { computeBonus } from "@/lib/tournament/bonus";
import {
    computeStandings,
    resolveBracket,
    teamsReachingStage,
} from "@/lib/tournament/engine";
import { scorePhase2 } from "@/lib/tournament/knockout-score";
import { realReaching } from "@/lib/tournament/real-bracket";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";

/**
 * Classifica completa a 4 componenti (vedi docs/adr/0003), logica PURA:
 *  - gironi:    punti dai Pronostici dei Gironi (Fase 1) — riusa compare.ts
 *  - tabellone: punti dei Pronostici di Fase 2 (esatto 3 + chi-passa 1)
 *  - bonus:     preveggenza della Fase 1 (set-based, pesato per turno)
 *  - totale:    somma grezza delle tre
 * Le tre componenti restano sempre separate; il Totale ordina la graduatoria.
 */

export type FullLeaderboardEntry = {
    userId: string;
    name: string;
    gironi: number;
    tabellone: number;
    bonus: number;
    totale: number;
    /** Punteggi esatti totali (Gironi + Tabellone), per il tie-break. */
    exactScores: number;
};

export type FullLeaderboardUser = { id: string; name: string };

export type PhasedPrediction = {
    userId: string;
    matchId: string;
    phase: number;
    homeScore: number;
    awayScore: number;
    penaltyWinner: "home" | "away" | null;
    updatedAt?: string;
};

const toPrediction = (p: PhasedPrediction): Prediction => ({
    matchId: p.matchId,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    penaltyWinner: p.penaltyWinner,
    updatedAt: p.updatedAt,
});

export function buildFullLeaderboard(
    users: FullLeaderboardUser[],
    predictions: PhasedPrediction[],
    reals: RealResult[],
    matches: MatchInfo[],
    teams: TeamInfo[]
): FullLeaderboardEntry[] {
    const realMap = new Map(
        reals.filter((r) => r.finished).map((r) => [r.matchId, r])
    );
    // Insiemi reali per turno: calcolati una sola volta, condivisi dal Bonus.
    const reaching = realReaching(teams, matches, reals);

    // Pronostici per utente e per fase.
    const byUser = new Map<
        string,
        { phase1: Map<string, Prediction>; phase2: Map<string, Prediction> }
    >();
    for (const p of predictions) {
        let u = byUser.get(p.userId);
        if (!u) {
            u = { phase1: new Map(), phase2: new Map() };
            byUser.set(p.userId, u);
        }
        (p.phase === 2 ? u.phase2 : u.phase1).set(p.matchId, toPrediction(p));
    }

    return users
        .map((user) => {
            const u = byUser.get(user.id) ?? {
                phase1: new Map<string, Prediction>(),
                phase2: new Map<string, Prediction>(),
            };

            // Gironi (Fase 1) — riusa la logica esistente (incl. cap "ritardo").
            const g = scoreDiffs(groupDiffs(matches, u.phase1, realMap));

            // Bonus (Fase 1): bracket previsto -> insiemi previsti per turno.
            // Senza alcun Pronostico di Fase 1 il bracket sarebbe solo il
            // default alfabetico delle Classifiche vuote: niente input, niente
            // preveggenza, Bonus 0.
            const predictedReaching = teamsReachingStage(
                resolveBracket(
                    computeStandings(teams, matches, u.phase1),
                    u.phase1
                )
            );
            const bonus =
                u.phase1.size === 0
                    ? 0
                    : computeBonus(predictedReaching, reaching).points;

            // Tabellone (Fase 2): somma scorePhase2 sui knockout con reale finito.
            let tabellone = 0;
            let tabelloneExact = 0;
            for (const [matchId, pPred] of u.phase2) {
                const r = realMap.get(matchId);
                if (!r || !r.finished) continue;
                const s = scorePhase2(pPred, r);
                tabellone += s.points;
                if (s.exact) tabelloneExact++;
            }

            return {
                userId: user.id,
                name: user.name,
                gironi: g.points,
                tabellone,
                bonus,
                totale: g.points + tabellone + bonus,
                exactScores: g.exactScores + tabelloneExact,
            };
        })
        .sort(
            (a, b) =>
                b.totale - a.totale ||
                b.exactScores - a.exactScores ||
                a.name.localeCompare(b.name)
        );
}
