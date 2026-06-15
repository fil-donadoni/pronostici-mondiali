import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { match, prediction } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isMatchLocked, isPhase1Locked } from "@/lib/match-lock";

const bodySchema = z.object({
    matchId: z.string().min(1),
    // 1 = Fase 1 (default, retro-compatibile), 2 = Fase 2 (Tabellone reale)
    phase: z.union([z.literal(1), z.literal(2)]).optional(),
    homeScore: z.number().int().min(0).max(99),
    awayScore: z.number().int().min(0).max(99),
    penaltyWinner: z.enum(["home", "away"]).nullable().optional(),
});

export async function PUT(req: Request) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Payload non valido", issues: parsed.error.issues },
            { status: 400 }
        );
    }

    const { matchId, homeScore, awayScore, penaltyWinner } = parsed.data;
    const phase = parsed.data.phase ?? 1;
    const userId = session.user.id;

    // Freeze globale: a torneo iniziato la Fase 1 (Gironi + bracket previsto)
    // è congelata, così il Bonus resta una previsione pre-torneo (ADR 0003).
    // La Fase 2 (Tabellone reale) non è soggetta a questo freeze.
    if (phase === 1) {
        const allKickoffs = await db
            .select({ kickoff: match.kickoff })
            .from(match);
        if (isPhase1Locked(allKickoffs.map((r) => r.kickoff))) {
            return NextResponse.json(
                { error: "Torneo iniziato: Fase 1 bloccata" },
                { status: 403 }
            );
        }
    }

    // Lock sul calcio d'inizio: una Partita iniziata non è più pronosticabile.
    const [m] = await db
        .select({ kickoff: match.kickoff })
        .from(match)
        .where(eq(match.id, matchId))
        .limit(1);
    if (!m) {
        return NextResponse.json(
            { error: "Partita inesistente" },
            { status: 404 }
        );
    }
    if (isMatchLocked(m.kickoff)) {
        return NextResponse.json(
            { error: "Partita iniziata: Pronostico bloccato" },
            { status: 403 }
        );
    }

    // upsert su (userId, matchId, phase)
    await db
        .insert(prediction)
        .values({
            userId,
            matchId,
            phase,
            homeScore,
            awayScore,
            penaltyWinner: penaltyWinner ?? null,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [prediction.userId, prediction.matchId, prediction.phase],
            set: {
                homeScore,
                awayScore,
                penaltyWinner: penaltyWinner ?? null,
                updatedAt: new Date(),
            },
        });

    return NextResponse.json({ ok: true });
}
