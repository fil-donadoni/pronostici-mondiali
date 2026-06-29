import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadAllUsers } from "@/lib/queries";
import { ProfiloForm } from "@/components/profilo-form";
import { AdminImpersonatePanel } from "@/components/admin-impersonate-panel";

export const metadata = { title: "Profilo — Mondiali 2026" };

export default async function ProfiloPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const isAdmin = session.user.role === "admin";
    const users = isAdmin ? await loadAllUsers() : [];

    return (
        <div className="mx-auto max-w-md space-y-6">
            <ProfiloForm initialName={session.user.name} />
            {isAdmin && (
                <AdminImpersonatePanel users={users} meId={session.user.id} />
            )}
        </div>
    );
}
