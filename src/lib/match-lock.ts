/**
 * Lock di un Pronostico: dal calcio d'inizio (kickoff) in poi la Partita è
 * iniziata e il Pronostico non è più modificabile.
 *
 * Funzione pura condivisa tra client (input disabilitati) e server
 * (validazione in PUT /api/predictions), così le due barriere concordano.
 */
export function isMatchLocked(
    kickoff: string | Date | null | undefined,
    now: Date = new Date()
): boolean {
    if (!kickoff) return false;
    const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
    if (Number.isNaN(k.getTime())) return false;
    return now.getTime() >= k.getTime();
}
