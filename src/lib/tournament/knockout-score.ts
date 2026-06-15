import { advancerOf } from "./real-bracket";
import type { Prediction, RealResult } from "./types";

/**
 * Punteggio della Fase 2 (Tabellone reale) — logica PURA, per partita knockout.
 *
 * - Punteggio esatto = 3 (confronto col punteggio finale prima dei rigori,
 *   inclusi i supplementari: è ciò che salviamo in real_result).
 * - Chi-passa azzeccato = 1 (squadra avanzante prevista = avanzante reale).
 * Cumulabili: massimo 4 a partita. Vedi docs/adr/0003.
 */
export const PHASE2_POINTS = { exact: 3, advancer: 1 } as const;

export type Phase2Score = {
    exact: boolean;
    advancerHit: boolean;
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

    const predAdv = predictedAdvancer(real, prediction);
    const advancerHit = predAdv !== null && predAdv === real.advancerTeamId;

    const points =
        (exact ? PHASE2_POINTS.exact : 0) +
        (advancerHit ? PHASE2_POINTS.advancer : 0);

    return { exact, advancerHit, points };
}
