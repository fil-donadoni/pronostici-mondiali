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

describe("scorePhase2", () => {
    it("punteggio esatto + chi-passa = 4", () => {
        // 2-1, passa HOME; pronostico identico
        const s = scorePhase2(pred("R32-1", 2, 1), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: true, advancerHit: true, points: 4 });
    });

    it("solo chi-passa (punteggio sbagliato) = 1", () => {
        const s = scorePhase2(pred("R32-1", 3, 0), koReal(2, 1, "HOME"));
        expect(s).toMatchObject({ exact: false, advancerHit: true, points: 1 });
    });

    it("solo punteggio esatto ma avanzante sbagliato (rigori) = 3", () => {
        // reale 1-1 con HOME che passa ai rigori; pronostico 1-1 ma dà AWAY
        const s = scorePhase2(
            pred("R32-1", 1, 1, "away"),
            koReal(1, 1, "HOME")
        );
        expect(s).toMatchObject({ exact: true, advancerHit: false, points: 3 });
    });

    it("tutto sbagliato = 0", () => {
        const s = scorePhase2(pred("R32-1", 0, 2), koReal(2, 1, "HOME"));
        expect(s).toEqual({ exact: false, advancerHit: false, points: 0 });
    });

    it("pari nei 90' con rigori azzeccati: chi-passa conta", () => {
        // reale 1-1, passa AWAY (rigori); pronostico 1-1 + rigori AWAY
        const s = scorePhase2(
            pred("R32-1", 1, 1, "away"),
            koReal(1, 1, "AWAY")
        );
        expect(s).toEqual({ exact: true, advancerHit: true, points: 4 });
    });

    it("pari pronosticato senza scelta rigori: nessun chi-passa", () => {
        const s = scorePhase2(pred("R32-1", 1, 1), koReal(1, 1, "HOME"));
        expect(s.advancerHit).toBe(false);
    });
});
