import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { match, realResult, team } from "./schema";

/**
 * Integrazione su DB reale: gira solo se TEST_DATABASE_URL punta a un Postgres
 * di TEST dedicato (mai produzione). In `npm test` normale è skippato.
 *
 *   TEST_DATABASE_URL=postgres://filippo@localhost:5432/mondiali_test npm test
 */
const url = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!url);

suite("real_result.advancerTeamId (integrazione)", () => {
    let sql: ReturnType<typeof postgres>;
    let db: ReturnType<typeof drizzle>;

    beforeAll(async () => {
        sql = postgres(url!, { max: 1 });
        db = drizzle(sql);
        // pulizia dei dati di test (ordine: dipendenze FK)
        await db.delete(realResult).where(eq(realResult.matchId, "IT-R32-1"));
        await db.delete(match).where(eq(match.id, "IT-R32-1"));
        await db.delete(team).where(eq(team.id, "ITX"));
        await db.delete(team).where(eq(team.id, "ITY"));
        await db.insert(team).values([
            { id: "ITX", name: "X", groupCode: "A" },
            { id: "ITY", name: "Y", groupCode: "B" },
        ]);
        await db.insert(match).values({
            id: "IT-R32-1",
            stage: "R32",
            matchNumber: 9073,
        });
    });

    afterAll(async () => {
        await db.delete(realResult).where(eq(realResult.matchId, "IT-R32-1"));
        await db.delete(match).where(eq(match.id, "IT-R32-1"));
        await db.delete(team).where(eq(team.id, "ITX"));
        await db.delete(team).where(eq(team.id, "ITY"));
        await sql.end();
    });

    it("persiste e rilegge la squadra avanzante del knockout", async () => {
        await db.insert(realResult).values({
            matchId: "IT-R32-1",
            homeScore: 1,
            awayScore: 1,
            homeTeamId: "ITX",
            awayTeamId: "ITY",
            advancerTeamId: "ITY", // passa ai rigori pur con pari nei 90'
            finished: true,
        });

        const [row] = await db
            .select()
            .from(realResult)
            .where(eq(realResult.matchId, "IT-R32-1"));

        expect(row.advancerTeamId).toBe("ITY");
        expect(row.finished).toBe(true);
    });
});
