import { describe, expect, it } from "vitest";
import { isMatchLocked, isPhase1Locked } from "./match-lock";

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
