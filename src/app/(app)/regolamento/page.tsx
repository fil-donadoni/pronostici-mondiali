import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BONUS_WEIGHTS } from "@/lib/tournament/bonus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Regolamento — Mondiali 2026" };

export default async function RegolamentoPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect("/login");

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Regolamento</h1>
                <p className="text-muted-foreground text-sm">
                    Il concorso si gioca in due fasi e quattro classifiche.
                </p>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Fase 1 — Pronostici iniziali
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        All&apos;inizio pronostichi{" "}
                        <strong>tutti i Gironi</strong> e l&apos;intero{" "}
                        <strong>Tabellone previsto</strong> (sedicesimi →
                        finale), partendo dalle tue classifiche.
                    </p>
                    <p>
                        La Fase 1 si{" "}
                        <strong>
                            congela al primo calcio d&apos;inizio del torneo
                        </strong>
                        : dopo non è più modificabile. È la fase che genera il
                        Bonus.
                    </p>
                    <p>
                        <strong>Finestra di grazia sul Tabellone:</strong> se
                        hai già compilato <strong>tutti i Gironi</strong>, puoi
                        continuare a modificare il{" "}
                        <strong>Tabellone previsto</strong> (solo quello, non i
                        Gironi) fino alla <strong>fine del 20/06/2026</strong>,
                        anche a torneo iniziato. Serve a chi si è iscritto tardi
                        per completare il bracket prima degli scontri diretti.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Fase 2 — Tabellone reale
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                        A gironi finiti pronostichi gli accoppiamenti{" "}
                        <strong>reali</strong> dei sedicesimi; a sedicesimi
                        finiti quelli degli ottavi; e così via fino alla finale
                        (inclusa la finale 3°/4°). Una finestra per turno: si
                        apre quando il turno precedente è concluso e si{" "}
                        <strong>blocca all&apos;inizio del turno</strong>.
                    </p>
                    <p>
                        Pronostichi sempre sulle squadre vere di quel turno,
                        quindi è sempre giocabile.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Punteggi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div>
                        <p className="font-medium text-foreground">
                            Classifica Gironi
                        </p>
                        <p>
                            Punteggio esatto = <strong>3</strong> punti. Solo
                            esito (1/X/2) corretto = <strong>1</strong> punto.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            Classifica Tabellone (Fase 2)
                        </p>
                        <p>
                            Punteggio esatto (a fine partita, prima dei rigori)
                            = <strong>3</strong> punti. Squadra che passa il
                            turno azzeccata = <strong>1</strong> punto.
                            Cumulabili: massimo 4 a partita.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            Classifica Bonus (preveggenza Fase 1)
                        </p>
                        <p>
                            Per ogni squadra che il tuo Tabellone previsto in
                            Fase 1 dava a un certo turno e che lo raggiunge
                            davvero, guadagni i punti del turno (cumulativi):
                            sedicesimi <strong>{BONUS_WEIGHTS.R32}</strong>,
                            ottavi <strong>{BONUS_WEIGHTS.R16}</strong>, quarti{" "}
                            <strong>{BONUS_WEIGHTS.QF}</strong>, semifinali{" "}
                            <strong>{BONUS_WEIGHTS.SF}</strong>, finale{" "}
                            <strong>{BONUS_WEIGHTS.FINAL}</strong>, campione{" "}
                            <strong>{BONUS_WEIGHTS.CHAMPION}</strong>. Conta la
                            squadra, non l&apos;accoppiamento.
                        </p>
                    </div>
                    <div>
                        <p className="font-medium text-foreground">
                            Classifica Totale
                        </p>
                        <p>
                            Somma di Gironi + Tabellone + Bonus. Le tre
                            componenti restano sempre visibili separatamente. A
                            parità: più punteggi esatti, poi nome.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                        Intervento regolamentare — iscritti in ritardo
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    <p>
                        I pronostici di Fase 1 inseriti o modificati{" "}
                        <strong>dopo il calcio d&apos;inizio</strong> di una
                        partita (chi si è iscritto a torneo già iniziato)
                        valgono al massimo <strong>1 punto</strong> nei Gironi,
                        anche col punteggio esatto. Regola retroattiva.
                    </p>
                </CardContent>
            </Card> */}
        </div>
    );
}
