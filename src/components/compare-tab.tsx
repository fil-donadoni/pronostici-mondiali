"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { groupDiffs, roundSetDiffs, summarize } from "@/lib/tournament/compare";
import { KNOCKOUT_MATCHES, STAGE_LABEL } from "@/lib/tournament/structure";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";

export function CompareTab({
    teamMap,
    matches,
    predictions,
    realResults,
    predictedReaching,
}: {
    teamMap: Map<string, TeamInfo>;
    matches: MatchInfo[];
    predictions: Map<string, Prediction>;
    realResults: Map<string, RealResult>;
    predictedReaching: Record<string, string[]>;
}) {
    const name = (id: string) => teamMap.get(id)?.name ?? id;

    const diffs = useMemo(
        () => groupDiffs(matches, predictions, realResults),
        [matches, predictions, realResults]
    );
    const summary = useMemo(() => summarize(diffs), [diffs]);

    // Insiemi reali per turno, dai risultati reali del knockout (se presenti)
    const realReaching = useMemo(() => {
        const out: Record<string, Set<string>> = {};
        for (const m of KNOCKOUT_MATCHES) {
            const r = realResults.get(m.id);
            if (!r || !r.finished) continue;
            out[m.stage] ??= new Set();
            if (r.homeTeamId) out[m.stage].add(r.homeTeamId);
            if (r.awayTeamId) out[m.stage].add(r.awayTeamId);
        }
        const obj: Record<string, string[]> = {};
        for (const k of Object.keys(out)) obj[k] = [...out[k]];
        return obj;
    }, [realResults]);

    const rounds = useMemo(
        () => roundSetDiffs(predictedReaching, realReaching),
        [predictedReaching, realReaching]
    );

    const matchById = useMemo(
        () => new Map(matches.map((m) => [m.id, m])),
        [matches]
    );

    if (realResults.size === 0) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    Nessun risultato reale ancora. Premi{" "}
                    <span className="font-medium text-foreground">
                        Sync risultati
                    </span>{" "}
                    in alto per scaricarli e confrontarli con i tuoi pronostici.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Riepilogo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Confrontate" value={summary.totalCompared} />
                <StatCard
                    label="Risultato esatto"
                    value={summary.exact}
                    tone="ok"
                />
                <StatCard
                    label="Esito giusto"
                    value={summary.correctOutcome}
                    tone="warn"
                />
                <StatCard label="Sbagliate" value={summary.wrong} tone="bad" />
            </div>

            {/* Diff gironi */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Differenze nei gironi
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-1">
                        {diffs.map((d) => {
                            const m = matchById.get(d.matchId);
                            const homeName = m?.homeTeamId
                                ? name(m.homeTeamId)
                                : "?";
                            const awayName = m?.awayTeamId
                                ? name(m.awayTeamId)
                                : "?";
                            const tone = d.exactMatch
                                ? "ok"
                                : d.outcomeMatch
                                  ? "warn"
                                  : "bad";
                            return (
                                <div
                                    key={d.matchId}
                                    className="flex items-center gap-3 text-sm py-1 border-b last:border-0"
                                >
                                    <Dot tone={tone} />
                                    <span className="flex-1 text-right truncate">
                                        {homeName}
                                    </span>
                                    <span className="tabular-nums font-medium w-20 text-center">
                                        <span
                                            className={
                                                tone === "bad"
                                                    ? "text-muted-foreground line-through"
                                                    : ""
                                            }
                                        >
                                            {d.predicted.home}-
                                            {d.predicted.away}
                                        </span>
                                        {!d.exactMatch && (
                                            <span className="ml-2 text-foreground font-semibold">
                                                {d.real.home}-{d.real.away}
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex-1 truncate">
                                        {awayName}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Insiemi per turno (knockout) */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">
                        Squadre per turno: previsto vs reale
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {rounds.map((r) => (
                        <div key={r.stage}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                    {STAGE_LABEL[
                                        r.stage as keyof typeof STAGE_LABEL
                                    ] ?? r.stage}
                                </span>
                                {!r.hasReal && (
                                    <Badge
                                        variant="outline"
                                        className="text-[10px]"
                                    >
                                        nessun dato reale
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {r.predicted.map((t) => {
                                    const matched =
                                        r.hasReal &&
                                        !r.onlyPredicted.includes(t);
                                    return (
                                        <Badge
                                            key={t}
                                            variant={
                                                !r.hasReal
                                                    ? "secondary"
                                                    : matched
                                                      ? "default"
                                                      : "destructive"
                                            }
                                            className="text-[11px]"
                                        >
                                            {name(t)}
                                        </Badge>
                                    );
                                })}
                            </div>
                            {r.onlyReal.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Reali non previste:{" "}
                                    {r.onlyReal.map(name).join(", ")}
                                </p>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone?: "ok" | "warn" | "bad";
}) {
    const color =
        tone === "ok"
            ? "text-green-600"
            : tone === "warn"
              ? "text-amber-600"
              : tone === "bad"
                ? "text-red-600"
                : "";
    return (
        <Card>
            <CardContent className="py-4 text-center">
                <p className={`text-2xl font-bold tabular-nums ${color}`}>
                    {value}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
        </Card>
    );
}

function Dot({ tone }: { tone: "ok" | "warn" | "bad" }) {
    const color =
        tone === "ok"
            ? "bg-green-500"
            : tone === "warn"
              ? "bg-amber-500"
              : "bg-red-500";
    return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}
