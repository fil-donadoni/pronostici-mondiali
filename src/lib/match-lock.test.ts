import { describe, expect, it } from "vitest";
import { isMatchLocked } from "./match-lock";

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
