import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

const bodySchema = z.object({
    newPassword: z.string().min(8).max(128),
});

/**
 * Reset password di un utente da parte di un admin che lo sta impersonando.
 *
 * Durante l'impersonation la sessione corrente è quella dell'utente impersonato
 * (role "user"): gli endpoint admin del plugin (setUserPassword) rifiuterebbero
 * la richiesta. Qui ricaviamo l'autorità admin da session.impersonatedBy e
 * applichiamo l'hash come fa il plugin, ma senza richiedere la currentPassword.
 */
export async function POST(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Consentito solo all'interno di una sessione di impersonation.
    const adminId = session.session.impersonatedBy;
    if (!adminId) {
        return NextResponse.json(
            { error: "Operazione consentita solo durante l'impersonation" },
            { status: 403 }
        );
    }

    const ctx = await auth.$context;

    // Defense in depth: l'impersonatore deve essere davvero un admin.
    const admin = await ctx.internalAdapter.findUserById(adminId);
    if (!admin || (admin as { role?: string }).role !== "admin") {
        return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Payload non valido", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    // L'utente target è quello attualmente impersonato.
    const targetId = session.user.id;
    const hashed = await ctx.password.hash(parsed.data.newPassword);
    const accounts = await ctx.internalAdapter.findAccounts(targetId);
    const hasCredential = accounts.some((a) => a.providerId === "credential");
    if (hasCredential) {
        await ctx.internalAdapter.updatePassword(targetId, hashed);
    } else {
        await ctx.internalAdapter.createAccount({
            userId: targetId,
            providerId: "credential",
            accountId: targetId,
            password: hashed,
        });
    }

    return NextResponse.json({ ok: true });
}
