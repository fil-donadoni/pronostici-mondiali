import { eq } from "drizzle-orm";
import { db } from "@/db";
import { team, match, prediction, realResult } from "@/db/schema";
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
