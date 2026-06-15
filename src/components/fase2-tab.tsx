"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreInput } from "@/components/score-input";

export type Fase2Match = {
    matchId: string;
    isThird: boolean;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeName: string | null;
    awayName: string | null;
    kickoff: string | null;
    prediction: {
        homeScore: number;
        awayScore: number;
        penaltyWinner: "home" | "away" | null;
    } | null;
};

export type Fase2Round = {
    stage: string;
    label: string;
    locked: boolean;
    matches: Fase2Match[];
};

export function Fase2Tab({ rounds }: { rounds: Fase2Round[] }) {
    return (
        <div className="space-y-6">
            {rounds.map((round) => (
                <RoundBlock key={round.stage} round={round} />
            ))}
        </div>
    );
}

function RoundBlock({ round }: { round: Fase2Round }) {
    // Un turno è "aperto" se almeno una partita ha entrambe le squadre reali note.
    const anyReady = round.matches.some((m) => m.homeTeamId && m.awayTeamId);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                    {round.label}
                </h2>
                {round.locked && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" /> bloccato
                    </span>
                )}
            </div>

            {!anyReady ? (
                <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                        In attesa dei risultati del turno precedente.
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {round.matches.map((m) => (
                        <Fase2MatchRow
                            key={m.matchId}
                            match={m}
                            locked={round.locked}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function Fase2MatchRow({
    match,
    locked,
}: {
    match: Fase2Match;
    locked: boolean;
}) {
    const ready = !!match.homeTeamId && !!match.awayTeamId;
    const [home, setHome] = useState<number | "">(
        match.prediction?.homeScore ?? ""
    );
    const [away, setAway] = useState<number | "">(
        match.prediction?.awayScore ?? ""
    );
    const [penalty, setPenalty] = useState<"home" | "away" | null>(
        match.prediction?.penaltyWinner ?? null
    );

    const disabled = locked || !ready;
    const isDraw = home !== "" && away !== "" && home === away;

    async function save(
        h: number | "",
        a: number | "",
        pen: "home" | "away" | null
    ) {
        if (disabled || h === "" || a === "") return;
        try {
            const res = await fetch("/api/predictions", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    matchId: match.matchId,
                    phase: 2,
                    homeScore: h,
                    awayScore: a,
                    penaltyWinner: h === a ? pen : null,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error ?? "Salvataggio non riuscito");
            }
        } catch {
            toast.error("Errore di rete");
        }
    }

    return (
        <Card className={ready ? "" : "opacity-60"}>
            <CardContent className="flex items-center gap-2 p-2 text-sm">
                {match.isThird && (
                    <span className="mr-1 text-xs text-muted-foreground">
                        3°/4°
                    </span>
                )}
                <span className="flex-1 truncate text-right">
                    {match.homeName ?? "—"}
                </span>
                <ScoreInput
                    value={home}
                    disabled={disabled}
                    ariaLabel={`${match.homeName ?? "casa"} gol`}
                    onChange={(v) => {
                        setHome(v);
                        save(v, away, penalty);
                    }}
                />
                <span className="text-muted-foreground">-</span>
                <ScoreInput
                    value={away}
                    disabled={disabled}
                    ariaLabel={`${match.awayName ?? "ospite"} gol`}
                    onChange={(v) => {
                        setAway(v);
                        save(home, v, penalty);
                    }}
                />
                <span className="flex-1 truncate">{match.awayName ?? "—"}</span>
            </CardContent>

            {isDraw && ready && !locked && (
                <CardContent className="flex items-center gap-2 px-2 pb-2 pt-0">
                    <span className="text-xs text-muted-foreground">
                        Passa ai rigori:
                    </span>
                    <Button
                        size="sm"
                        variant={penalty === "home" ? "default" : "outline"}
                        className="h-6 flex-1 truncate px-2 text-xs"
                        onClick={() => {
                            setPenalty("home");
                            save(home, away, "home");
                        }}
                    >
                        {match.homeName}
                    </Button>
                    <Button
                        size="sm"
                        variant={penalty === "away" ? "default" : "outline"}
                        className="h-6 flex-1 truncate px-2 text-xs"
                        onClick={() => {
                            setPenalty("away");
                            save(home, away, "away");
                        }}
                    >
                        {match.awayName}
                    </Button>
                </CardContent>
            )}
        </Card>
    );
}
