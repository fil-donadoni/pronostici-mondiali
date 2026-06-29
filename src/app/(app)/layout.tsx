import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
    loadMatches,
    loadPredictions,
    loadRealResults,
    loadTeams,
} from "@/lib/queries";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const [teams, matches, predictions, realResults] = await Promise.all([
        loadTeams(),
        loadMatches(),
        loadPredictions(session.user.id),
        loadRealResults(),
    ]);

    if (teams.length === 0) {
        return (
            <main className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="max-w-md space-y-2">
                    <h1 className="text-xl font-semibold">Database vuoto</h1>
                    <p className="text-muted-foreground text-sm">
                        Nessuna squadra trovata. Esegui il seed:{" "}
                        <code className="bg-muted px-1 rounded">
                            npm run db:seed
                        </code>
                    </p>
                </div>
            </main>
        );
    }

    // Sessione di impersonation attiva → mostra la barra "Stai impersonando".
    const impersonatedName = session.session.impersonatedBy
        ? session.user.name
        : null;

    return (
        <AppShell
            userName={session.user.name}
            impersonatedName={impersonatedName}
            teams={teams}
            matches={matches}
            initialPredictions={predictions}
            initialRealResults={realResults}
        >
            {children}
        </AppShell>
    );
}
