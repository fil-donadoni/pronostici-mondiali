import { describe, expect, it } from "vitest";
import { type ApiScore, parseApiScore } from "./football-data";

describe("parseApiScore", () => {
    it("girone REGULAR: usa fullTime, winner dal campo winner", () => {
        const s: ApiScore = {
            winner: "HOME_TEAM",
            duration: "REGULAR",
            fullTime: { home: 2, away: 0 },
            regularTime: null,
            extraTime: null,
            penalties: null,
        };
        expect(parseApiScore(s, "ITA", "FRA")).toEqual({
            homeScore: 2,
            awayScore: 0,
            winnerTla: "ITA",
        });
    });

    it("shootout: scarta i rigori dal punteggio, usa regularTime+extraTime", () => {
        // fullTime gonfiato (4-5 = 1-1 + rigori 4-4 con tiri extra): a noi serve 1-1.
        const s: ApiScore = {
            winner: "AWAY_TEAM",
            duration: "PENALTY_SHOOTOUT",
            fullTime: { home: 4, away: 5 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 0, away: 0 },
            penalties: { home: 4, away: 5 },
        };
        const r = parseApiScore(s, "BRA", "ARG");
        expect(r.homeScore).toBe(1);
        expect(r.awayScore).toBe(1);
        expect(r.winnerTla).toBe("ARG");
    });

    it("shootout dopo supplementari: somma regularTime+extraTime al 120'", () => {
        const s: ApiScore = {
            winner: "HOME_TEAM",
            duration: "PENALTY_SHOOTOUT",
            fullTime: { home: 7, away: 6 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 1, away: 1 },
            penalties: { home: 5, away: 4 },
        };
        const r = parseApiScore(s, "ESP", "GER");
        expect(r.homeScore).toBe(2);
        expect(r.awayScore).toBe(2);
        expect(r.winnerTla).toBe("ESP");
    });

    it("shootout senza campo winner: lo ricava dai rigori", () => {
        const s: ApiScore = {
            winner: null,
            duration: "PENALTY_SHOOTOUT",
            fullTime: { home: 4, away: 5 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 0, away: 0 },
            penalties: { home: 4, away: 5 },
        };
        expect(parseApiScore(s, "POR", "NED").winnerTla).toBe("NED");
    });

    it("supplementari senza rigori (EXTRA_TIME): fullTime già corretto", () => {
        // Niente penalties -> fullTime contiene 120' senza tiri extra.
        const s: ApiScore = {
            winner: "AWAY_TEAM",
            duration: "EXTRA_TIME",
            fullTime: { home: 1, away: 2 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 0, away: 1 },
            penalties: null,
        };
        const r = parseApiScore(s, "CRO", "MAR");
        expect(r.homeScore).toBe(1);
        expect(r.awayScore).toBe(2);
        expect(r.winnerTla).toBe("MAR");
    });

    it("rigori pari/dati mancanti: winner resta null", () => {
        const s: ApiScore = {
            winner: null,
            duration: "PENALTY_SHOOTOUT",
            fullTime: { home: 1, away: 1 },
            regularTime: { home: 1, away: 1 },
            extraTime: { home: 0, away: 0 },
            penalties: { home: 4, away: 4 },
        };
        expect(parseApiScore(s, "MEX", "USA").winnerTla).toBeNull();
    });

    it("DRAW nei gironi: winnerTla null", () => {
        const s: ApiScore = {
            winner: "DRAW",
            duration: "REGULAR",
            fullTime: { home: 1, away: 1 },
        };
        expect(parseApiScore(s, "ENG", "BEL").winnerTla).toBeNull();
    });
});
