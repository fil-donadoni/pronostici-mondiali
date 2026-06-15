import { describe, expect, it } from "vitest";
import { buildStatistiche } from "./match-stats";
import type { LeaderboardPrediction, LeaderboardUser } from "./leaderboard";
import type { MatchInfo, RealResult, TeamInfo } from "./tournament/types";

const teams: TeamInfo[] = [
    { id: "GER", name: "Germania", groupCode: "A" },
    { id: "BRA", name: "Brasile", groupCode: "A" },
    { id: "ITA", name: "Italia", groupCode: "B" },
    { id: "FRA", name: "Francia", groupCode: "B" },
];

const users: LeaderboardUser[] = [
    { id: "u1", name: "Anna" },
    { id: "u2", name: "Bruno" },
    { id: "u3", name: "Carlo" },
];

function match(
    id: string,
    home: string,
    away: string,
    kickoff: string | null = null
): MatchInfo {
    return {
        id,
        stage: "GROUP",
        groupCode: "A",
        matchNumber: 1,
        kickoff,
        homeTeamId: home,
        awayTeamId: away,
        homeSlot: null,
        awaySlot: null,
    };
}

function real(id: string, home: number, away: number): RealResult {
    return {
        matchId: id,
        homeScore: home,
        awayScore: away,
        homeTeamId: null,
        awayTeamId: null,
        finished: true,
        advancerTeamId: null,
    };
}

function pred(
    userId: string,
    matchId: string,
    home: number,
    away: number
): LeaderboardPrediction {
    return {
        userId,
        matchId,
        homeScore: home,
        awayScore: away,
        penaltyWinner: null,
    };
}

describe("buildStatistiche", () => {
    const matches = [match("G-1", "GER", "BRA"), match("G-2", "ITA", "FRA")];
    const reals = [real("G-1", 7, 1), real("G-2", 1, 1)];

    it("trova la partita con più punteggi esatti", () => {
        const preds = [
            pred("u1", "G-1", 7, 1), // esatto
            pred("u2", "G-1", 7, 1), // esatto
            pred("u3", "G-1", 2, 0), // esito ok, non esatto
            pred("u1", "G-2", 0, 0), // esito ok (X), non esatto
        ];
        const s = buildStatistiche(users, preds, reals, matches, teams);
        expect(s.mostExact?.matchId).toBe("G-1");
        expect(s.mostExact?.exactCount).toBe(2);
        expect(s.mostExact?.label).toBe("Germania – Brasile");
    });

    it("near-miss: 7-0 sul 7-1 ha scarto 1 ed esito corretto", () => {
        const preds = [
            pred("u1", "G-1", 7, 0), // scarto 1, esito ok
            pred("u2", "G-1", 3, 3), // scarto 6, esito sbagliato
        ];
        const s = buildStatistiche(users, preds, reals, matches, teams);
        expect(s.nearMisses[0]).toMatchObject({
            userName: "Anna",
            distance: 1,
            outcomeMatch: true,
            predicted: { home: 7, away: 0 },
            real: { home: 7, away: 1 },
        });
        // i pronostici esatti non sono near-miss
        expect(
            s.nearMisses.every(
                (n) => !(n.predicted.home === 7 && n.predicted.away === 1)
            )
        ).toBe(true);
    });

    it("il cambio esito (scarto 1) sta sopra lo stesso esito (scarto 1)", () => {
        // G-1 7-1 (esito 1): 7-0 resta esito 1. G-2 1-1 (esito X): 2-1 ribalta.
        const preds = [
            pred("u1", "G-1", 7, 0), // scarto 1, stesso esito
            pred("u2", "G-2", 2, 1), // scarto 1, cambio esito (X -> 1)
        ];
        const s = buildStatistiche(users, preds, reals, matches, teams);
        expect(s.nearMisses[0]).toMatchObject({
            matchId: "G-2",
            outcomeMatch: false,
        });
        expect(s.nearMisses[1]).toMatchObject({
            matchId: "G-1",
            outcomeMatch: true,
        });
    });

    it("a parità di cambio esito, prima la partita con più gol totali", () => {
        // Due cambi esito da pareggio: G-1 (4 gol) sopra G-2 (2 gol).
        const r = [real("G-1", 2, 2), real("G-2", 1, 1)];
        const preds = [
            pred("u1", "G-2", 2, 1), // cambio esito, 2 gol totali reali
            pred("u2", "G-1", 3, 2), // cambio esito, 4 gol totali reali
        ];
        const s = buildStatistiche(users, preds, r, matches, teams);
        expect(s.nearMisses.map((n) => n.matchId)).toEqual(["G-1", "G-2"]);
    });

    it("esclude i pronostici con scarto maggiore di 1", () => {
        const r = [real("G-1", 4, 2)];
        const preds = [
            pred("u1", "G-1", 5, 1), // scarto 2 -> escluso
            pred("u2", "G-1", 3, 2), // scarto 1 -> incluso
        ];
        const s = buildStatistiche(users, preds, r, matches, teams);
        expect(s.nearMisses).toHaveLength(1);
        expect(s.nearMisses[0]).toMatchObject({ userName: "Bruno" });
    });

    it("la meno azzeccata ha la quota esiti più bassa", () => {
        const preds = [
            // G-1: tutti azzeccano l'esito
            pred("u1", "G-1", 1, 0),
            pred("u2", "G-1", 2, 0),
            // G-2 (1-1 = X): nessuno azzecca
            pred("u1", "G-2", 2, 0),
            pred("u2", "G-2", 0, 1),
        ];
        const s = buildStatistiche(users, preds, reals, matches, teams);
        expect(s.leastGuessed?.matchId).toBe("G-2");
        expect(s.leastGuessed?.outcomeRate).toBe(0);
    });

    it("ignora knockout e partite senza risultato concluso", () => {
        const ko: MatchInfo = { ...match("R32-1", "GER", "ITA"), stage: "R32" };
        const preds = [pred("u1", "R32-1", 1, 0), pred("u1", "G-1", 0, 0)];
        const unfinished = [{ ...real("G-1", 7, 1), finished: false }];
        const s = buildStatistiche(
            users,
            preds,
            unfinished,
            [...matches, ko],
            teams
        );
        expect(s.matchesCompared).toBe(0);
        expect(s.mostExact).toBeNull();
        expect(s.nearMisses).toHaveLength(0);
    });

    it("ritorna null/vuoto senza pronostici", () => {
        const s = buildStatistiche(users, [], reals, matches, teams);
        expect(s.mostExact).toBeNull();
        expect(s.mostOutcome).toBeNull();
        expect(s.leastGuessed).toBeNull();
        expect(s.oracle).toBeNull();
        expect(s.gambler).toBeNull();
        expect(s.matchesCompared).toBe(0);
    });

    it("oracolo = più esatti, gambler = quota esiti più bassa", () => {
        const preds = [
            // Anna: 2 esatti su 2 -> oracolo
            pred("u1", "G-1", 7, 1),
            pred("u1", "G-2", 1, 1),
            // Bruno: 0 esatti, 1 esito su 2 (50%)
            pred("u2", "G-1", 1, 0),
            pred("u2", "G-2", 2, 0),
            // Carlo: 0 esatti, 0 esiti su 2 (0%) -> gambler
            pred("u3", "G-1", 0, 1),
            pred("u3", "G-2", 2, 0),
        ];
        const s = buildStatistiche(users, preds, reals, matches, teams);
        expect(s.oracle).toMatchObject({ name: "Anna", exactScores: 2 });
        expect(s.gambler).toMatchObject({
            name: "Carlo",
            correctResults: 0,
            played: 2,
            rate: 0,
        });
    });

    it("oracolo esclude gli esatti salvati dopo il calcio d'inizio", () => {
        const kickoff = "2026-06-15T18:00:00.000Z";
        const m = [match("G-1", "GER", "BRA", kickoff)];
        const r = [real("G-1", 7, 1)];
        const preds: LeaderboardPrediction[] = [
            {
                ...pred("u1", "G-1", 7, 1), // esatto ma salvato in ritardo
                updatedAt: "2026-06-15T19:00:00.000Z",
            },
        ];
        const s = buildStatistiche(users, preds, r, m, teams);
        // L'esatto "in ritardo" non conta: nessun oracolo con esatti.
        expect(s.oracle?.exactScores ?? 0).toBe(0);
    });
});
