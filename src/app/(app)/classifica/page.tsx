import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadFullLeaderboard } from "@/lib/queries";
import { BONUS_WEIGHTS } from "@/lib/tournament/bonus";
import { Card, CardContent } from "@/components/ui/card";
import { LeaderboardViews } from "@/components/leaderboard-views";

export const metadata = { title: "Classifica — Mondiali 2026" };

export default async function ClassificaPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    const entries = await loadFullLeaderboard();
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
                    <LeaderboardViews entries={entries} meId={meId} />
                </CardContent>
            </Card>

            <p className="mt-4 text-xs text-muted-foreground text-center">
                <strong>Gironi</strong>: esatto 3 · esito 1. ·{" "}
                <strong>Tabellone</strong> (Fase 2): esatto 3 · chi-passa 1. ·{" "}
                <strong>Bonus</strong> (preveggenza Fase 1): {BONUS_WEIGHTS.R32}
                /{BONUS_WEIGHTS.R16}/{BONUS_WEIGHTS.QF}/{BONUS_WEIGHTS.SF}/
                {BONUS_WEIGHTS.FINAL}/{BONUS_WEIGHTS.CHAMPION} per turno
                raggiunto. · <strong>Totale</strong> = somma delle tre.
            </p>
        </div>
    );
}
