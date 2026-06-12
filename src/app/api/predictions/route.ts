import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { prediction } from "@/db/schema";
import { auth } from "@/lib/auth";

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
