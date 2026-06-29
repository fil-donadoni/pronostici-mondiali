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

describe("scorePhase2 (schema Gironi: esatto 3 / esito 1, max 3)", () => {
    it("punteggio esatto = 3", () => {
        const s = scorePhase2(pred("R32-1", 2, 1), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: true, outcomeHit: true, points: 3 });
    });

    it("solo esito azzeccato (punteggio sbagliato) = 1", () => {
        const s = scorePhase2(pred("R32-1", 3, 0), koReal(2, 1, "HOME"));
        expect(s).toMatchObject({
            exact: false,
            outcomeHit: true,
            points: 1,
        });
    });

    it("esito sbagliato = 0", () => {
        const s = scorePhase2(pred("R32-1", 0, 2), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: false, outcomeHit: false, points: 0 });
    });

    it("pareggio esatto = 3 (i rigori non spostano i punti)", () => {
        // reale 1-1 (HOME passa ai rigori); pronostico 1-1 che dà AWAY: resta 3
        const s = scorePhase2(
            pred("R32-1", 1, 1, "away"),
            koReal(1, 1, "HOME")
        );
        expect(s).toEqual({ exact: true, outcomeHit: true, points: 3 });
    });

    it("pareggio non esatto ma esito X azzeccato = 1", () => {
        const s = scorePhase2(pred("R32-1", 2, 2), koReal(1, 1, "HOME"));
        expect(s).toMatchObject({
            exact: false,
            outcomeHit: true,
            points: 1,
        });
    });
});
