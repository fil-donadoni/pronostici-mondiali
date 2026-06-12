"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  computeStandings,
  resolveBracket,
  teamsReachingStage,
} from "@/lib/tournament/engine";
import type { GroupCode } from "@/lib/tournament/structure";
import type {
  MatchInfo,
  Prediction,
  PredictionPatch,
  RealResult,
  ResolvedKnockout,
  StandingRow,
  TeamInfo,
} from "@/lib/tournament/types";

type AppData = {
  userName: string;
  teams: TeamInfo[];
  teamMap: Map<string, TeamInfo>;
  matches: MatchInfo[];
  predictions: Map<string, Prediction>;
  realResults: Map<string, RealResult>;
  // Derivazioni (ADR 0001): tutto ricalcolato dai pronostici grezzi.
  standings: Map<GroupCode, StandingRow[]>;
  bracket: Map<string, ResolvedKnockout>;
  predictedReaching: Record<string, string[]>;
  savePrediction: (matchId: string, patch: PredictionPatch) => void;
  syncing: boolean;
  handleSync: () => Promise<void>;
};

const AppContext = createContext<AppData | null>(null);

export function useApp(): AppData {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp deve stare dentro <AppProvider>");
  return ctx;
}

export function AppProvider({
  userName,
  teams,
  matches,
  initialPredictions,
  initialRealResults,
  children,
}: {
  userName: string;
  teams: TeamInfo[];
  matches: MatchInfo[];
  initialPredictions: Prediction[];
  initialRealResults: RealResult[];
  children: React.ReactNode;
}) {
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

  // Salvataggio con debounce per partita.
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

  const handleSync = useCallback(async () => {
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
  }, []);

  const value: AppData = {
    userName,
    teams,
    teamMap,
    matches,
    predictions,
    realResults,
    standings,
    bracket,
    predictedReaching,
    savePrediction,
    syncing,
    handleSync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
