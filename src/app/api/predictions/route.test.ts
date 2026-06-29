import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test del bypass dei lock temporali in PUT /api/predictions quando un admin
 * impersona. `auth` e `db` sono mockati; match-lock resta reale (è puro).
 * Caso GROUP/Fase 1 su Partita già iniziata: bloccato in sessione normale,
 * salvabile in impersonation.
 */

const { getSession, onConflictDoUpdate, values, insert, from, select } =
    vi.hoisted(() => {
        const onConflictDoUpdate = vi.fn(async () => undefined);
        const values = vi.fn(() => ({ onConflictDoUpdate }));
        const insert = vi.fn(() => ({ values }));
        // db.select({...}).from(match) -> righe partite (una GROUP già iniziata)
        const from = vi.fn(async () => [
            { id: "G-1", kickoff: "2020-01-01T00:00:00Z", stage: "GROUP" },
        ]);
        const select = vi.fn(() => ({ from }));
        return {
            getSession: vi.fn(),
            onConflictDoUpdate,
            values,
            insert,
            from,
            select,
        };
    });

vi.mock("next/headers", () => ({
    headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
    auth: { api: { getSession } },
}));

vi.mock("@/db", () => ({
    db: { select, insert },
}));

import { PUT } from "./route";

function req(body: unknown) {
    return new Request("http://test/api/predictions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const body = { matchId: "G-1", phase: 1, homeScore: 1, awayScore: 0 };

beforeEach(() => {
    getSession.mockReset();
    onConflictDoUpdate.mockClear();
    values.mockClear();
    insert.mockClear();
});

describe("PUT /api/predictions — lock vs impersonation", () => {
    it("403 su Partita iniziata in sessione normale", async () => {
        getSession.mockResolvedValue({
            user: { id: "u1" },
            session: { impersonatedBy: null },
        });
        const res = await PUT(req(body));
        expect(res.status).toBe(403);
        expect(onConflictDoUpdate).not.toHaveBeenCalled();
    });

    it("salva (200) su Partita iniziata quando un admin impersona", async () => {
        getSession.mockResolvedValue({
            user: { id: "victim" },
            session: { impersonatedBy: "admin1" },
        });
        const res = await PUT(req(body));
        expect(res.status).toBe(200);
        expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
    });
});
