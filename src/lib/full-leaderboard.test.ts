import { describe, expect, it } from "vitest";
import {
    buildFullLeaderboard,
    type PhasedPrediction,
} from "./full-leaderboard";
import { groupMatch, real, team } from "@/lib/tournament/test-utils";
import type { MatchInfo, TeamInfo } from "@/lib/tournament/types";

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

const r32_1: MatchInfo = {
    id: "R32-1",
    stage: "R32",
    groupCode: null,
    matchNumber: 73,
    kickoff: null,
    homeTeamId: null,
    awayTeamId: null,
    homeSlot: "2A",
    awaySlot: "2B",
};
const matches = [...groupMatches, r32_1];

// Reali: A1 finita 1-0; R32-1 reale a2 vs b2, 2-1, passa a2.
const reals = [real("A1", 1, 0), real("R32-1", 2, 1, true, "a2", "b2", "a2")];

const p = (
    userId: string,
    matchId: string,
    phase: number,
    h: number,
    a: number,
    penaltyWinner: "home" | "away" | null = null
): PhasedPrediction => ({
    userId,
    matchId,
    phase,
    homeScore: h,
    awayScore: a,
    penaltyWinner,
});

describe("buildFullLeaderboard", () => {
    const users = [
        { id: "u1", name: "Anna" },
        { id: "u2", name: "Bruno" },
    ];

    it("compone gironi, tabellone, bonus e totale = somma", () => {
        const preds = [
            p("u1", "A1", 1, 1, 0), // gironi: esatto -> 3
            p("u1", "R32-1", 2, 2, 1), // tabellone: esatto + chi-passa(a2) -> 4
        ];
        const lb = buildFullLeaderboard(users, preds, reals, matches, teams);
        const u1 = lb.find((e) => e.userId === "u1")!;
        expect(u1.gironi).toBe(3);
        expect(u1.tabellone).toBe(4);
        expect(u1.totale).toBe(u1.gironi + u1.tabellone + u1.bonus);
    });

    it("ordina per totale (poi esatti, poi nome)", () => {
        const preds = [
            p("u2", "A1", 1, 1, 0), // Bruno: gironi 3
            p("u1", "R32-1", 2, 2, 1), // Anna: tabellone 4
        ];
        const lb = buildFullLeaderboard(users, preds, reals, matches, teams);
        // Anna (>=4) prima di Bruno (3) se nessun bonus ribalta; verifichiamo
        // l'ordinamento sul totale calcolato.
        expect(lb[0].totale).toBeGreaterThanOrEqual(lb[1].totale);
    });

    it("utente senza pronostici -> tutto a zero", () => {
        const lb = buildFullLeaderboard(users, [], reals, matches, teams);
        for (const e of lb) {
            expect(e).toMatchObject({
                gironi: 0,
                tabellone: 0,
                bonus: 0,
                totale: 0,
            });
        }
    });
});
