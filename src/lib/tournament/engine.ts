import {
    GROUP_CODES,
    KNOCKOUT_MATCHES,
    KNOCKOUT_STAGE_ORDER,
    type GroupCode,
    type Slot,
} from "./structure";
import { THIRD_PLACE_TABLE } from "./third-place-table";
import type {
    MatchInfo,
    Prediction,
    ResolvedKnockout,
    StandingRow,
    TeamInfo,
} from "./types";

const PRED = (m: Map<string, Prediction>, id: string) => m.get(id);

/**
 * Tie-break RIDOTTO (vedi docs/adr/0002 e D9):
 * punti -> differenza reti -> gol fatti -> id alfabetico (deterministico).
 */
function compareRows(a: StandingRow, b: StandingRow): number {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.teamId.localeCompare(b.teamId);
}

function emptyRow(teamId: string): StandingRow {
    return {
        teamId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        rank: 0,
    };
}

/**
 * Classifiche dei 12 gironi derivate dai pronostici dell'utente.
 * Una partita conta solo se l'utente l'ha pronosticata.
 */
export function computeStandings(
    teams: TeamInfo[],
    matches: MatchInfo[],
    predictions: Map<string, Prediction>
): Map<GroupCode, StandingRow[]> {
    const byGroup = new Map<GroupCode, Map<string, StandingRow>>();
    for (const g of GROUP_CODES) byGroup.set(g, new Map());

    for (const t of teams) {
        const g = t.groupCode as GroupCode;
        byGroup.get(g)?.set(t.id, emptyRow(t.id));
    }

    for (const m of matches) {
        if (m.stage !== "GROUP" || !m.groupCode) continue;
        if (!m.homeTeamId || !m.awayTeamId) continue;
        const p = PRED(predictions, m.id);
        if (!p) continue;

        const rows = byGroup.get(m.groupCode as GroupCode);
        const home = rows?.get(m.homeTeamId);
        const away = rows?.get(m.awayTeamId);
        if (!home || !away) continue;

        home.played++;
        away.played++;
        home.goalsFor += p.homeScore;
        home.goalsAgainst += p.awayScore;
        away.goalsFor += p.awayScore;
        away.goalsAgainst += p.homeScore;

        if (p.homeScore > p.awayScore) {
            home.won++;
            away.lost++;
            home.points += 3;
        } else if (p.homeScore < p.awayScore) {
            away.won++;
            home.lost++;
            away.points += 3;
        } else {
            home.drawn++;
            away.drawn++;
            home.points += 1;
            away.points += 1;
        }
    }

    const result = new Map<GroupCode, StandingRow[]>();
    for (const g of GROUP_CODES) {
        const rows = [...(byGroup.get(g)?.values() ?? [])];
        for (const r of rows) r.goalDiff = r.goalsFor - r.goalsAgainst;
        rows.sort(compareRows);
        rows.forEach((r, i) => (r.rank = i + 1));
        result.set(g, rows);
    }
    return result;
}

/** Le 12 terze (con almeno una partita giocata) ordinate per merito, con il girone. */
function rankThirds(
    standings: Map<GroupCode, StandingRow[]>
): { row: StandingRow; group: GroupCode }[] {
    const thirds: { row: StandingRow; group: GroupCode }[] = [];
    for (const g of GROUP_CODES) {
        const row = standings.get(g)?.[2];
        if (row && row.played > 0) thirds.push({ row, group: g });
    }
    thirds.sort((a, b) => compareRows(a.row, b.row));
    return thirds;
}

/**
 * Le 8 migliori terze: ranking lineare delle 12 terze (stesso tie-break
 * ridotto). Restituisce gli id in ordine di merito.
 */
export function qualifyThirds(
    standings: Map<GroupCode, StandingRow[]>
): string[] {
    return rankThirds(standings)
        .slice(0, 8)
        .map((t) => t.row.teamId);
}

function winnerOfPrediction(
    homeId: string | null,
    awayId: string | null,
    p: Prediction | undefined
): { winnerId: string | null; loserId: string | null } {
    if (!homeId || !awayId || !p) return { winnerId: null, loserId: null };
    if (p.homeScore > p.awayScore) return { winnerId: homeId, loserId: awayId };
    if (p.awayScore > p.homeScore) return { winnerId: awayId, loserId: homeId };
    // pareggio nei 90' -> rigori
    if (p.penaltyWinner === "home")
        return { winnerId: homeId, loserId: awayId };
    if (p.penaltyWinner === "away")
        return { winnerId: awayId, loserId: homeId };
    return { winnerId: null, loserId: null }; // utente non ha ancora scelto chi passa
}

/**
 * Propaga i pronostici lungo tutto il Tabellone.
 * Risolve ogni slot (piazzata, terza, vincente-di) e calcola il vincente,
 * fino alla Finale. Tutto derivato (ADR 0001).
 */
export function resolveBracket(
    standings: Map<GroupCode, StandingRow[]>,
    predictions: Map<string, Prediction>
): Map<string, ResolvedKnockout> {
    // Assegnazione UFFICIALE delle 8 terze (tabella FIFA Annex C, 495 combinazioni).
    // 1) Ranking delle 12 terze -> le 8 qualificate e i loro gironi.
    // 2) Chiave = gironi ordinati -> mappa { gironeVincente -> gironeDellaTerza }.
    // 3) Ogni slot "third" affronta la 1ª di `facingWinner`: prende la terza del
    //    girone indicato dalla tabella. Se <8 terze decise (utente non ha ancora
    //    pronosticato tutti i gironi) la chiave non esiste -> slot TBD (null).
    const ranked = rankThirds(standings);
    const qualifiedGroups = ranked.slice(0, 8).map((t) => t.group);
    const tableKey = [...qualifiedGroups].sort().join("");
    const fifaAssignment: Record<string, GroupCode> | undefined =
        qualifiedGroups.length === 8 ? THIRD_PLACE_TABLE[tableKey] : undefined;

    const resolved = new Map<string, ResolvedKnockout>();

    const resolveSlot = (slot: Slot): string | null => {
        switch (slot.kind) {
            case "winner-group":
                return standings.get(slot.group)?.[0]?.teamId ?? null;
            case "runner-group":
                return standings.get(slot.group)?.[1]?.teamId ?? null;
            case "third": {
                const thirdGroup = fifaAssignment?.[slot.facingWinner];
                return thirdGroup
                    ? (standings.get(thirdGroup)?.[2]?.teamId ?? null)
                    : null;
            }
            case "winner-of":
                return resolved.get(slot.matchId)?.winnerId ?? null;
            case "loser-of":
                return resolved.get(slot.matchId)?.loserId ?? null;
        }
    };

    // L'ordine di KNOCKOUT_MATCHES garantisce che le dipendenze (winner-of)
    // siano già risolte quando le leggiamo.
    for (const m of KNOCKOUT_MATCHES) {
        const homeId = resolveSlot(m.home);
        const awayId = resolveSlot(m.away);
        const { winnerId, loserId } = winnerOfPrediction(
            homeId,
            awayId,
            PRED(predictions, m.id)
        );
        resolved.set(m.id, {
            matchId: m.id,
            homeTeamId: homeId,
            awayTeamId: awayId,
            winnerId,
            loserId,
        });
    }

    return resolved;
}

/** Insieme di squadre previste che raggiungono ciascun turno (per il confronto C-light). */
export function teamsReachingStage(
    bracket: Map<string, ResolvedKnockout>
): Record<string, string[]> {
    const out: Record<string, Set<string>> = {};
    for (const stage of KNOCKOUT_STAGE_ORDER) out[stage] = new Set();

    for (const m of KNOCKOUT_MATCHES) {
        if (!KNOCKOUT_STAGE_ORDER.includes(m.stage)) continue;
        const r = bracket.get(m.id);
        if (!r) continue;
        if (r.homeTeamId) out[m.stage].add(r.homeTeamId);
        if (r.awayTeamId) out[m.stage].add(r.awayTeamId);
    }
    // Il "vincente" della finale = campione
    const champ = bracket.get("FINAL")?.winnerId;
    if (champ) {
        out["CHAMPION"] = new Set([champ]);
    }
    const result: Record<string, string[]> = {};
    for (const k of Object.keys(out)) result[k] = [...out[k]];
    return result;
}
