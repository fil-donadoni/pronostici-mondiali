import { describe, expect, it } from "vitest";
import { isGroupStageOver, isMatchLocked, isPhase1Locked } from "./match-lock";

describe("isMatchLocked", () => {
    const now = new Date("2026-06-13T12:00:00Z");

    it("non blocca senza kickoff", () => {
        expect(isMatchLocked(null, now)).toBe(false);
        expect(isMatchLocked(undefined, now)).toBe(false);
    });

    it("non blocca prima del calcio d'inizio", () => {
        expect(isMatchLocked("2026-06-13T13:00:00Z", now)).toBe(false);
    });

    it("blocca esattamente al calcio d'inizio", () => {
        expect(isMatchLocked("2026-06-13T12:00:00Z", now)).toBe(true);
    });

    it("blocca dopo il calcio d'inizio", () => {
        expect(isMatchLocked("2026-06-13T11:00:00Z", now)).toBe(true);
    });

    it("accetta anche un Date", () => {
        expect(isMatchLocked(new Date("2026-06-13T11:00:00Z"), now)).toBe(true);
    });

    it("non blocca con kickoff non valido", () => {
        expect(isMatchLocked("non-una-data", now)).toBe(false);
    });
});

describe("isPhase1Locked", () => {
    const now = new Date("2026-06-13T12:00:00Z");

    it("non blocca senza kickoff validi", () => {
        expect(isPhase1Locked([], now)).toBe(false);
        expect(isPhase1Locked([null, undefined, "non-una-data"], now)).toBe(
            false
        );
    });

    it("non blocca prima del primo calcio d'inizio del torneo", () => {
        expect(
            isPhase1Locked(
                ["2026-06-13T13:00:00Z", "2026-06-14T18:00:00Z"],
                now
            )
        ).toBe(false);
    });

    it("blocca quando il primo calcio d'inizio è passato, anche se altri sono futuri", () => {
        expect(
            isPhase1Locked(
                ["2026-07-19T03:00:00Z", "2026-06-13T11:00:00Z"],
                now
            )
        ).toBe(true);
    });

    it("blocca esattamente al primo calcio d'inizio", () => {
        expect(
            isPhase1Locked(
                ["2026-06-13T12:00:00Z", "2026-06-20T12:00:00Z"],
                now
            )
        ).toBe(true);
    });

    it("ignora i kickoff non validi nel calcolo del minimo", () => {
        expect(
            isPhase1Locked([null, "non-una-data", "2026-06-13T11:00:00Z"], now)
        ).toBe(true);
    });
});

describe("isGroupStageOver", () => {
    // ultima partita gironi: kickoff 2026-06-27T20:00Z -> fine ~22:00Z
    const last = "2026-06-27T20:00:00Z";

    it("false senza kickoff validi", () => {
        expect(isGroupStageOver([])).toBe(false);
        expect(isGroupStageOver([null, "x"])).toBe(false);
    });

    it("false mentre l'ultima partita è ancora in corso", () => {
        const during = new Date("2026-06-27T21:00:00Z"); // +1h, non finita
        expect(isGroupStageOver(["2026-06-25T18:00:00Z", last], during)).toBe(
            false
        );
    });

    it("true dopo la fine (kickoff + ~2h) dell'ultima partita", () => {
        const after = new Date("2026-06-27T22:30:00Z");
        expect(isGroupStageOver(["2026-06-25T18:00:00Z", last], after)).toBe(
            true
        );
    });
});
