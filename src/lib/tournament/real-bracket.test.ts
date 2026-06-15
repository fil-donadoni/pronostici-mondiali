import { describe, expect, it } from "vitest";
import {
    advancerOf,
    computeDemoResults,
    realReaching,
    realStandings,
    resolveRealBracket,
} from "./real-bracket";
import { groupMatch, real, team } from "./test-utils";
import type { MatchInfo, TeamInfo } from "./types";

// Due gironi completi (A, B), così winner/runner sono deterministici.
const teams: TeamInfo[] = [
    team("a1", "A"),
    team("a2", "A"),
    team("a3", "A"),
    team("a4", "A"),
    team("b1", "B"),
    team("b2", "B"),
    team("b3", "B"),
    team("b4", "B"),
];

const groupMatches: MatchInfo[] = [
    groupMatch("A1", "A", "a1", "a2", 1),
    groupMatch("A2", "A", "a1", "a3", 2),
    groupMatch("A3", "A", "a1", "a4", 3),
    groupMatch("A4", "A", "a2", "a3", 4),
    groupMatch("A5", "A", "a2", "a4", 5),
    groupMatch("A6", "A", "a3", "a4", 6),
    groupMatch("B1", "B", "b1", "b2", 7),
    groupMatch("B2", "B", "b1", "b3", 8),
    groupMatch("B3", "B", "b1", "b4", 9),
    groupMatch("B4", "B", "b2", "b3", 10),
    groupMatch("B5", "B", "b2", "b4", 11),
    groupMatch("B6", "B", "b3", "b4", 12),
];

// R32-1 = R(A) vs R(B): home = 2ª di A, away = 2ª di B.
const r32_1: MatchInfo = {
    id: "R32-1",
    stage: "R32",
    groupCode: null,
    matchNumber: 73,
    kickoff: "2026-06-13T00:00:00Z",
    homeTeamId: null,
    awayTeamId: null,
    homeSlot: "2A",
    awaySlot: "2B",
};

// Risultati che ordinano A: a1>a2>a3>a4 e B: b1>b2>b3>b4.
const groupReals = [
    real("A1", 1, 0),
    real("A2", 1, 0),
    real("A3", 1, 0),
    real("A4", 1, 0),
    real("A5", 1, 0),
    real("A6", 1, 0),
    real("B1", 1, 0),
    real("B2", 1, 0),
    real("B3", 1, 0),
    real("B4", 1, 0),
    real("B5", 1, 0),
    real("B6", 1, 0),
];

describe("advancerOf", () => {
    it("usa il vincitore esplicito quando presente", () => {
        expect(advancerOf("h", "a", 1, 1, "away")).toBe("a");
        expect(advancerOf("h", "a", 3, 0, "away")).toBe("a"); // esplicito vince sul punteggio
    });
    it("deduce dal punteggio senza vincitore esplicito", () => {
        expect(advancerOf("h", "a", 2, 1)).toBe("h");
        expect(advancerOf("h", "a", 0, 2)).toBe("a");
    });
    it("pari senza vincitore esplicito -> null", () => {
        expect(advancerOf("h", "a", 1, 1)).toBeNull();
    });
    it("slot incompleto -> null", () => {
        expect(advancerOf(null, "a", 1, 0)).toBeNull();
    });
});

describe("realStandings", () => {
    it("costruisce le Classifiche reali dai Risultati dei Gironi", () => {
        const st = realStandings(teams, groupMatches, groupReals);
        expect(st.get("A")!.map((r) => r.teamId)).toEqual([
            "a1",
            "a2",
            "a3",
            "a4",
        ]);
        expect(st.get("B")![1].teamId).toBe("b2");
    });
});

describe("resolveRealBracket", () => {
    const matches = [...groupMatches, r32_1];

    it("risolve gli slot reali e propaga il chi-passa salvato", () => {
        const reals = [
            ...groupReals,
            real("R32-1", 2, 1, true, null, null, "a2"),
        ];
        const b = resolveRealBracket(teams, matches, reals);
        expect(b.get("R32-1")).toMatchObject({
            homeTeamId: "a2",
            awayTeamId: "b2",
            winnerId: "a2",
            loserId: "b2",
        });
    });

    it("senza chi-passa salvato gli slot sono noti ma il vincente è null", () => {
        const b = resolveRealBracket(teams, matches, groupReals);
        expect(b.get("R32-1")).toMatchObject({
            homeTeamId: "a2",
            awayTeamId: "b2",
            winnerId: null,
        });
    });

    it("realReaching raccoglie le squadre reali per turno", () => {
        const reals = [
            ...groupReals,
            real("R32-1", 2, 1, true, null, null, "a2"),
        ];
        expect(realReaching(teams, matches, reals).R32).toEqual(
            expect.arrayContaining(["a2", "b2"])
        );
    });
});

describe("computeDemoResults", () => {
    // i Gironi devono avere un kickoff passato per essere "giocati" nel demo
    const playedGroups = groupMatches.map((m) => ({
        ...m,
        kickoff: "2026-06-13T00:00:00Z",
    }));
    const matches = [...playedGroups, r32_1];
    const future = new Date("2026-08-01T00:00:00Z");

    it("genera i Gironi giocati con advancer null e punteggi deterministici", () => {
        const rows = computeDemoResults(teams, matches, future);
        const a1 = rows.find((r) => r.matchId === "A1")!;
        // demoScore(1) = [(1*7)%4, (1*3)%3] = [3, 0]
        expect(a1).toMatchObject({
            homeScore: 3,
            awayScore: 0,
            advancerTeamId: null,
            finished: true,
        });
    });

    it("genera il knockout giocato con chi-passa valorizzato", () => {
        const rows = computeDemoResults(teams, matches, future);
        const ko = rows.find((r) => r.matchId === "R32-1");
        expect(ko).toBeDefined();
        expect(ko!.advancerTeamId).not.toBeNull();
        expect([ko!.homeTeamId, ko!.awayTeamId]).toContain(ko!.advancerTeamId);
    });

    it("esclude le Partite non ancora giocate (kickoff futuro)", () => {
        const future2 = new Date("2026-06-13T12:00:00Z");
        const onlyFutureKo: MatchInfo = {
            ...r32_1,
            kickoff: "2027-01-01T00:00:00Z",
        };
        const rows = computeDemoResults(
            teams,
            [...playedGroups, onlyFutureKo],
            future2
        );
        expect(rows.find((r) => r.matchId === "R32-1")).toBeUndefined();
    });
});
