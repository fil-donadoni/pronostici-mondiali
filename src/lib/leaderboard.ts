import { groupDiffs, scoreDiffs } from "@/lib/tournament/compare";
import type { MatchInfo, Prediction, RealResult } from "@/lib/tournament/types";

export type LeaderboardEntry = {
    userId: string;
    name: string;
    /** Punti totali (vedi POINTS in compare.ts). */
    points: number;
    /** Esiti (1/X/2) azzeccati, inclusi i punteggi esatti. */
    correctResults: number;
    /** Punteggi esatti. */
    exactScores: number;
    /** Partite confrontate per l'utente (con risultato reale e pronostico). */
    played: number;
};

export type LeaderboardUser = { id: string; name: string };

export type LeaderboardPrediction = {
    userId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
    penaltyWinner: "home" | "away" | null;
    // Istante ISO (UTC) dell'ultima modifica: abilita il cap "ritardo" (1 punto
    // max se salvato dopo il calcio d'inizio). Assente -> mai in ritardo.
    updatedAt?: string;
};

/**
 * Logica PURA della Classifica (no DB): per ogni utente conta esiti e punteggi
 * azzeccati sulle partite con un Risultato reale concluso. Confronto solo sui
 * Gironi (stesse squadre), come la Differenza di livello A. Ordinamento:
 * punti -> punteggi esatti -> nome.
 */
export function buildLeaderboard(
    users: LeaderboardUser[],
    predictions: LeaderboardPrediction[],
    reals: RealResult[],
    matches: MatchInfo[]
): LeaderboardEntry[] {
    const realMap = new Map(
        reals.filter((r) => r.finished).map((r) => [r.matchId, r])
    );

    const byUser = new Map<string, Map<string, Prediction>>();
    for (const p of predictions) {
        let m = byUser.get(p.userId);
        if (!m) {
            m = new Map();
            byUser.set(p.userId, m);
        }
        m.set(p.matchId, {
            matchId: p.matchId,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            penaltyWinner: p.penaltyWinner,
            updatedAt: p.updatedAt,
        });
    }

    return users
        .map((u) => {
            const preds = byUser.get(u.id) ?? new Map<string, Prediction>();
            const s = scoreDiffs(groupDiffs(matches, preds, realMap));
            return {
                userId: u.id,
                name: u.name,
                points: s.points,
                correctResults: s.correctResults,
                exactScores: s.exactScores,
                played: s.totalCompared,
            };
        })
        .sort(
            (a, b) =>
                b.points - a.points ||
                b.exactScores - a.exactScores ||
                a.name.localeCompare(b.name)
        );
}
