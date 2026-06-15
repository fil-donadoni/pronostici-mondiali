import { describe, expect, it } from "vitest";
import {
    allGroupsFilled,
    BRACKET_GRACE_DEADLINE,
    isBracketPhase1Locked,
    isGroupStageOver,
    isMatchLocked,
    isPhase1Locked,
} from "./match-lock";

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

describe("allGroupsFilled", () => {
    const groupIds = ["G-1", "G-2", "G-3"];

    it("false se manca anche solo un Girone", () => {
        expect(allGroupsFilled(groupIds, new Set(["G-1", "G-2"]))).toBe(false);
    });

    it("true se tutti i Gironi hanno un Pronostico", () => {
        expect(
            allGroupsFilled(groupIds, new Set(["G-1", "G-2", "G-3", "FINAL"]))
        ).toBe(true);
    });

    it("false se non ci sono Gironi da controllare", () => {
        expect(allGroupsFilled([], new Set(["G-1"]))).toBe(false);
    });
});

describe("isBracketPhase1Locked", () => {
    // torneo già iniziato: il primo kickoff è nel passato
    const kickoffs = ["2026-06-11T16:00:00Z", "2026-07-19T19:00:00Z"];
    const beforeDeadline = new Date("2026-06-15T12:00:00Z");
    const afterDeadline = new Date("2026-06-21T12:00:00Z");

    it("sblocca il bracket entro la scadenza se i Gironi sono completi", () => {
        expect(isBracketPhase1Locked(kickoffs, true, beforeDeadline)).toBe(
            false
        );
    });

    it("resta bloccato se i Gironi non sono completi", () => {
        expect(isBracketPhase1Locked(kickoffs, false, beforeDeadline)).toBe(
            true
        );
    });

    it("resta bloccato dopo la scadenza anche con Gironi completi", () => {
        expect(isBracketPhase1Locked(kickoffs, true, afterDeadline)).toBe(true);
    });

    it("blocca esattamente alla scadenza+1ms", () => {
        const justAfter = new Date(BRACKET_GRACE_DEADLINE.getTime() + 1);
        expect(isBracketPhase1Locked(kickoffs, true, justAfter)).toBe(true);
    });

    it("a torneo non iniziato il bracket è libero a prescindere", () => {
        const beforeTournament = new Date("2026-06-01T00:00:00Z");
        expect(isBracketPhase1Locked(kickoffs, false, beforeTournament)).toBe(
            false
        );
    });
});
