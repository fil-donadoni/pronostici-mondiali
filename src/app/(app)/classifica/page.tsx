import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Info, Medal } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Classifica — Mondiali 2026" };

export default async function ClassificaPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const entries = await loadLeaderboard();
    const meId = session.user.id;

    return (
        <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1">
                    <p className="font-medium">Intervento regolamentare</p>
                    <p className="text-muted-foreground">
                        I pronostici di Fase 1 inseriti o modificati{" "}
                        <strong>dopo il calcio d&apos;inizio</strong> della
                        partita (chi si è iscritto a torneo già iniziato)
                        valgono al massimo <strong>1 punto</strong> nei Gironi:
                        anche col punteggio esatto non assegnano i 3 punti
                        pieni. La regola è retroattiva e già applicata.
                    </p>
                </div>
            </div>

            <Card>
                <CardContent className="py-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10 text-center">
                                    #
                                </TableHead>
                                <TableHead>Giocatore</TableHead>
                                <TableHead className="text-center">
                                    Punti totali
                                </TableHead>
                                <TableHead className="text-center">
                                    Punteggi esatti
                                </TableHead>
                                <TableHead className="text-center">
                                    Risultati
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.map((e, i) => {
                                const isMe = e.userId === meId;
                                return (
                                    <TableRow
                                        key={e.userId}
                                        data-state={
                                            isMe ? "selected" : undefined
                                        }
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
                                        <TableCell className="text-center tabular-nums font-semibold">
                                            {e.points}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            {e.exactScores}
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            {e.correctResults}
                                        </TableCell>
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
                </CardContent>
            </Card>

            <p className="mt-4 text-xs text-muted-foreground text-center">
                <strong>Gironi</strong>: punteggio esatto 3 punti · esito
                (1/X/2) azzeccato 1 punto.
            </p>
        </div>
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
