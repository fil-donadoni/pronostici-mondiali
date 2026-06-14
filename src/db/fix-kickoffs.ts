import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { match } from "./schema";
import { GROUP_CODES, KNOCKOUT_MATCHES } from "../lib/tournament/structure";
import { GROUP_KICKOFFS, KNOCKOUT_KICKOFFS } from "./schedule-2026";

/**
 * Script one-off IDEMPOTENTE: corregge i kickoff sintetici nel DB con gli
 * orari reali FIFA (vedi schedule-2026.ts). Solo UPDATE per `id`, nessun
 * insert/delete -> rilanciabile N volte; cambia DATABASE_URL nel .env per
 * puntare un altro DB. Tocca solo righe `match` già esistenti.
 */
async function fixKickoffs() {
    console.log(
        `→ Correzione kickoff su ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@")}`
    );
    let updated = 0;
    let missing = 0;

    // Gironi: id `G-${matchNumber}`, matchNumber 1..72.
    // groupIndex = floor((N-1)/6), rr = (N-1)%6 (ordine RR_PAIRS).
    for (let n = 1; n <= 72; n++) {
        const group = GROUP_CODES[Math.floor((n - 1) / 6)];
        const rr = (n - 1) % 6;
        const kickoff = new Date(GROUP_KICKOFFS[group][rr]);
        const res = await db
            .update(match)
            .set({ kickoff })
            .where(eq(match.id, `G-${n}`));
        if (res.count > 0) updated += res.count;
        else missing++;
    }

    // Knockout: per id ufficiale, kickoff da matchNumber 73..104.
    for (const m of KNOCKOUT_MATCHES) {
        const iso = KNOCKOUT_KICKOFFS[m.matchNumber];
        if (!iso) {
            console.warn(`  ! nessun kickoff per match ${m.id}`);
            continue;
        }
        const res = await db
            .update(match)
            .set({ kickoff: new Date(iso) })
            .where(eq(match.id, m.id));
        if (res.count > 0) updated += res.count;
        else missing++;
    }

    console.log(
        `✓ ${updated} kickoff aggiornati, ${missing} match assenti nel DB.`
    );
    process.exit(0);
}

fixKickoffs().catch((e) => {
    console.error(e);
    process.exit(1);
});
