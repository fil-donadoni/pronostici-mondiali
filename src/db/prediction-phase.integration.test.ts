import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { match, prediction, user } from "./schema";

/**
 * Integrazione su DB reale: gira solo con TEST_DATABASE_URL (DB di TEST,
 * mai produzione). In `npm test` normale è skippato.
 *
 *   TEST_DATABASE_URL=postgres://filippo@localhost:5432/mondiali_test npm test
 */
const url = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!url);

const U = "it-phase-user";
const M = "IT-PH-R32-1";

suite("prediction.phase — coesistenza Fase 1 / Fase 2 (integrazione)", () => {
    let sql: ReturnType<typeof postgres>;
    let db: ReturnType<typeof drizzle>;

    const cleanup = async () => {
        await db.delete(prediction).where(eq(prediction.userId, U));
        await db.delete(match).where(eq(match.id, M));
        await db.delete(user).where(eq(user.id, U));
    };

    beforeAll(async () => {
        sql = postgres(url!, { max: 1 });
        db = drizzle(sql);
        await cleanup();
        await db.insert(user).values({
            id: U,
            name: "Tester",
            email: "it-phase@example.test",
            emailVerified: false,
        });
        await db
            .insert(match)
            .values({ id: M, stage: "R32", matchNumber: 9173 });
    });

    afterAll(async () => {
        await cleanup();
        await sql.end();
    });

    it("due righe phase 1 e phase 2 sulla stessa (userId, matchId) coesistono", async () => {
        await db.insert(prediction).values([
            { userId: U, matchId: M, phase: 1, homeScore: 1, awayScore: 0 },
            { userId: U, matchId: M, phase: 2, homeScore: 2, awayScore: 2 },
        ]);

        const rows = await db
            .select()
            .from(prediction)
            .where(eq(prediction.userId, U));
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.phase).sort()).toEqual([1, 2]);
    });

    it("aggiornare una fase non tocca l'altra", async () => {
        await db
            .insert(prediction)
            .values({
                userId: U,
                matchId: M,
                phase: 2,
                homeScore: 3,
                awayScore: 1,
            })
            .onConflictDoUpdate({
                target: [
                    prediction.userId,
                    prediction.matchId,
                    prediction.phase,
                ],
                set: { homeScore: 3, awayScore: 1 },
            });

        const [p1] = await db
            .select()
            .from(prediction)
            .where(and(eq(prediction.userId, U), eq(prediction.phase, 1)));
        const [p2] = await db
            .select()
            .from(prediction)
            .where(and(eq(prediction.userId, U), eq(prediction.phase, 2)));

        expect(p1).toMatchObject({ homeScore: 1, awayScore: 0 }); // Fase 1 intatta
        expect(p2).toMatchObject({ homeScore: 3, awayScore: 1 }); // Fase 2 aggiornata
    });
});
