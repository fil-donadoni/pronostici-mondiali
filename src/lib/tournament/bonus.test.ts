import { describe, expect, it } from "vitest";
import { BONUS_WEIGHTS, computeBonus } from "./bonus";

// teamsReachingStage inserisce una squadra in OGNI turno che attraversa.
// Helper: insiemi per una squadra che arriva fino a `deepest`.
const reaching = (
    perStage: Partial<Record<string, string[]>>
): Record<string, string[]> => ({
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    FINAL: [],
    CHAMPION: [],
    ...perStage,
});

describe("computeBonus", () => {
    it("accumula i pesi dei turni attraversati da una squadra azzeccata", () => {
        // 'X' previsto e reale in SF -> presente in R32,R16,QF,SF
        const pred = reaching({
            R32: ["X"],
            R16: ["X"],
            QF: ["X"],
            SF: ["X"],
        });
        const real = pred;
        const { points } = computeBonus(pred, real);
        expect(points).toBe(
            BONUS_WEIGHTS.R32 +
                BONUS_WEIGHTS.R16 +
                BONUS_WEIGHTS.QF +
                BONUS_WEIGHTS.SF
        ); // 1+2+3+5 = 11
    });

    it("il campione azzeccato matura tutti i turni fino a CHAMPION", () => {
        const all = reaching({
            R32: ["C"],
            R16: ["C"],
            QF: ["C"],
            SF: ["C"],
            FINAL: ["C"],
            CHAMPION: ["C"],
        });
        const { points } = computeBonus(all, all);
        expect(points).toBe(1 + 2 + 3 + 5 + 8 + 13); // 32
    });

    it("nessun bonus per squadre previste ma non arrivate a quel turno", () => {
        const pred = reaching({ R32: ["A"], R16: ["A"] });
        const real = reaching({ R32: ["A"] }); // A arriva solo agli R32 reali
        const { points, perStage } = computeBonus(pred, real);
        expect(perStage.R32).toBe(1);
        expect(perStage.R16).toBe(0);
        expect(points).toBe(1);
    });

    it("è set-based: conta la squadra, non lo slot/accoppiamento", () => {
        const pred = reaching({ QF: ["A", "B"] });
        const real = reaching({ QF: ["B", "A"] }); // stesso insieme, ordine diverso
        expect(computeBonus(pred, real).perStage.QF).toBe(2 * BONUS_WEIGHTS.QF);
    });

    it("conta i colpi per turno (hitsPerStage)", () => {
        const pred = reaching({ R32: ["A", "B", "C"] });
        const real = reaching({ R32: ["A", "C", "Z"] });
        const { hitsPerStage } = computeBonus(pred, real);
        expect(hitsPerStage.R32).toBe(2); // A e C
    });
});
