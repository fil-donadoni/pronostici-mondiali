"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScoreInput } from "@/components/score-input";
import { useApp } from "@/lib/app-context";
import { effectiveLock, isMatchLocked, isPhase1Locked } from "@/lib/match-lock";
import { GROUP_CODES, type GroupCode } from "@/lib/tournament/structure";
import type { StandingRow } from "@/lib/tournament/types";
import type {
    MatchInfo,
    Prediction,
    PredictionPatch,
    TeamInfo,
} from "@/lib/tournament/types";

export function GroupsTab({
    teamMap,
    matches,
    predictions,
    standings,
    savePrediction,
}: {
    teamMap: Map<string, TeamInfo>;
    matches: MatchInfo[];
    predictions: Map<string, Prediction>;
    standings: Map<GroupCode, StandingRow[]>;
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
}) {
    // A torneo iniziato la Fase 1 è congelata: editing in sola lettura.
    const phase1Locked = isPhase1Locked(matches.map((m) => m.kickoff));
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {GROUP_CODES.map((g) => (
                <GroupCard
                    key={g}
                    group={g}
                    teamMap={teamMap}
                    matches={matches.filter(
                        (m) => m.stage === "GROUP" && m.groupCode === g
                    )}
                    predictions={predictions}
                    rows={standings.get(g) ?? []}
                    savePrediction={savePrediction}
                    phase1Locked={phase1Locked}
                />
            ))}
        </div>
    );
}

function GroupCard({
    group,
    teamMap,
    matches,
    predictions,
    rows,
    savePrediction,
    phase1Locked,
}: {
    group: GroupCode;
    teamMap: Map<string, TeamInfo>;
    matches: MatchInfo[];
    predictions: Map<string, Prediction>;
    rows: StandingRow[];
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
    phase1Locked: boolean;
}) {
    const name = (id: string | null) =>
        id ? (teamMap.get(id)?.name ?? id) : "—";

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    Girone {group}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Classifica live */}
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-muted-foreground text-xs">
                            <th className="text-left font-medium py-1">
                                Squadra
                            </th>
                            <th className="w-8 text-center font-medium">Pt</th>
                            <th className="w-10 text-center font-medium">DR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.teamId} className="border-t">
                                <td className="py-1 flex items-center gap-2">
                                    <PositionBadge rank={r.rank} />
                                    <span>{name(r.teamId)}</span>
                                </td>
                                <td className="text-center font-semibold tabular-nums">
                                    {r.points}
                                </td>
                                <td className="text-center tabular-nums text-muted-foreground">
                                    {r.goalDiff > 0
                                        ? `+${r.goalDiff}`
                                        : r.goalDiff}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <Separator />

                {/* Partite */}
                <div className="space-y-2">
                    {matches.map((m) => (
                        <GroupMatchRow
                            key={m.id}
                            match={m}
                            homeName={name(m.homeTeamId)}
                            awayName={name(m.awayTeamId)}
                            prediction={predictions.get(m.id)}
                            savePrediction={savePrediction}
                            phase1Locked={phase1Locked}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function PositionBadge({ rank }: { rank: number }) {
    // 1-2 qualificate dirette, 3 possibile ripescata, 4 fuori
    const variant =
        rank <= 2 ? "default" : rank === 3 ? "secondary" : "outline";
    return (
        <Badge variant={variant} className="w-5 h-5 p-0 justify-center text-xs">
            {rank}
        </Badge>
    );
}

function GroupMatchRow({
    match,
    homeName,
    awayName,
    prediction,
    savePrediction,
    phase1Locked,
}: {
    match: MatchInfo;
    homeName: string;
    awayName: string;
    prediction?: Prediction;
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
    phase1Locked: boolean;
}) {
    const { impersonating } = useApp();
    const [home, setHome] = useState<number | "">(prediction?.homeScore ?? "");
    const [away, setAway] = useState<number | "">(prediction?.awayScore ?? "");
    // Admin in impersonation: nessun lock temporale.
    const locked = effectiveLock(
        phase1Locked || isMatchLocked(match.kickoff),
        impersonating
    );

    function commit(h: number | "", a: number | "") {
        if (locked) return;
        if (h === "" || a === "") return;
        savePrediction(match.id, { homeScore: h, awayScore: a });
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-right truncate">{homeName}</span>
            <ScoreInput
                value={home}
                disabled={locked}
                ariaLabel={`${homeName} gol`}
                onChange={(v) => {
                    setHome(v);
                    commit(v, away);
                }}
            />
            <span className="text-muted-foreground">-</span>
            <ScoreInput
                value={away}
                disabled={locked}
                ariaLabel={`${awayName} gol`}
                onChange={(v) => {
                    setAway(v);
                    commit(home, v);
                }}
            />
            <span className="flex-1 truncate">{awayName}</span>
        </div>
    );
}
