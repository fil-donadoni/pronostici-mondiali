import { KNOCKOUT_STAGE_ORDER } from "./structure";
import type { MatchInfo, Prediction, RealResult } from "./types";

export type Outcome = "1" | "X" | "2";

export function outcome(home: number, away: number): Outcome {
    if (home > away) return "1";
    if (home < away) return "2";
    return "X";
}

export type GroupDiff = {
    matchId: string;
    predicted: { home: number; away: number };
    real: { home: number; away: number };
    exactMatch: boolean; // punteggio identico
    outcomeMatch: boolean; // stesso esito 1/X/2
};

/** Livello A: confronto diretto sulle partite dei gironi (stesse squadre). */
export function groupDiffs(
    matches: MatchInfo[],
    predictions: Map<string, Prediction>,
    realResults: Map<string, RealResult>
): GroupDiff[] {
    const diffs: GroupDiff[] = [];
    for (const m of matches) {
        if (m.stage !== "GROUP") continue;
        const p = predictions.get(m.id);
        const r = realResults.get(m.id);
        if (!p || !r || !r.finished) continue;
        const exactMatch =
            p.homeScore === r.homeScore && p.awayScore === r.awayScore;
        const outcomeMatch =
            outcome(p.homeScore, p.awayScore) ===
            outcome(r.homeScore, r.awayScore);
        diffs.push({
            matchId: m.id,
            predicted: { home: p.homeScore, away: p.awayScore },
            real: { home: r.homeScore, away: r.awayScore },
            exactMatch,
            outcomeMatch,
        });
    }
    return diffs;
}

export type RoundSetDiff = {
    stage: string;
    predicted: string[]; // teamId previsti a quel turno
    real: string[]; // teamId reali a quel turno (se disponibili)
    onlyPredicted: string[]; // previsti ma non reali
    onlyReal: string[]; // reali ma non previsti
    hasReal: boolean;
};

/**
 * Livello C-light: confronto degli INSIEMI di squadre per turno knockout,
 * non degli accoppiamenti (vedi CONTEXT.md / D11).
 */
export function roundSetDiffs(
    predictedReaching: Record<string, string[]>,
    realReaching: Record<string, string[]>
): RoundSetDiff[] {
    return KNOCKOUT_STAGE_ORDER.map((stage) => {
        const predicted = predictedReaching[stage] ?? [];
        const real = realReaching[stage] ?? [];
        const realSet = new Set(real);
        const predSet = new Set(predicted);
        return {
            stage,
            predicted,
            real,
            onlyPredicted: predicted.filter((t) => !realSet.has(t)),
            onlyReal: real.filter((t) => !predSet.has(t)),
            hasReal: real.length > 0,
        };
    });
}

export type CompareSummary = {
    totalCompared: number;
    exact: number;
    correctOutcome: number;
    wrong: number;
};

/**
 * Punti per la Classifica giocatori: un punteggio esatto vale di più del solo
 * esito (1/X/2) corretto. Unica fonte della regola di punteggio.
 */
export const POINTS = { exact: 3, outcome: 1 } as const;

export type ScoreBreakdown = {
    /** Pronostici con esito (1/X/2) corretto, inclusi quelli a punteggio esatto. */
    correctResults: number;
    /** Pronostici con punteggio identico al risultato reale. */
    exactScores: number;
    /** Totale punti: esatto -> POINTS.exact, solo esito -> POINTS.outcome. */
    points: number;
    /** Pronostici confrontati (partite con risultato reale disponibile). */
    totalCompared: number;
};

/** Aggrega i Differenza di un utente in numeri per la Classifica. */
export function scoreDiffs(diffs: GroupDiff[]): ScoreBreakdown {
    let exact = 0;
    let outcomeOnly = 0;
    for (const d of diffs) {
        if (d.exactMatch) exact++;
        else if (d.outcomeMatch) outcomeOnly++;
    }
    return {
        exactScores: exact,
        correctResults: exact + outcomeOnly,
        points: exact * POINTS.exact + outcomeOnly * POINTS.outcome,
        totalCompared: diffs.length,
    };
}

export function summarize(diffs: GroupDiff[]): CompareSummary {
    let exact = 0;
    let correctOutcome = 0;
    let wrong = 0;
    for (const d of diffs) {
        if (d.exactMatch) exact++;
        else if (d.outcomeMatch) correctOutcome++;
        else wrong++;
    }
    return { totalCompared: diffs.length, exact, correctOutcome, wrong };
}
