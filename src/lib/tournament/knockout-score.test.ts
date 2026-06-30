import { describe, expect, it } from "vitest";
import { scorePhase2 } from "./knockout-score";
import { pred, real } from "./test-utils";

// real(matchId, h, a, finished, homeTeamId, awayTeamId, advancerTeamId)
const koReal = (
    h: number,
    a: number,
    advancer: string
): ReturnType<typeof real> =>
    real("R32-1", h, a, true, "HOME", "AWAY", advancer);

describe("scorePhase2 (esatto 3 / chi-passa 1, max 3)", () => {
    it("punteggio esatto = 3", () => {
        const s = scorePhase2(pred("R32-1", 2, 1), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: true, advancerHit: true, points: 3 });
    });

    it("punteggio sbagliato ma chi-passa azzeccato = 1", () => {
        const s = scorePhase2(pred("R32-1", 3, 0), koReal(2, 1, "HOME"));
        expect(s).toMatchObject({
            exact: false,
            advancerHit: true,
            points: 1,
        });
    });

    it("chi-passa sbagliato = 0", () => {
        const s = scorePhase2(pred("R32-1", 0, 2), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: false, advancerHit: false, points: 0 });
    });

    it("pareggio esatto = 3 (i rigori non spostano l'esatto)", () => {
        // reale 1-1 (HOME passa ai rigori); pronostico 1-1 che dà AWAY: resta 3
        const s = scorePhase2(
            pred("R32-1", 1, 1, "away"),
            koReal(1, 1, "HOME")
        );
        expect(s).toEqual({ exact: true, advancerHit: false, points: 3 });
    });

    it("reale pari, mia vittoria che dà l'avanzante giusto = 1", () => {
        // reale 1-1, AWAY passa ai rigori; previsione 2-4 (vince AWAY): 1 punto
        const s = scorePhase2(pred("R32-1", 2, 4), koReal(1, 1, "AWAY"));
        expect(s).toMatchObject({
            exact: false,
            advancerHit: true,
            points: 1,
        });
    });

    it("reale pari, mia vittoria sull'avanzante sbagliato = 0", () => {
        // reale 1-1, HOME passa; previsione 2-4 (vince AWAY): chi-passa errato
        const s = scorePhase2(pred("R32-1", 2, 4), koReal(1, 1, "HOME"));
        expect(s).toEqual({ exact: false, advancerHit: false, points: 0 });
    });

    it("pareggio previsto col rigorista giusto = 1 (no esatto)", () => {
        // reale 1-1 HOME passa; previsione 2-2 con HOME ai rigori
        const s = scorePhase2(
            pred("R32-1", 2, 2, "home"),
            koReal(1, 1, "HOME")
        );
        expect(s).toMatchObject({
            exact: false,
            advancerHit: true,
            points: 1,
        });
    });
});
