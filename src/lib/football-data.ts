/**
 * Parsing puro dei punteggi football-data.org (nessun accesso DB/rete).
 * Estratto dalla Sync per essere testabile in isolamento.
 */

type ApiScorePair = { home: number | null; away: number | null } | null;

/** Lo `score` di una partita football-data v4. */
export type ApiScore = {
    winner: string | null; // HOME_TEAM | AWAY_TEAM | DRAW | null
    duration?: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
    fullTime: { home: number | null; away: number | null };
    regularTime?: ApiScorePair;
    extraTime?: ApiScorePair;
    penalties?: ApiScorePair;
};

/** Punteggio al 90'/120' (rigori esclusi) + chi-passa, dato lo score e i TLA. */
export type ParsedScore = {
    homeScore: number;
    awayScore: number;
    winnerTla: string | null;
};

/**
 * Normalizza un risultato football-data al punteggio che ci serve.
 *
 * Ai rigori l'API somma i tiri nel `fullTime` (es. 4-5): a noi serve il
 * risultato al 90'/120', quindi `regularTime + extraTime`; i rigori contano
 * solo per il chi-passa. Senza shootout il `fullTime` è già corretto.
 */
export function parseApiScore(
    s: ApiScore,
    homeTla: string,
    awayTla: string
): ParsedScore {
    const pen = s.penalties;
    const homeScore = pen
        ? (s.regularTime?.home ?? 0) + (s.extraTime?.home ?? 0)
        : (s.fullTime.home ?? 0);
    const awayScore = pen
        ? (s.regularTime?.away ?? 0) + (s.extraTime?.away ?? 0)
        : (s.fullTime.away ?? 0);

    let winnerTla =
        s.winner === "HOME_TEAM"
            ? homeTla
            : s.winner === "AWAY_TEAM"
              ? awayTla
              : null;
    // Allo shootout il campo `winner` può mancare: lo decidiamo dai rigori.
    if (!winnerTla && pen) {
        const ph = pen.home ?? 0;
        const pa = pen.away ?? 0;
        winnerTla = ph > pa ? homeTla : pa > ph ? awayTla : null;
    }

    return { homeScore, awayScore, winnerTla };
}
