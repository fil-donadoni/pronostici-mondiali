import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Test dell'autorizzazione della route di reset password (admin in
 * impersonation). `auth` è mockato: verifichiamo i rami di gating senza DB
 * né better-auth reali.
 */

const {
    getSession,
    findUserById,
    findAccounts,
    updatePassword,
    createAccount,
    hash,
} = vi.hoisted(() => ({
    getSession: vi.fn(),
    findUserById: vi.fn(),
    findAccounts: vi.fn(),
    updatePassword: vi.fn(),
    createAccount: vi.fn(),
    hash: vi.fn(async (p: string) => `hashed:${p}`),
}));

vi.mock("next/headers", () => ({
    headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
    auth: {
        api: { getSession },
        $context: Promise.resolve({
            internalAdapter: {
                findUserById,
                findAccounts,
                updatePassword,
                createAccount,
            },
            password: { hash },
        }),
    },
}));

import { POST } from "./route";

function req(body: unknown) {
    return new Request("http://test/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

// Sessione di impersonation: l'utente corrente (victim) è impersonato da adminId.
const impersonationSession = {
    user: { id: "victim" },
    session: { impersonatedBy: "admin1" },
};

beforeEach(() => {
    getSession.mockReset();
    findUserById.mockReset();
    findAccounts.mockReset().mockResolvedValue([{ providerId: "credential" }]);
    updatePassword.mockReset();
    createAccount.mockReset();
    hash.mockClear();
});

describe("POST /api/admin/reset-password", () => {
    it("401 se non autenticato", async () => {
        getSession.mockResolvedValue(null);
        const res = await POST(req({ newPassword: "supersecret" }));
        expect(res.status).toBe(401);
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it("403 se NON si sta impersonando", async () => {
        getSession.mockResolvedValue({
            user: { id: "u1" },
            session: { impersonatedBy: null },
        });
        const res = await POST(req({ newPassword: "supersecret" }));
        expect(res.status).toBe(403);
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it("403 se l'impersonatore non è admin", async () => {
        getSession.mockResolvedValue(impersonationSession);
        findUserById.mockResolvedValue({ id: "admin1", role: "user" });
        const res = await POST(req({ newPassword: "supersecret" }));
        expect(res.status).toBe(403);
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it("400 se la nuova password è troppo corta", async () => {
        getSession.mockResolvedValue(impersonationSession);
        findUserById.mockResolvedValue({ id: "admin1", role: "admin" });
        const res = await POST(req({ newPassword: "123" }));
        expect(res.status).toBe(400);
        expect(updatePassword).not.toHaveBeenCalled();
    });

    it("aggiorna la password dell'utente IMPERSONATO se admin (credential esistente)", async () => {
        getSession.mockResolvedValue(impersonationSession);
        findUserById.mockResolvedValue({ id: "admin1", role: "admin" });
        const res = await POST(req({ newPassword: "supersecret" }));
        expect(res.status).toBe(200);
        // target = utente impersonato (victim), non l'admin
        expect(updatePassword).toHaveBeenCalledWith(
            "victim",
            "hashed:supersecret"
        );
        expect(createAccount).not.toHaveBeenCalled();
    });

    it("crea l'account credential se manca", async () => {
        getSession.mockResolvedValue(impersonationSession);
        findUserById.mockResolvedValue({ id: "admin1", role: "admin" });
        findAccounts.mockResolvedValue([]);
        const res = await POST(req({ newPassword: "supersecret" }));
        expect(res.status).toBe(200);
        expect(updatePassword).not.toHaveBeenCalled();
        expect(createAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "victim",
                providerId: "credential",
                password: "hashed:supersecret",
            })
        );
    });
});
