import { advancerOf } from "./real-bracket";
import type { Prediction, RealResult } from "./types";

/**
 * Punteggio della Fase 2 (Tabellone reale) — logica PURA, per partita knockout.
 *
 * Due livelli, NON cumulabili: punteggio esatto (gol casa+gol ospite del 120',
 * prima dei rigori) = 3; altrimenti chi-passa azzeccato (la squadra che ho dato
 * per avanzante è quella davvero avanzata, inclusi supplementari/rigori) = 1.
 * Un esatto resta 3 anche se ho indicato il rigorista sbagliato (i rigori non
 * spostano l'esatto). Il chi-passa premia chi indovina il passaggio del turno
 * pur sbagliando il punteggio del 120' (es. reale 1-1, mia previsione 2-4 con
 * la mia squadra che passa: 1 punto). Vedi docs/adr/0003.
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

    const predAdvancer = predictedAdvancer(real, prediction);
    const advancerHit =
        predAdvancer != null &&
        real.advancerTeamId != null &&
        predAdvancer === real.advancerTeamId;

    const points = exact
        ? PHASE2_POINTS.exact
        : advancerHit
          ? PHASE2_POINTS.advancer
          : 0;

    return { exact, advancerHit, points };
}
