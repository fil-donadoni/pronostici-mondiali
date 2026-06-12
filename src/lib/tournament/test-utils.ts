import type { GroupCode } from "./structure";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    StandingRow,
    TeamInfo,
} from "./types";

export const team = (id: string, groupCode: GroupCode): TeamInfo => ({
    id,
    name: id,
    groupCode,
});

export const groupMatch = (
    id: string,
    groupCode: GroupCode,
    homeTeamId: string,
    awayTeamId: string,
    matchNumber: number
): MatchInfo => ({
    id,
    stage: "GROUP",
    groupCode,
    matchNumber,
    kickoff: null,
    homeTeamId,
    awayTeamId,
    homeSlot: null,
    awaySlot: null,
});

export const pred = (
    matchId: string,
    homeScore: number,
    awayScore: number,
    penaltyWinner: "home" | "away" | null = null
): Prediction => ({ matchId, homeScore, awayScore, penaltyWinner });

export const real = (
    matchId: string,
    homeScore: number,
    awayScore: number,
    finished = true,
    homeTeamId: string | null = null,
    awayTeamId: string | null = null
): RealResult => ({
    matchId,
    homeScore,
    awayScore,
    homeTeamId,
    awayTeamId,
    finished,
});

/** StandingRow minimale: conta solo teamId/rank per i test del bracket. */
export const row = (
    teamId: string,
    overrides: Partial<StandingRow> = {}
): StandingRow => ({
    teamId,
    played: 1,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    rank: 0,
    ...overrides,
});

export const predMap = (...ps: Prediction[]) =>
    new Map(ps.map((p) => [p.matchId, p]));

export const realMap = (...rs: RealResult[]) =>
    new Map(rs.map((r) => [r.matchId, r]));
