import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
    Crosshair,
    Crown,
    Dices,
    Flame,
    Info,
    Sparkles,
    Target,
    TrendingDown,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { loadStatistiche } from "@/lib/queries";
import type {
    MatchStat,
    NearMiss,
    PlayerAward,
    TopChampion,
} from "@/lib/match-stats";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Statistiche — Mondiali 2026" };

export default async function StatistichePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const stats = await loadStatistiche();

    if (stats.matchesCompared === 0) {
        return (
            <div className="mx-auto max-w-3xl">
                <p className="py-16 text-center text-muted-foreground">
                    Ancora nessuna partita dei gironi con risultato reale. Le
                    statistiche compaiono dopo il primo Sync.
                </p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <PlayerCard
                    icon={<Sparkles className="size-5 text-violet-500" />}
                    title="L'oracolo"
                    subtitle="Più punteggi esatti azzeccati"
                    player={stats.oracle}
                    count={stats.oracle?.exactScores ?? 0}
                    total={stats.oracle?.played ?? 0}
                    unit="esatti"
                />
                <PlayerCard
                    icon={<Dices className="size-5 text-rose-500" />}
                    title="Il gambler"
                    subtitle="Meno risultati azzeccati in percentuale"
                    player={stats.gambler}
                    count={stats.gambler?.correctResults ?? 0}
                    total={stats.gambler?.played ?? 0}
                    unit="risultati"
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Highlight
                    icon={<Target className="size-5 text-emerald-500" />}
                    title="Più punteggi esatti"
                    stat={stats.mostExact}
                    count={stats.mostExact?.exactCount ?? 0}
                />
                <Highlight
                    icon={<Flame className="size-5 text-amber-500" />}
                    title="Più risultati indovinati"
                    stat={stats.mostOutcome}
                    count={stats.mostOutcome?.outcomeCount ?? 0}
                />
                <Highlight
                    icon={<TrendingDown className="size-5 text-rose-500" />}
                    title="La meno azzeccata"
                    stat={stats.leastGuessed}
                    count={stats.leastGuessed?.outcomeCount ?? 0}
                />
            </div>

            {stats.topChampions.length > 0 && (
                <ChampionsCard champions={stats.topChampions} />
            )}

            <NearMissCard
                title="Quasi! Ribaltati per un gol"
                subtitle="Un solo gol ha cambiato l'esito. 3 punti persi!"
                iconClassName="text-rose-500"
                rows={stats.nearMisses.filter((n) => !n.outcomeMatch)}
            />

            <NearMissCard
                title="Quasi! Esito giusto, punteggio no"
                subtitle="Esito azzeccato, a un solo gol dal punteggio esatto."
                iconClassName="text-orange-500"
                rows={stats.nearMisses.filter((n) => n.outcomeMatch)}
            />

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Info className="size-3.5" />
                Su {stats.matchesCompared} partite dei gironi già disputate, su
                tutti i giocatori. Ordinati per gol totali della partita.
            </p>
        </div>
    );
}

function ChampionsCard({ champions }: { champions: TopChampion[] }) {
    const max = champions[0]?.count ?? 1;
    return (
        <Card>
            <CardContent className="space-y-3 py-4">
                <div className="flex items-center justify-center gap-2 font-semibold">
                    <Crown className="size-5 text-amber-500" />
                    Campioni più pronosticati
                </div>
                <p className="text-center text-xs text-muted-foreground">
                    Le 5 squadre date campione del mondo dal Tabellone di Fase 1
                </p>
                <div className="space-y-2 pt-1">
                    {champions.map((c, i) => (
                        <div key={c.teamId} className="flex items-center gap-3">
                            <span className="w-4 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                                {i + 1}
                            </span>
                            <span className="w-28 truncate text-sm font-medium">
                                {c.name}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-amber-500"
                                    style={{
                                        width: `${(c.count / max) * 100}%`,
                                    }}
                                />
                            </div>
                            <span className="w-6 text-right text-sm tabular-nums">
                                {c.count}
                            </span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function PlayerCard({
    icon,
    title,
    subtitle,
    player,
    count,
    total,
    unit,
}: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    player: PlayerAward | null;
    count: number;
    total: number;
    unit: string;
}) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <Card>
            <CardContent className="space-y-2 py-4 text-center">
                <div className="flex items-center justify-center gap-2 font-semibold">
                    {icon}
                    {title}
                </div>
                <p className="text-xs text-muted-foreground">{subtitle}</p>
                {player ? (
                    <>
                        <p className="pt-1 text-lg font-bold">{player.name}</p>
                        <p className="text-2xl font-bold tabular-nums text-primary">
                            {count}/{total}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                {unit} ({pct}%)
                            </span>
                        </p>
                    </>
                ) : (
                    <p className="py-4 text-muted-foreground">—</p>
                )}
            </CardContent>
        </Card>
    );
}

function NearMissCard({
    title,
    subtitle,
    rows,
    iconClassName = "text-primary",
}: {
    title: string;
    subtitle: string;
    rows: NearMiss[];
    iconClassName?: string;
}) {
    return (
        <Card>
            <CardContent className="space-y-3 py-4">
                <div className="flex items-center gap-2">
                    <Crosshair className={`size-5 ${iconClassName}`} />
                    <h2 className="font-semibold">{title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{subtitle}</p>

                {rows.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                        Nessuno per ora.
                    </p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Giocatore</TableHead>
                                <TableHead>Partita</TableHead>
                                <TableHead className="text-center">
                                    Pronostico
                                </TableHead>
                                <TableHead className="text-center">
                                    Reale
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((n, i) => (
                                <TableRow
                                    key={`${n.matchId}-${n.userName}-${i}`}
                                >
                                    <TableCell className="font-medium">
                                        {n.userName}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {n.label}
                                    </TableCell>
                                    <TableCell className="text-center tabular-nums">
                                        {n.predicted.home}-{n.predicted.away}
                                    </TableCell>
                                    <TableCell className="text-center font-semibold tabular-nums">
                                        {n.real.home}-{n.real.away}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function Highlight({
    icon,
    title,
    stat,
    count,
}: {
    icon: React.ReactNode;
    title: string;
    stat: MatchStat | null;
    /** Numeratore mostrato su {count}/{total}: esatti o esiti azzeccati. */
    count: number;
}) {
    const pct =
        stat && stat.total > 0 ? Math.round((count / stat.total) * 100) : 0;
    return (
        <Card>
            <CardContent className="space-y-2 py-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {icon}
                    {title}
                </div>
                {stat ? (
                    <>
                        <p className="text-2xl font-bold tabular-nums text-primary">
                            {count}/{stat.total}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                                ({pct}%)
                            </span>
                        </p>
                        <p className="text-sm font-medium">{stat.label}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                            finita {stat.real.home}-{stat.real.away}
                        </p>
                    </>
                ) : (
                    <p className="text-muted-foreground">—</p>
                )}
            </CardContent>
        </Card>
    );
}
