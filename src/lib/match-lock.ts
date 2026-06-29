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
 * Lock effettivo di un Pronostico tenendo conto dell'impersonation.
 *
 * Un admin che impersona un altro utente aggira ogni lock temporale: può
 * correggere o inserire Pronostici anche su Partite già iniziate. In tutti gli
 * altri casi vale il lock grezzo (`rawLocked`). Funzione pura condivisa
 * client/server.
 */
export function effectiveLock(
    rawLocked: boolean,
    impersonating: boolean
): boolean {
    return !impersonating && rawLocked;
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
/** Durata stimata di una partita (per dire quando una partita è "finita"). */
const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

/**
 * La fase a Gironi è conclusa quando è passata la FINE (kickoff + ~2h)
 * dell'ultima partita dei Gironi. Da quel momento si apre la Fase 2
 * (Tabellone reale). Funzione pura: passare i kickoff delle sole Partite di
 * Girone.
 */
export function isGroupStageOver(
    groupKickoffs: Array<string | Date | null | undefined>,
    now: Date = new Date()
): boolean {
    let latest = Number.NEGATIVE_INFINITY;
    for (const kickoff of groupKickoffs) {
        if (!kickoff) continue;
        const k = typeof kickoff === "string" ? new Date(kickoff) : kickoff;
        const t = k.getTime();
        if (Number.isNaN(t)) continue;
        if (t > latest) latest = t;
    }
    if (!Number.isFinite(latest)) return false;
    return now.getTime() >= latest + MATCH_DURATION_MS;
}

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

/**
 * Finestra di grazia per il Tabellone previsto (Fase 1).
 *
 * Eccezione al freeze globale di {@link isPhase1Locked}: chi ha già compilato
 * TUTTE le Partite dei Gironi può continuare a modificare il bracket previsto
 * (solo il bracket, non i Gironi) fino alla fine del 20/06/2026 (ora italiana).
 * Serve a chi è arrivato in ritardo sui Gironi ma vuole completare il Tabellone
 * prima dell'inizio della fase a eliminazione.
 */
export const BRACKET_GRACE_DEADLINE = new Date("2026-06-20T23:59:59+02:00");

/**
 * True se l'utente ha compilato il Pronostico di TUTTE le Partite dei Gironi.
 * Funzione pura condivisa client/server: `predictedMatchIds` è l'insieme dei
 * matchId con Pronostico di Fase 1 salvato.
 */
export function allGroupsFilled(
    groupMatchIds: string[],
    predictedMatchIds: Set<string>
): boolean {
    return (
        groupMatchIds.length > 0 &&
        groupMatchIds.every((id) => predictedMatchIds.has(id))
    );
}

/**
 * Lock del Tabellone previsto (Fase 1). Come {@link isPhase1Locked}, ma con la
 * finestra di grazia: se l'utente ha completato tutti i Gironi e siamo ancora
 * entro {@link BRACKET_GRACE_DEADLINE}, il bracket resta modificabile anche a
 * torneo iniziato. Vale solo per le Partite del knockout, non per i Gironi.
 */
export function isBracketPhase1Locked(
    kickoffs: Array<string | Date | null | undefined>,
    groupsFilled: boolean,
    now: Date = new Date()
): boolean {
    if (groupsFilled && now.getTime() <= BRACKET_GRACE_DEADLINE.getTime()) {
        return false;
    }
    return isPhase1Locked(kickoffs, now);
}
