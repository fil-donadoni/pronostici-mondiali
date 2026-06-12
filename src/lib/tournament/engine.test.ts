import { describe, expect, it } from "vitest";
import {
    computeStandings,
    qualifyThirds,
    resolveBracket,
    teamsReachingStage,
} from "./engine";
import { GROUP_CODES, type GroupCode } from "./structure";
import { groupMatch, pred, predMap, row, team } from "./test-utils";
import type {
    MatchInfo,
    ResolvedKnockout,
    StandingRow,
    TeamInfo,
} from "./types";

// --- Girone A completo (4 squadre, 6 partite round-robin) ---
const groupATeams: TeamInfo[] = [
    team("t1", "A"),
    team("t2", "A"),
    team("t3", "A"),
    team("t4", "A"),
];
const groupAMatches: MatchInfo[] = [
    groupMatch("A1", "A", "t1", "t2", 1),
    groupMatch("A2", "A", "t1", "t3", 2),
    groupMatch("A3", "A", "t1", "t4", 3),
    groupMatch("A4", "A", "t2", "t3", 4),
    groupMatch("A5", "A", "t2", "t4", 5),
    groupMatch("A6", "A", "t3", "t4", 6),
];

describe("computeStandings", () => {
    it("assegna 3/1/0 punti e ordina con tie-break", () => {
        const preds = predMap(
            pred("A1", 2, 0), // t1 batte t2
            pred("A2", 1, 0), // t1 batte t3
            pred("A3", 1, 0), // t1 batte t4
            pred("A4", 1, 0), // t2 batte t3
            pred("A5", 1, 0), // t2 batte t4
            pred("A6", 1, 1) // t3-t4 pari
        );
        const rows = computeStandings(groupATeams, groupAMatches, preds).get(
            "A"
        )!;
        expect(rows.map((r) => r.teamId)).toEqual(["t1", "t2", "t3", "t4"]);
        expect(rows[0]).toMatchObject({
            teamId: "t1",
            points: 9,
            won: 3,
            played: 3,
        });
        expect(rows[1]).toMatchObject({ teamId: "t2", points: 6 });
        // t3 e t4 entrambi 1 punto e stesso GD -> tie-break alfabetico (t3 prima)
        expect(rows[2].teamId).toBe("t3");
        expect(rows[3].teamId).toBe("t4");
    });

    it("conta solo le partite pronosticate", () => {
        const rows = computeStandings(
            groupATeams,
            groupAMatches,
            predMap(pred("A1", 3, 0))
        ).get("A")!;
        const t1 = rows.find((r) => r.teamId === "t1")!;
        const t3 = rows.find((r) => r.teamId === "t3")!;
        expect(t1).toMatchObject({ played: 1, points: 3 });
        expect(t3).toMatchObject({ played: 0, points: 0 });
    });

    it("nessun pronostico -> tutti a zero, 12 gironi presenti", () => {
        const standings = computeStandings(
            groupATeams,
            groupAMatches,
            predMap()
        );
        expect([...standings.keys()].sort()).toEqual([...GROUP_CODES].sort());
        expect(standings.get("A")!.every((r) => r.played === 0)).toBe(true);
    });
});

describe("qualifyThirds", () => {
    it("ordina le 12 terze e prende le 8 migliori per punti", () => {
        const standings = new Map<GroupCode, StandingRow[]>();
        GROUP_CODES.forEach((g, i) => {
            // la terza del girone i-esimo ha punti = i (così l'ordine è noto)
            standings.set(g, [
                row(`${g}1`),
                row(`${g}2`),
                row(`${g}3`, { points: i, rank: 3 }),
                row(`${g}4`),
            ]);
        });
        const best = qualifyThirds(standings);
        expect(best).toHaveLength(8);
        // i punti più alti sono gli ultimi gironi (L=11 ... E=4)
        expect(best[0]).toBe("L3");
        expect(best).not.toContain("A3"); // punti più bassi -> escluso
    });

    it("ignora le terze con 0 partite giocate", () => {
        const standings = new Map<GroupCode, StandingRow[]>();
        GROUP_CODES.forEach((g) => {
            standings.set(g, [
                row(`${g}1`),
                row(`${g}2`),
                row(`${g}3`, { played: 0 }),
                row(`${g}4`),
            ]);
        });
        expect(qualifyThirds(standings)).toEqual([]);
    });
});

describe("resolveBracket", () => {
    // standings parziali: bastano i gironi referenziati dagli slot sotto test
    const standings = new Map<GroupCode, StandingRow[]>([
        ["A", [row("A1"), row("A2"), row("A3"), row("A4")]],
        ["B", [row("B1"), row("B2"), row("B3"), row("B4")]],
        ["C", [row("C1"), row("C2"), row("C3"), row("C4")]],
        ["F", [row("F1"), row("F2"), row("F3"), row("F4")]],
    ]);

    it("risolve gli slot piazzati (runner/winner) e il vincente", () => {
        // R32-1 = R(A) vs R(B) -> A2 vs B2
        const b = resolveBracket(standings, predMap(pred("R32-1", 2, 0)));
        expect(b.get("R32-1")).toMatchObject({
            homeTeamId: "A2",
            awayTeamId: "B2",
            winnerId: "A2",
            loserId: "B2",
        });
    });

    it("propaga il vincente lungo l'albero (winner-of)", () => {
        // R16-2 = win(R32-1) vs win(R32-3); R32-3 = W(F) vs R(C)
        const b = resolveBracket(
            standings,
            predMap(
                pred("R32-1", 2, 0), // A2 passa
                pred("R32-3", 0, 1), // R(C)=C2 passa
                pred("R16-2", 1, 0) // A2 passa
            )
        );
        expect(b.get("R16-2")).toMatchObject({
            homeTeamId: "A2",
            awayTeamId: "C2",
            winnerId: "A2",
        });
    });

    it("pareggio nei 90' -> vince chi indicato ai rigori", () => {
        const b = resolveBracket(
            standings,
            predMap(pred("R32-1", 1, 1, "away"))
        );
        expect(b.get("R32-1")!.winnerId).toBe("B2");
    });

    it("pareggio senza scelta rigori -> nessun vincente", () => {
        const b = resolveBracket(standings, predMap(pred("R32-1", 1, 1)));
        expect(b.get("R32-1")!.winnerId).toBeNull();
    });

    it("meno di 8 terze decise -> slot 'third' a TBD (null)", () => {
        // R32-7 = W(A) vs T(A): senza 8 terze il lato terza resta null
        const b = resolveBracket(standings, predMap());
        expect(b.get("R32-7")).toMatchObject({
            homeTeamId: "A1",
            awayTeamId: null,
        });
    });
});

describe("teamsReachingStage", () => {
    it("raccoglie le squadre per turno e il campione dalla finale", () => {
        const bracket = new Map<string, ResolvedKnockout>([
            [
                "R32-1",
                {
                    matchId: "R32-1",
                    homeTeamId: "A2",
                    awayTeamId: "B2",
                    winnerId: "A2",
                    loserId: "B2",
                },
            ],
            [
                "FINAL",
                {
                    matchId: "FINAL",
                    homeTeamId: "A2",
                    awayTeamId: "Z1",
                    winnerId: "A2",
                    loserId: "Z1",
                },
            ],
        ]);
        const reaching = teamsReachingStage(bracket);
        expect(reaching.R32).toEqual(expect.arrayContaining(["A2", "B2"]));
        expect(reaching.FINAL).toEqual(expect.arrayContaining(["A2", "Z1"]));
        expect(reaching.CHAMPION).toEqual(["A2"]);
    });

    it("senza finale risolta -> niente CHAMPION", () => {
        const reaching = teamsReachingStage(new Map());
        expect(reaching.CHAMPION).toBeUndefined();
    });
});
