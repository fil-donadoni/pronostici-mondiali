import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { team, match, prediction, realResult, user } from "@/db/schema";
import { buildLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import {
    buildFullLeaderboard,
    type FullLeaderboardEntry,
} from "@/lib/full-leaderboard";
import { buildStatistiche, type Statistiche } from "@/lib/match-stats";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";

export async function loadTeams(): Promise<TeamInfo[]> {
    const rows = await db.select().from(team);
    return rows.map((t) => ({
        id: t.id,
        name: t.name,
        groupCode: t.groupCode,
    }));
}

export async function loadMatches(): Promise<MatchInfo[]> {
    const rows = await db.select().from(match);
    return rows
        .map((m) => ({
            id: m.id,
            stage: m.stage as MatchInfo["stage"],
            groupCode: m.groupCode,
            matchNumber: m.matchNumber,
            kickoff: m.kickoff ? m.kickoff.toISOString() : null,
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            homeSlot: m.homeSlot,
            awaySlot: m.awaySlot,
        }))
        .sort((a, b) => a.matchNumber - b.matchNumber);
}

export async function loadPredictions(userId: string): Promise<Prediction[]> {
    // Fase 1 (Gironi + bracket previsto): la dashboard pronostica qui.
    const rows = await db
        .select()
        .from(prediction)
        .where(and(eq(prediction.userId, userId), eq(prediction.phase, 1)));
    return rows.map((p) => ({
        matchId: p.matchId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
        updatedAt: p.updatedAt.toISOString(),
    }));
}

/** Pronostici di Fase 2 (Tabellone reale) di un utente. */
export async function loadPhase2Predictions(
    userId: string
): Promise<Prediction[]> {
    const rows = await db
        .select()
        .from(prediction)
        .where(and(eq(prediction.userId, userId), eq(prediction.phase, 2)));
    return rows.map((p) => ({
        matchId: p.matchId,
        homeScore: p.homeScore,
        awayScore: p.awayScore,
        penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
        updatedAt: p.updatedAt.toISOString(),
    }));
}

export async function loadRealResults(): Promise<RealResult[]> {
    const rows = await db.select().from(realResult);
    return rows.map((r) => ({
        matchId: r.matchId,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        homeTeamId: r.homeTeamId,
        awayTeamId: r.awayTeamId,
        advancerTeamId: r.advancerTeamId,
        finished: r.finished,
    }));
}

/**
 * Classifica giocatori: carica i dati e delega a buildLeaderboard.
 * Visibile a tutti i loggati.
 */
export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
    const [users, allPreds, reals, matches] = await Promise.all([
        db.select({ id: user.id, name: user.name }).from(user),
        db.select().from(prediction).where(eq(prediction.phase, 1)),
        loadRealResults(),
        loadMatches(),
    ]);

    return buildLeaderboard(
        users,
        allPreds.map((p) => ({
            userId: p.userId,
            matchId: p.matchId,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
            updatedAt: p.updatedAt.toISOString(),
        })),
        reals,
        matches
    );
}

/**
 * Classifica completa a 4 componenti (Gironi/Tabellone/Bonus/Totale).
 * Carica ENTRAMBE le fasi dei Pronostici (vedi docs/adr/0003).
 */
export async function loadFullLeaderboard(): Promise<FullLeaderboardEntry[]> {
    const [users, allPreds, reals, matches, teams] = await Promise.all([
        db.select({ id: user.id, name: user.name }).from(user),
        db.select().from(prediction),
        loadRealResults(),
        loadMatches(),
        loadTeams(),
    ]);

    return buildFullLeaderboard(
        users,
        allPreds.map((p) => ({
            userId: p.userId,
            matchId: p.matchId,
            phase: p.phase,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
            updatedAt: p.updatedAt.toISOString(),
        })),
        reals,
        matches,
        teams
    );
}

/**
 * Statistiche bizzarre cross-utente: carica i dati e delega a buildStatistiche.
 * Visibile a tutti i loggati.
 */
export async function loadStatistiche(): Promise<Statistiche> {
    const [users, allPreds, reals, matches, teams] = await Promise.all([
        db.select({ id: user.id, name: user.name }).from(user),
        db.select().from(prediction).where(eq(prediction.phase, 1)),
        loadRealResults(),
        loadMatches(),
        loadTeams(),
    ]);

    return buildStatistiche(
        users,
        allPreds.map((p) => ({
            userId: p.userId,
            matchId: p.matchId,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
            // Abilita il cap "ritardo": un esatto salvato dopo il calcio
            // d'inizio non conta per l'oracolo (vedi buildLeaderboard).
            updatedAt: p.updatedAt.toISOString(),
        })),
        reals,
        matches,
        teams
    );
}
