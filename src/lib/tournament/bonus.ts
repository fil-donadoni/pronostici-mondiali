/**
 * Bonus di preveggenza (Fase 1) — logica PURA, set-based (vedi docs/adr/0003).
 *
 * Per ogni squadra che il Tabellone PREVISTO in Fase 1 dava a un certo turno e
 * che lo raggiunge DAVVERO, l'utente matura il peso di quel turno. Il conteggio
 * è cumulativo lungo i turni "gratis": teamsReachingStage inserisce una squadra
 * in OGNI turno che attraversa (chi arriva in SF è anche in R32/R16/QF), quindi
 * sommare l'intersezione per turno dà già l'accumulo. Confronto sugli INSIEMI,
 * mai sugli accoppiamenti.
 */

/** Pesi crescenti per turno raggiunto. CHAMPION = vincitore della Finale. */
export const BONUS_WEIGHTS: Record<string, number> = {
    R32: 1,
    R16: 2,
    QF: 3,
    SF: 5,
    FINAL: 8,
    CHAMPION: 13,
};

export type BonusBreakdown = {
    /** Punti Bonus totali. */
    points: number;
    /** Punti per turno (R32, R16, QF, SF, FINAL, CHAMPION). */
    perStage: Record<string, number>;
    /** Numero di squadre azzeccate per turno. */
    hitsPerStage: Record<string, number>;
};

/**
 * Confronta gli insiemi previsti (Fase 1) e reali per turno e somma i pesi.
 * `predictedReaching`/`realReaching` sono output di teamsReachingStage
 * (rispettivamente sul bracket previsto e su quello reale).
 */
export function computeBonus(
    predictedReaching: Record<string, string[]>,
    realReaching: Record<string, string[]>,
    weights: Record<string, number> = BONUS_WEIGHTS
): BonusBreakdown {
    let points = 0;
    const perStage: Record<string, number> = {};
    const hitsPerStage: Record<string, number> = {};

    for (const stage of Object.keys(weights)) {
        const real = new Set(realReaching[stage] ?? []);
        const predicted = predictedReaching[stage] ?? [];
        const hits = predicted.filter((teamId) => real.has(teamId)).length;
        const stagePoints = hits * weights[stage];
        hitsPerStage[stage] = hits;
        perStage[stage] = stagePoints;
        points += stagePoints;
    }

    return { points, perStage, hitsPerStage };
}
