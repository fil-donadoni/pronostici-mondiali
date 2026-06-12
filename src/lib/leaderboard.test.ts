import { describe, expect, it } from "vitest";
import {
    buildLeaderboard,
    type LeaderboardPrediction,
    type LeaderboardUser,
} from "./leaderboard";
import { groupMatch, real } from "./tournament/test-utils";
import type { MatchInfo } from "./tournament/types";

const matches: MatchInfo[] = [
    groupMatch("G-1", "A", "a", "b", 1),
    groupMatch("G-2", "A", "c", "d", 2),
];
const reals = [real("G-1", 2, 1), real("G-2", 0, 0)];

const users: LeaderboardUser[] = [
    { id: "u1", name: "Anna" },
    { id: "u2", name: "Bruno" },
];

const p = (
    userId: string,
    matchId: string,
    h: number,
    a: number
): LeaderboardPrediction => ({
    userId,
    matchId,
    homeScore: h,
    awayScore: a,
    penaltyWinner: null,
});

describe("buildLeaderboard", () => {
    it("conta esiti, punteggi esatti e punti per utente", () => {
        const lb = buildLeaderboard(
            users,
            [
                p("u1", "G-1", 2, 1), // esatto -> 3pt
                p("u1", "G-2", 1, 1), // esito giusto (X) -> 1pt
                p("u2", "G-1", 1, 0), // esito giusto (1) -> 1pt
                p("u2", "G-2", 0, 2), // sbagliato -> 0
            ],
            reals,
            matches
        );
        const anna = lb.find((e) => e.userId === "u1")!;
        expect(anna).toMatchObject({
            points: 4,
            exactScores: 1,
            correctResults: 2,
            played: 2,
        });
        const bruno = lb.find((e) => e.userId === "u2")!;
        expect(bruno).toMatchObject({
            points: 1,
            exactScores: 0,
            correctResults: 1,
        });
    });

    it("ordina per punti, poi punteggi esatti, poi nome", () => {
        const lb = buildLeaderboard(
            users,
            [
                p("u1", "G-1", 1, 0), // esito -> 1pt
                p("u2", "G-1", 2, 1), // esatto -> 3pt
            ],
            reals,
            matches
        );
        expect(lb.map((e) => e.userId)).toEqual(["u2", "u1"]);
    });

    it("a parità di punti, tie-break alfabetico sul nome", () => {
        const lb = buildLeaderboard(
            users,
            [
                p("u2", "G-1", 1, 0), // Bruno 1pt
                p("u1", "G-1", 1, 0), // Anna 1pt
            ],
            reals,
            matches
        );
        expect(lb.map((e) => e.name)).toEqual(["Anna", "Bruno"]);
    });

    it("utente senza pronostici -> tutto a zero ma presente in classifica", () => {
        const lb = buildLeaderboard(users, [], reals, matches);
        expect(lb).toHaveLength(2);
        expect(lb.every((e) => e.points === 0 && e.played === 0)).toBe(true);
    });

    it("ignora i risultati non conclusi", () => {
        const lb = buildLeaderboard(
            [users[0]],
            [p("u1", "G-1", 2, 1)],
            [real("G-1", 2, 1, false)],
            matches
        );
        expect(lb[0]).toMatchObject({ played: 0, points: 0 });
    });
});
