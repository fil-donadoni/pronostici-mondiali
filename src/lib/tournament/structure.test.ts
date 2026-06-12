import { describe, expect, it } from "vitest";
import {
    GROUP_CODES,
    KNOCKOUT_MATCHES,
    QF_SLOTS,
    R16_SLOTS,
    R32_SLOTS,
    SF_SLOTS,
    type Slot,
} from "./structure";

const refs = (s: Slot): string | null =>
    s.kind === "winner-of" || s.kind === "loser-of" ? s.matchId : null;

describe("struttura knockout", () => {
    it("ha il numero giusto di partite per turno", () => {
        expect(GROUP_CODES).toHaveLength(12);
        expect(R32_SLOTS).toHaveLength(16);
        expect(R16_SLOTS).toHaveLength(8);
        expect(QF_SLOTS).toHaveLength(4);
        expect(SF_SLOTS).toHaveLength(2);
        expect(KNOCKOUT_MATCHES).toHaveLength(32); // 16+8+4+2 + THIRD + FINAL
    });

    it("ogni winner-of/loser-of punta a una partita esistente", () => {
        const ids = new Set(KNOCKOUT_MATCHES.map((m) => m.id));
        for (const m of KNOCKOUT_MATCHES) {
            for (const slot of [m.home, m.away]) {
                const ref = refs(slot);
                if (ref) expect(ids.has(ref)).toBe(true);
            }
        }
    });

    it("ogni dipendenza è già risolta prima di essere usata (ordine topologico)", () => {
        const seen = new Set<string>();
        for (const m of KNOCKOUT_MATCHES) {
            for (const slot of [m.home, m.away]) {
                const ref = refs(slot);
                if (ref) expect(seen.has(ref)).toBe(true);
            }
            seen.add(m.id);
        }
    });

    it("ID e matchNumber sono unici", () => {
        const ids = KNOCKOUT_MATCHES.map((m) => m.id);
        const nums = KNOCKOUT_MATCHES.map((m) => m.matchNumber);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(nums).size).toBe(nums.length);
    });

    it("ci sono 8 slot 'third', su 1ª distinte", () => {
        const facing: string[] = [];
        for (const m of R32_SLOTS) {
            for (const slot of [m.home, m.away]) {
                if (slot.kind === "third") facing.push(slot.facingWinner);
            }
        }
        expect(facing).toHaveLength(8);
        expect(new Set(facing).size).toBe(8);
    });
});
