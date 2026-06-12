import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Medal, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/queries";
import { POINTS } from "@/lib/tournament/compare";
import { Button } from "@/components/ui/button";
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
    <div className="flex-1 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl w-full px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Trophy className="size-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg leading-none tracking-tight">Classifica</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Esiti e punteggi azzeccati da ogni giocatore
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              I miei pronostici
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl w-full px-4 py-6 flex-1">
        <Card>
          <CardContent className="py-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Giocatore</TableHead>
                  <TableHead className="text-center">Punti</TableHead>
                  <TableHead className="text-center">Risultati</TableHead>
                  <TableHead className="text-center">Punteggi esatti</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e, i) => {
                  const rank = i + 1;
                  const isMe = e.userId === meId;
                  return (
                    <TableRow
                      key={e.userId}
                      data-state={isMe ? "selected" : undefined}
                    >
                      <TableCell className="text-center">
                        <RankBadge rank={rank} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {e.name}
                        {isMe && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (tu)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold tabular-nums text-primary">
                        {e.points}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {e.correctResults}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {e.exactScores}
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
          Punteggio esatto = {POINTS.exact} punti · solo esito (1/X/2) corretto ={" "}
          {POINTS.outcome} punto. Conteggio sulle partite dei gironi già
          disputate.
        </p>
      </main>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) {
    return <span className="text-muted-foreground tabular-nums">{rank}</span>;
  }
  const color =
    rank === 1
      ? "text-amber-400"
      : rank === 2
        ? "text-slate-300"
        : "text-amber-700";
  return <Medal className={`mx-auto size-5 ${color}`} strokeWidth={2.5} />;
}
