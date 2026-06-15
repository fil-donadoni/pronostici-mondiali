"use client";

import { useState } from "react";
import { Medal } from "lucide-react";
import type { FullLeaderboardEntry } from "@/lib/full-leaderboard";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type ViewKey = "totale" | "gironi" | "tabellone" | "bonus";

const VIEWS: { key: ViewKey; label: string }[] = [
    { key: "totale", label: "Totale" },
    { key: "gironi", label: "Gironi" },
    { key: "tabellone", label: "Tabellone" },
    { key: "bonus", label: "Bonus" },
];

/**
 * Le quattro viste della Classifica (ADR 0003). Le tre componenti
 * (Gironi/Tabellone/Bonus) e il Totale sono SEMPRE visibili insieme; la vista
 * scelta cambia solo l'ordinamento e la colonna evidenziata.
 */
export function LeaderboardViews({
    entries,
    meId,
}: {
    entries: FullLeaderboardEntry[];
    meId: string;
}) {
    const [view, setView] = useState<ViewKey>("totale");

    const sorted = [...entries].sort(
        (a, b) =>
            b[view] - a[view] ||
            b.totale - a.totale ||
            a.name.localeCompare(b.name)
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                {VIEWS.map((v) => (
                    <button
                        key={v.key}
                        onClick={() => setView(v.key)}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                            view === v.key
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead>Giocatore</TableHead>
                        <Col label="Gironi" active={view === "gironi"} />
                        <Col label="Tabellone" active={view === "tabellone"} />
                        <Col label="Bonus" active={view === "bonus"} />
                        <Col label="Totale" active={view === "totale"} />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.map((e, i) => {
                        const isMe = e.userId === meId;
                        return (
                            <TableRow
                                key={e.userId}
                                data-state={isMe ? "selected" : undefined}
                            >
                                <TableCell className="text-center">
                                    <RankBadge rank={i + 1} />
                                </TableCell>
                                <TableCell className="font-medium">
                                    {e.name}
                                    {isMe && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            (tu)
                                        </span>
                                    )}
                                </TableCell>
                                <Num
                                    value={e.gironi}
                                    active={view === "gironi"}
                                />
                                <Num
                                    value={e.tabellone}
                                    active={view === "tabellone"}
                                />
                                <Num
                                    value={e.bonus}
                                    active={view === "bonus"}
                                />
                                <Num
                                    value={e.totale}
                                    active={view === "totale"}
                                    bold
                                />
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {entries.length === 0 && (
                <p className="py-10 text-center text-muted-foreground">
                    Nessun giocatore ancora.
                </p>
            )}
        </div>
    );
}

function Col({ label, active }: { label: string; active: boolean }) {
    return (
        <TableHead
            className={`text-center ${active ? "text-primary font-semibold" : ""}`}
        >
            {label}
        </TableHead>
    );
}

function Num({
    value,
    active,
    bold,
}: {
    value: number;
    active: boolean;
    bold?: boolean;
}) {
    return (
        <TableCell
            className={`text-center tabular-nums ${
                active ? "text-primary font-bold" : bold ? "font-semibold" : ""
            }`}
        >
            {value}
        </TableCell>
    );
}

function RankBadge({ rank }: { rank: number }) {
    if (rank > 3) {
        return (
            <span className="text-muted-foreground tabular-nums">{rank}</span>
        );
    }
    const color =
        rank === 1
            ? "text-amber-400"
            : rank === 2
              ? "text-slate-300"
              : "text-amber-700";
    return <Medal className={`mx-auto size-5 ${color}`} strokeWidth={2.5} />;
}
