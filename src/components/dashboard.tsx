"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ListOrdered, LogOut, RefreshCw, Trophy } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  computeStandings,
  resolveBracket,
  teamsReachingStage,
} from "@/lib/tournament/engine";
import type {
  MatchInfo,
  Prediction,
  RealResult,
  TeamInfo,
} from "@/lib/tournament/types";
import { GroupsTab } from "@/components/groups-tab";
import { BracketTab } from "@/components/bracket-tab";
import { CompareTab } from "@/components/compare-tab";

export type PredictionPatch = {
  homeScore: number;
  awayScore: number;
  penaltyWinner?: "home" | "away" | null;
};

export function Dashboard({
  userName,
  teams,
  matches,
  initialPredictions,
  initialRealResults,
}: {
  userName: string;
  teams: TeamInfo[];
  matches: MatchInfo[];
  initialPredictions: Prediction[];
  initialRealResults: RealResult[];
}) {
  const router = useRouter();

  const [predictions, setPredictions] = useState<Map<string, Prediction>>(
    () => new Map(initialPredictions.map((p) => [p.matchId, p])),
  );
  const [realResults, setRealResults] = useState<Map<string, RealResult>>(
    () => new Map(initialRealResults.map((r) => [r.matchId, r])),
  );
  const [syncing, setSyncing] = useState(false);

  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  // --- Derivazioni (ADR 0001): tutto ricalcolato dai pronostici grezzi ---
  const standings = useMemo(
    () => computeStandings(teams, matches, predictions),
    [teams, matches, predictions],
  );
  const bracket = useMemo(
    () => resolveBracket(standings, predictions),
    [standings, predictions],
  );
  const predictedReaching = useMemo(
    () => teamsReachingStage(bracket),
    [bracket],
  );

  // Salvataggio con debounce per partita
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const savePrediction = useCallback(
    (matchId: string, patch: PredictionPatch) => {
      setPredictions((prev) => {
        const next = new Map(prev);
        const existing = next.get(matchId);
        next.set(matchId, {
          matchId,
          homeScore: patch.homeScore,
          awayScore: patch.awayScore,
          penaltyWinner:
            patch.penaltyWinner !== undefined
              ? patch.penaltyWinner
              : (existing?.penaltyWinner ?? null),
        });
        return next;
      });

      const t = timers.current.get(matchId);
      if (t) clearTimeout(t);
      timers.current.set(
        matchId,
        setTimeout(async () => {
          try {
            const body = {
              matchId,
              homeScore: patch.homeScore,
              awayScore: patch.awayScore,
              penaltyWinner: patch.penaltyWinner ?? null,
            };
            const res = await fetch("/api/predictions", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error("save failed");
          } catch {
            toast.error("Salvataggio pronostico fallito");
          }
        }, 600),
      );
    },
    [],
  );

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync fallito");

      const rr = await fetch("/api/real-results");
      const { results } = (await rr.json()) as { results: RealResult[] };
      setRealResults(new Map(results.map((r) => [r.matchId, r])));

      toast.success(
        `Sync completato (${data.mode}): ${data.updated} partite aggiornate.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl w-full px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Trophy className="size-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg leading-none tracking-tight">
                Mondiali <span className="text-primary">2026</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Ciao {userName} — i tuoi pronostici
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/classifica">
                <ListOrdered className="size-4" />
                Classifica
              </Link>
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing}
              className="gap-2 shadow-lg shadow-primary/20"
            >
              <RefreshCw
                className={`size-4 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Sync…" : "Sync risultati"}
            </Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="size-4" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
        <Tabs defaultValue="groups">
          <TabsList className="mb-6 h-11 gap-1 rounded-full bg-card/60 p-1 backdrop-blur">
            <TabsTrigger
              value="groups"
              className="rounded-full px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
            >
              Gironi
            </TabsTrigger>
            <TabsTrigger
              value="bracket"
              className="rounded-full px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
            >
              Tabellone
            </TabsTrigger>
            <TabsTrigger
              value="compare"
              className="rounded-full px-5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
            >
              Confronto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="groups">
            <GroupsTab
              teamMap={teamMap}
              matches={matches}
              predictions={predictions}
              standings={standings}
              savePrediction={savePrediction}
            />
          </TabsContent>

          <TabsContent value="bracket">
            <BracketTab
              teamMap={teamMap}
              matches={matches}
              predictions={predictions}
              bracket={bracket}
              savePrediction={savePrediction}
            />
          </TabsContent>

          <TabsContent value="compare">
            <CompareTab
              teamMap={teamMap}
              matches={matches}
              predictions={predictions}
              realResults={realResults}
              predictedReaching={predictedReaching}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
