import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { match, prediction } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isMatchLocked } from "@/lib/match-lock";

const bodySchema = z.object({
    matchId: z.string().min(1),
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
    const userId = session.user.id;

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

    // upsert su (userId, matchId)
    await db
        .insert(prediction)
        .values({
            userId,
            matchId,
            homeScore,
            awayScore,
            penaltyWinner: penaltyWinner ?? null,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: [prediction.userId, prediction.matchId],
            set: {
                homeScore,
                awayScore,
                penaltyWinner: penaltyWinner ?? null,
                updatedAt: new Date(),
            },
        });

    return NextResponse.json({ ok: true });
}
