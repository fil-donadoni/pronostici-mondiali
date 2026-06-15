import { describe, expect, it } from "vitest";
import {
    POINTS,
    groupDiffs,
    outcome,
    roundSetDiffs,
    scoreDiffs,
    summarize,
} from "./compare";
import { groupMatch, pred, predMap, real, realMap } from "./test-utils";
import type { MatchInfo } from "./types";

describe("outcome", () => {
    it("classifica 1 / X / 2", () => {
        expect(outcome(2, 0)).toBe("1");
        expect(outcome(1, 1)).toBe("X");
        expect(outcome(0, 3)).toBe("2");
    });
});

describe("groupDiffs", () => {
    const matches: MatchInfo[] = [
        groupMatch("G-1", "A", "ITA", "FRA", 1),
        groupMatch("G-2", "A", "ITA", "BRA", 2),
    ];

    it("punteggio identico -> exactMatch e outcomeMatch", () => {
        const d = groupDiffs(
            matches,
            predMap(pred("G-1", 2, 1)),
            realMap(real("G-1", 2, 1))
        );
        expect(d).toHaveLength(1);
        expect(d[0]).toMatchObject({ exactMatch: true, outcomeMatch: true });
    });

    it("stesso esito ma punteggio diverso -> solo outcomeMatch", () => {
        const d = groupDiffs(
            matches,
            predMap(pred("G-1", 2, 1)),
            realMap(real("G-1", 3, 0))
        );
        expect(d[0]).toMatchObject({ exactMatch: false, outcomeMatch: true });
    });

    it("esito sbagliato -> nessun match", () => {
        const d = groupDiffs(
            matches,
            predMap(pred("G-1", 2, 1)),
            realMap(real("G-1", 0, 2))
        );
        expect(d[0]).toMatchObject({ exactMatch: false, outcomeMatch: false });
    });

    it("salta partite senza pronostico", () => {
        const d = groupDiffs(matches, predMap(), realMap(real("G-1", 1, 0)));
        expect(d).toHaveLength(0);
    });

    it("salta risultati non conclusi", () => {
        const d = groupDiffs(
            matches,
            predMap(pred("G-1", 1, 0)),
            realMap(real("G-1", 1, 0, false))
        );
        expect(d).toHaveLength(0);
    });

    it("ignora le partite knockout", () => {
        const ko: MatchInfo[] = [
            { ...groupMatch("R32-1", "A", "ITA", "FRA", 73), stage: "R32" },
        ];
        const d = groupDiffs(
            ko,
            predMap(pred("R32-1", 1, 0)),
            realMap(real("R32-1", 1, 0))
        );
        expect(d).toHaveLength(0);
    });
});

describe("summarize", () => {
    it("conta exact, esito-corretto e sbagliate", () => {
        const matches = [
            groupMatch("G-1", "A", "a", "b", 1),
            groupMatch("G-2", "A", "c", "d", 2),
            groupMatch("G-3", "A", "e", "f", 3),
        ];
        const diffs = groupDiffs(
            matches,
            predMap(pred("G-1", 2, 1), pred("G-2", 2, 1), pred("G-3", 0, 1)),
            realMap(real("G-1", 2, 1), real("G-2", 3, 0), real("G-3", 1, 0))
        );
        expect(summarize(diffs)).toEqual({
            totalCompared: 3,
            exact: 1,
            correctOutcome: 1,
            wrong: 1,
        });
    });
});

describe("scoreDiffs", () => {
    it("punti: esatto vale POINTS.exact, solo esito POINTS.outcome", () => {
        const matches = [
            groupMatch("G-1", "A", "a", "b", 1),
            groupMatch("G-2", "A", "c", "d", 2),
            groupMatch("G-3", "A", "e", "f", 3),
        ];
        const s = scoreDiffs(
            groupDiffs(
                matches,
                predMap(
                    pred("G-1", 2, 1),
                    pred("G-2", 2, 1),
                    pred("G-3", 0, 1)
                ),
                realMap(real("G-1", 2, 1), real("G-2", 3, 0), real("G-3", 1, 0))
            )
        );
        expect(s.exactScores).toBe(1);
        expect(s.correctResults).toBe(2); // esatto incluso negli esiti
        expect(s.points).toBe(POINTS.exact + POINTS.outcome);
        expect(s.totalCompared).toBe(3);
    });

    it("zero diff -> tutto a zero", () => {
        expect(scoreDiffs([])).toEqual({
            exactScores: 0,
            correctResults: 0,
            points: 0,
            totalCompared: 0,
        });
    });
});

describe("cap ritardo (updatedAt > kickoff)", () => {
    const KICKOFF = "2026-06-11T19:00:00.000Z";
    const match = (kickoff: string | null): MatchInfo => ({
        ...groupMatch("G-1", "A", "ITA", "FRA", 1),
        kickoff,
    });
    const predAt = (updatedAt: string | undefined) => ({
        ...pred("G-1", 2, 1),
        updatedAt,
    });
    const diffsFor = (kickoff: string | null, updatedAt: string | undefined) =>
        groupDiffs(
            [match(kickoff)],
            new Map([["G-1", predAt(updatedAt)]]),
            realMap(real("G-1", 2, 1))
        );

    it("esatto salvato DOPO il kickoff -> late, cap a 1 punto", () => {
        const d = diffsFor(KICKOFF, "2026-06-13T11:00:00.000Z");
        expect(d[0]).toMatchObject({ exactMatch: true, late: true });
        const s = scoreDiffs(d);
        expect(s.exactScores).toBe(0); // l'esatto non conta come esatto
        expect(s.correctResults).toBe(1); // ma l'esito resta corretto
        expect(s.points).toBe(POINTS.outcome); // 1, non 3
    });

    it("esatto salvato PRIMA del kickoff -> 3 punti pieni", () => {
        const d = diffsFor(KICKOFF, "2026-06-11T18:59:59.000Z");
        expect(d[0]).toMatchObject({ exactMatch: true, late: false });
        expect(scoreDiffs(d).points).toBe(POINTS.exact);
    });

    it("senza updatedAt (stato ottimistico) -> mai late", () => {
        const d = diffsFor(KICKOFF, undefined);
        expect(d[0].late).toBe(false);
        expect(scoreDiffs(d).points).toBe(POINTS.exact);
    });

    it("senza kickoff -> mai late", () => {
        const d = diffsFor(null, "2026-06-13T11:00:00.000Z");
        expect(d[0].late).toBe(false);
        expect(scoreDiffs(d).points).toBe(POINTS.exact);
    });
});

describe("roundSetDiffs", () => {
    it("calcola onlyPredicted / onlyReal e hasReal per turno", () => {
        const rounds = roundSetDiffs(
            { R32: ["ITA", "FRA", "BRA"] },
            { R32: ["FRA", "BRA", "ARG"] }
        );
        const r32 = rounds.find((r) => r.stage === "R32")!;
        expect(r32.onlyPredicted).toEqual(["ITA"]);
        expect(r32.onlyReal).toEqual(["ARG"]);
        expect(r32.hasReal).toBe(true);
    });

    it("nessun dato reale -> hasReal false", () => {
        const rounds = roundSetDiffs({ R16: ["ITA"] }, {});
        const r16 = rounds.find((r) => r.stage === "R16")!;
        expect(r16.hasReal).toBe(false);
        expect(r16.onlyReal).toEqual([]);
    });
});
