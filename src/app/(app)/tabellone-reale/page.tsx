import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
    loadMatches,
    loadPhase2Predictions,
    loadRealResults,
    loadTeams,
} from "@/lib/queries";
import { isPhase1Locked } from "@/lib/match-lock";
import { resolveRealBracket } from "@/lib/tournament/real-bracket";
import {
    KNOCKOUT_MATCHES,
    STAGE_LABEL,
    type Stage,
} from "@/lib/tournament/structure";
import { Fase2Tab, type Fase2Round } from "@/components/fase2-tab";

export const metadata = { title: "Tabellone reale — Mondiali 2026" };

// I turni di Fase 2; la finale 3°/4° condivide la finestra della Finale.
const ROUND_ORDER: Stage[] = ["R32", "R16", "QF", "SF", "FINAL"];

export default async function TabelloneRealePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const [teams, matches, reals, myPreds] = await Promise.all([
        loadTeams(),
        loadMatches(),
        loadRealResults(),
        loadPhase2Predictions(session.user.id),
    ]);

    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    const matchById = new Map(matches.map((m) => [m.id, m]));
    const bracket = resolveRealBracket(teams, matches, reals);

    const stageOf = (id: string) => {
        const km = KNOCKOUT_MATCHES.find((k) => k.id === id);
        // la finale 3°/4° entra nel gruppo FINAL
        return km?.stage === "THIRD" ? "FINAL" : km?.stage;
    };

    const rounds: Fase2Round[] = ROUND_ORDER.map((stage) => {
        const ids = KNOCKOUT_MATCHES.filter((k) => stageOf(k.id) === stage).map(
            (k) => k.id
        );
        const kickoffs = ids.map((id) => matchById.get(id)?.kickoff ?? null);
        const locked = isPhase1Locked(kickoffs);

        const matchesOut = ids.map((id) => {
            const r = bracket.get(id);
            const home = r?.homeTeamId ?? null;
            const away = r?.awayTeamId ?? null;
            const pred = myPreds.find((p) => p.matchId === id);
            return {
                matchId: id,
                isThird:
                    KNOCKOUT_MATCHES.find((k) => k.id === id)?.stage ===
                    "THIRD",
                homeTeamId: home,
                awayTeamId: away,
                homeName: home ? (teamName.get(home) ?? home) : null,
                awayName: away ? (teamName.get(away) ?? away) : null,
                kickoff: matchById.get(id)?.kickoff ?? null,
                prediction: pred
                    ? {
                          homeScore: pred.homeScore,
                          awayScore: pred.awayScore,
                          penaltyWinner: pred.penaltyWinner,
                      }
                    : null,
            };
        });

        return {
            stage,
            label: STAGE_LABEL[stage],
            locked,
            matches: matchesOut,
        };
    });

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Tabellone reale</h1>
                <p className="text-muted-foreground text-sm">
                    Fase 2: pronostica gli accoppiamenti reali, turno per turno.
                    Ogni turno si sblocca quando il precedente è concluso e si
                    blocca al primo calcio d&apos;inizio.
                </p>
            </div>
            <Fase2Tab rounds={rounds} />
        </div>
    );
}
