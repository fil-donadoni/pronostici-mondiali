import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  loadTeams,
  loadMatches,
  loadPredictions,
  loadRealResults,
} from "@/lib/queries";
import { Dashboard } from "@/components/dashboard";

export default async function HomePage() {
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
            <code className="bg-muted px-1 rounded">npm run db:seed</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <Dashboard
      userName={session.user.name}
      teams={teams}
      matches={matches}
      initialPredictions={predictions}
      initialRealResults={realResults}
    />
  );
}
