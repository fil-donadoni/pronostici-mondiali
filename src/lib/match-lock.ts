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

/**
 * Lock GLOBALE della Fase 1: dal primo calcio d'inizio del torneo (il più
 * vicino tra TUTTE le Partite) in poi, i Pronostici di Fase 1 — Gironi e
 * bracket previsto — non sono più modificabili. Il Bonus premia la preveggenza
 * pre-torneo, quindi il bracket dev'essere congelato prima che escano i
 * Risultati reali (vedi docs/adr/0003).
 *
 * Funzione pura condivisa tra client (editing disabilitato) e server
 * (validazione in PUT /api/predictions).
 */
export function isPhase1Locked(
    kickoffs: Array<string | Date | null | undefined>,
    now: Date = new Date()
): boolean {
    let earliest = Number.POSITIVE_INFINITY;
    for (const kickoff of kickoffs) {
        if (!kickoff) continue;
        const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
        const t = k.getTime();
        if (Number.isNaN(t)) continue;
        if (t < earliest) earliest = t;
    }
    if (!Number.isFinite(earliest)) return false;
    return now.getTime() >= earliest;
}
