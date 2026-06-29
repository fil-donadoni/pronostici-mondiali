import { outcome } from "./compare";
import { advancerOf } from "./real-bracket";
import type { Prediction, RealResult } from "./types";

/**
 * Punteggio della Fase 2 (Tabellone reale) — logica PURA, per partita knockout.
 *
 * Stesso schema dei Gironi (vedi `compare.ts` `POINTS`): punteggio esatto = 3,
 * esito (1/X/2) azzeccato = 1, NON cumulabili (un esatto implica l'esito, resta
 * 3). Il confronto è col punteggio finale prima dei rigori (inclusi i
 * supplementari: è ciò che salviamo in real_result). I rigori / chi-passa non
 * assegnano punti a sé. Vedi docs/adr/0003.
 */
export const PHASE2_POINTS = { exact: 3, outcome: 1 } as const;

export type Phase2Score = {
    exact: boolean;
    outcomeHit: boolean;
    points: number;
};

/**
 * Avanzante PREVISTO dal pronostico di Fase 2 sulla partita reale: il
 * pronostico è orientato come la partita reale (home = real.homeTeamId).
 */
export function predictedAdvancer(
    real: RealResult,
    prediction: Prediction
): string | null {
    return advancerOf(
        real.homeTeamId,
        real.awayTeamId,
        prediction.homeScore,
        prediction.awayScore,
        prediction.penaltyWinner ?? undefined
    );
}

/** Assegna i punti di Fase 2 a un pronostico knockout dato il Risultato reale. */
export function scorePhase2(
    prediction: Prediction,
    real: RealResult
): Phase2Score {
    const exact =
        prediction.homeScore === real.homeScore &&
        prediction.awayScore === real.awayScore;

    const outcomeHit =
        outcome(prediction.homeScore, prediction.awayScore) ===
        outcome(real.homeScore, real.awayScore);

    const points = exact
        ? PHASE2_POINTS.exact
        : outcomeHit
          ? PHASE2_POINTS.outcome
          : 0;

    return { exact, outcomeHit, points };
}
