import { groupDiffs, scoreDiffs } from "@/lib/tournament/compare";
import { computeBonus } from "@/lib/tournament/bonus";
import {
    computeStandings,
    resolveBracket,
    teamsReachingStage,
} from "@/lib/tournament/engine";
import { scorePhase2 } from "@/lib/tournament/knockout-score";
import { realReaching } from "@/lib/tournament/real-bracket";
import { KNOCKOUT_STAGE_ORDER } from "@/lib/tournament/structure";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";

/**
 * Classifica completa a 4 componenti (vedi docs/adr/0003), logica PURA:
 *  - gironi:    punti dai Pronostici dei Gironi (Fase 1) — riusa compare.ts
 *  - tabellone: punti dei Pronostici di Fase 2, stesso schema dei Gironi
 *               (esatto 3 / esito 1, max 3)
 *  - profezia:  preveggenza della Fase 1 (set-based, pesato per turno) — il
 *               "Bonus" dell'ADR 0003
 *  - totale:    somma grezza delle tre
 * Le tre componenti restano sempre separate; il Totale ordina la graduatoria.
 */

/** Conteggi di una componente "a partita" (Gironi o Tabellone). */
export type ComponentScore = {
    /** Pronostici con punteggio identico al reale (valgono 3 ciascuno). */
    exact: number;
    /** Pronostici con esito (1/X/2) azzeccato, inclusi gli esatti. */
    correctResults: number;
    /** Punti: esatto*3 + soloEsito*1. */
    points: number;
};

/** Profezia (Bonus Fase 1): squadre azzeccate per turno + punti pesati. */
export type ProfeziaScore = {
    /** Squadre previste in Fase 1 e arrivate davvero, per turno (R32..FINAL). */
    hits: Record<string, number>;
    /** Punti Profezia totali (pesi crescenti per turno, incl. Campione). */
    points: number;
};

export type FullLeaderboardEntry = {
    userId: string;
    name: string;
    gironi: ComponentScore;
    tabellone: ComponentScore;
    profezia: ProfeziaScore;
    /** Somma grezza gironi + tabellone + profezia. */
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

const emptyComponent = (): ComponentScore => ({
    exact: 0,
    correctResults: 0,
    points: 0,
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
    // Insiemi reali per turno: calcolati una sola volta, condivisi dalla Profezia.
    const reaching = realReaching(teams, matches, reals);
    const knockoutMatches = matches.filter((m) => m.stage !== "GROUP");

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
            const gironi: ComponentScore = {
                exact: g.exactScores,
                correctResults: g.correctResults,
                points: g.points,
            };

            // Tabellone (Fase 2): stesso schema dei Gironi, sui knockout finiti.
            const tabellone = emptyComponent();
            for (const m of knockoutMatches) {
                const p = u.phase2.get(m.id);
                const r = realMap.get(m.id);
                if (!p || !r || !r.finished) continue;
                const s = scorePhase2(p, r);
                if (s.exact) tabellone.exact++;
                if (s.outcomeHit) tabellone.correctResults++;
                tabellone.points += s.points;
            }

            // Profezia (Bonus Fase 1): bracket previsto -> insiemi per turno.
            // Senza alcun Pronostico di Fase 1 il bracket sarebbe solo il
            // default alfabetico delle Classifiche vuote: niente input, niente
            // preveggenza, Profezia 0.
            const predictedReaching = teamsReachingStage(
                resolveBracket(
                    computeStandings(teams, matches, u.phase1),
                    u.phase1
                )
            );
            const b =
                u.phase1.size === 0
                    ? null
                    : computeBonus(predictedReaching, reaching);
            const profezia: ProfeziaScore = {
                hits: Object.fromEntries(
                    KNOCKOUT_STAGE_ORDER.map((stage) => [
                        stage,
                        b?.hitsPerStage[stage] ?? 0,
                    ])
                ),
                points: b?.points ?? 0,
            };

            return {
                userId: user.id,
                name: user.name,
                gironi,
                tabellone,
                profezia,
                totale: gironi.points + tabellone.points + profezia.points,
                exactScores: gironi.exact + tabellone.exact,
            };
        })
        .sort(
            (a, b) =>
                b.totale - a.totale ||
                b.exactScores - a.exactScores ||
                a.name.localeCompare(b.name)
        );
}
