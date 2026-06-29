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

type ViewKey = "totale" | "gironi" | "tabellone" | "profezia";

const VIEWS: { key: ViewKey; label: string }[] = [
    { key: "totale", label: "Generale" },
    { key: "gironi", label: "Gironi" },
    { key: "tabellone", label: "Tabellone" },
    { key: "profezia", label: "Profezia" },
];

/** Punti su cui ordina ogni vista. */
const sortPoints = (e: FullLeaderboardEntry, view: ViewKey): number => {
    switch (view) {
        case "gironi":
            return e.gironi.points;
        case "tabellone":
            return e.tabellone.points;
        case "profezia":
            return e.profezia.points;
        default:
            return e.totale;
    }
};

/** Turni della Profezia con il numero di squadre che raggiungono quel turno. */
const PROFEZIA_STAGES: { key: string; label: string; total: number }[] = [
    { key: "R32", label: "Sedicesimi", total: 32 },
    { key: "R16", label: "Ottavi", total: 16 },
    { key: "QF", label: "Quarti", total: 8 },
    { key: "SF", label: "Semi", total: 4 },
    { key: "FINAL", label: "Finale", total: 2 },
];

/**
 * Le quattro viste della Classifica (ADR 0003). Ogni vista mostra le colonne
 * pertinenti; il Totale (Generale) somma Gironi + Tabellone + Profezia.
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
            sortPoints(b, view) - sortPoints(a, view) ||
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

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10 text-center">
                                #
                            </TableHead>
                            <TableHead>Giocatore</TableHead>
                            <Headers view={view} />
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
                                    <Cells view={view} e={e} />
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {entries.length === 0 && (
                <p className="py-10 text-center text-muted-foreground">
                    Nessun giocatore ancora.
                </p>
            )}
        </div>
    );
}

function Headers({ view }: { view: ViewKey }) {
    if (view === "totale") {
        return (
            <>
                <Th>Gironi</Th>
                <Th>Tabellone</Th>
                <Th>Profezia</Th>
                <Th highlight>Totale</Th>
            </>
        );
    }
    if (view === "profezia") {
        return (
            <>
                {PROFEZIA_STAGES.map((s) => (
                    <Th key={s.key}>
                        {s.label}
                        <span className="text-muted-foreground">
                            /{s.total}
                        </span>
                    </Th>
                ))}
                <Th highlight>Punti</Th>
            </>
        );
    }
    // gironi / tabellone
    return (
        <>
            <Th>Esatti</Th>
            <Th>Risultati</Th>
            <Th highlight>Punti</Th>
        </>
    );
}

function Cells({ view, e }: { view: ViewKey; e: FullLeaderboardEntry }) {
    if (view === "totale") {
        return (
            <>
                <Num value={e.gironi.points} />
                <Num value={e.tabellone.points} />
                <Num value={e.profezia.points} />
                <Num value={e.totale} highlight />
            </>
        );
    }
    if (view === "profezia") {
        return (
            <>
                {PROFEZIA_STAGES.map((s) => (
                    <Num key={s.key} value={e.profezia.hits[s.key] ?? 0} />
                ))}
                <Num value={e.profezia.points} highlight />
            </>
        );
    }
    const c = view === "gironi" ? e.gironi : e.tabellone;
    return (
        <>
            <Num value={c.exact} />
            <Num value={c.correctResults} />
            <Num value={c.points} highlight />
        </>
    );
}

function Th({
    children,
    highlight,
}: {
    children: React.ReactNode;
    highlight?: boolean;
}) {
    return (
        <TableHead
            className={`text-center whitespace-nowrap ${
                highlight ? "text-primary font-semibold" : ""
            }`}
        >
            {children}
        </TableHead>
    );
}

function Num({ value, highlight }: { value: number; highlight?: boolean }) {
    return (
        <TableCell
            className={`text-center tabular-nums ${
                highlight ? "text-primary font-bold" : ""
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
