import "dotenv/config";
import { db } from "./index";
import { team, match, realResult, prediction } from "./schema";
import { FALLBACK_TEAMS } from "./seed-data";
import { GROUP_CODES, KNOCKOUT_MATCHES } from "../lib/tournament/structure";
import type { Slot } from "../lib/tournament/structure";
import { GROUP_KICKOFFS, KNOCKOUT_KICKOFFS } from "./schedule-2026";

// Ordine round-robin per un girone da 4 (indici 0..3): 6 partite.
const RR_PAIRS: [number, number][] = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2],
];

function slotLabel(s: Slot): string {
    switch (s.kind) {
        case "winner-group":
            return `1${s.group}`;
        case "runner-group":
            return `2${s.group}`;
        case "third":
            return "3RD";
        case "winner-of":
            return `W:${s.matchId}`;
        case "loser-of":
            return `L:${s.matchId}`;
    }
}

async function seed() {
    console.log("→ Pulizia tabelle dominio…");
    await db.delete(prediction);
    await db.delete(realResult);
    await db.delete(match);
    await db.delete(team);

    const useApi = !!process.env.FOOTBALL_DATA_API_KEY;
    let teams = FALLBACK_TEAMS;

    if (useApi) {
        console.log("→ FOOTBALL_DATA_API_KEY presente: tentativo fetch reale…");
        try {
            teams = await fetchRealTeams();
            console.log(
                `  ✓ ${teams.length} squadre reali da football-data.org`
            );
        } catch (e) {
            console.warn(
                "  ! fetch reale fallito, uso il fallback:",
                (e as Error).message
            );
            teams = FALLBACK_TEAMS;
        }
    } else {
        console.log(
            "→ Nessuna API key: uso dataset di fallback (48 nazionali)."
        );
    }

    if (teams.length !== 48) {
        throw new Error(`Attese 48 squadre, ricevute ${teams.length}`);
    }

    console.log("→ Inserimento squadre…");
    await db.insert(team).values(
        teams.map((t) => ({
            id: t.id,
            name: t.name,
            groupCode: t.group,
            externalId: (t as { externalId?: number }).externalId ?? null,
        }))
    );

    console.log("→ Generazione 72 partite dei gironi…");
    const groupMatches: (typeof match.$inferInsert)[] = [];
    let matchNumber = 1;
    for (const g of GROUP_CODES) {
        const gTeams = teams.filter((t) => t.group === g);
        // kickoff reali FIFA: GROUP_KICKOFFS[g] è ordinato come RR_PAIRS.
        RR_PAIRS.forEach(([i, j], rr) => {
            groupMatches.push({
                id: `G-${matchNumber}`,
                stage: "GROUP",
                groupCode: g,
                matchNumber,
                kickoff: new Date(GROUP_KICKOFFS[g][rr]),
                homeTeamId: gTeams[i].id,
                awayTeamId: gTeams[j].id,
                homeSlot: null,
                awaySlot: null,
                externalId: null,
            });
            matchNumber++;
        });
    }
    await db.insert(match).values(groupMatches);

    console.log("→ Inserimento slot knockout (R32 → Finale)…");
    await db.insert(match).values(
        KNOCKOUT_MATCHES.map((m) => ({
            id: m.id,
            stage: m.stage,
            groupCode: null,
            matchNumber: m.matchNumber,
            // kickoff reali FIFA per matchNumber ufficiale (73..104).
            kickoff: new Date(KNOCKOUT_KICKOFFS[m.matchNumber]),
            homeTeamId: null,
            awayTeamId: null,
            homeSlot: slotLabel(m.home),
            awaySlot: slotLabel(m.away),
            externalId: null,
        }))
    );

    console.log("✓ Seed completato.");
    process.exit(0);
}

/**
 * Fetch reale da football-data.org. Recupera le squadre della competizione
 * e i loro gironi. Struttura difensiva: l'API può non avere ancora i gironi.
 */
async function fetchRealTeams() {
    const key = process.env.FOOTBALL_DATA_API_KEY!;
    const comp = process.env.FOOTBALL_DATA_COMPETITION ?? "WC";
    const res = await fetch(
        `https://api.football-data.org/v4/competitions/${comp}/teams`,
        { headers: { "X-Auth-Token": key } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
        teams?: { id: number; tla?: string; name: string }[];
    };
    const apiTeams = data.teams ?? [];
    if (apiTeams.length < 48) {
        throw new Error(`solo ${apiTeams.length} squadre dall'API`);
    }
    // Assegna le prime 48 ai gironi A..L (4 per girone) in ordine.
    return apiTeams.slice(0, 48).map((t, idx) => ({
        id: t.tla ?? `T${t.id}`,
        name: t.name,
        group: GROUP_CODES[Math.floor(idx / 4)],
        externalId: t.id,
    }));
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
