import { eq } from "drizzle-orm";
import { db } from "@/db";
import { team, match, prediction, realResult, user } from "@/db/schema";
import { groupDiffs, scoreDiffs } from "@/lib/tournament/compare";
import type {
  MatchInfo,
  Prediction,
  RealResult,
  TeamInfo,
} from "@/lib/tournament/types";

export async function loadTeams(): Promise<TeamInfo[]> {
  const rows = await db.select().from(team);
  return rows.map((t) => ({ id: t.id, name: t.name, groupCode: t.groupCode }));
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
  const rows = await db
    .select()
    .from(prediction)
    .where(eq(prediction.userId, userId));
  return rows.map((p) => ({
    matchId: p.matchId,
    homeScore: p.homeScore,
    awayScore: p.awayScore,
    penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
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
    finished: r.finished,
  }));
}

export type LeaderboardEntry = {
  userId: string;
  name: string;
  /** Punti totali (vedi POINTS in compare.ts). */
  points: number;
  /** Esiti (1/X/2) azzeccati, inclusi i punteggi esatti. */
  correctResults: number;
  /** Punteggi esatti. */
  exactScores: number;
  /** Partite confrontate per l'utente (con risultato reale e pronostico). */
  played: number;
};

/**
 * Classifica giocatori: per ogni utente, quanti esiti e punteggi ha azzeccato
 * sulle partite con un Risultato reale. Confronto solo sui Gironi (stesse
 * squadre), come la Differenza di livello A. Visibile a tutti i loggati.
 */
export async function loadLeaderboard(): Promise<LeaderboardEntry[]> {
  const [users, allPreds, reals, matches] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user),
    db.select().from(prediction),
    loadRealResults(),
    loadMatches(),
  ]);

  const realMap = new Map(
    reals.filter((r) => r.finished).map((r) => [r.matchId, r]),
  );

  const byUser = new Map<string, Map<string, Prediction>>();
  for (const p of allPreds) {
    let m = byUser.get(p.userId);
    if (!m) {
      m = new Map();
      byUser.set(p.userId, m);
    }
    m.set(p.matchId, {
      matchId: p.matchId,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      penaltyWinner: (p.penaltyWinner as "home" | "away" | null) ?? null,
    });
  }

  return users
    .map((u) => {
      const preds = byUser.get(u.id) ?? new Map<string, Prediction>();
      const s = scoreDiffs(groupDiffs(matches, preds, realMap));
      return {
        userId: u.id,
        name: u.name,
        points: s.points,
        correctResults: s.correctResults,
        exactScores: s.exactScores,
        played: s.totalCompared,
      };
    })
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.exactScores - a.exactScores ||
        a.name.localeCompare(b.name),
    );
}
