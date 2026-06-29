import type { MatchVerdict } from "@/lib/tournament/compare";

const STYLE: Record<MatchVerdict, { color: string; label: string }> = {
    exact: { color: "bg-green-500", label: "Punteggio esatto" },
    outcome: { color: "bg-yellow-500", label: "Esito corretto" },
    wrong: { color: "bg-red-500", label: "Esito sbagliato" },
};

/** Pallino verde/giallo/rosso del confronto Pronostico vs Risultato reale. */
export function VerdictDot({ verdict }: { verdict: MatchVerdict }) {
    const { color, label } = STYLE[verdict];
    return (
        <span
            className={`inline-block size-2.5 shrink-0 rounded-full ${color}`}
            title={label}
            aria-label={label}
        />
    );
}
