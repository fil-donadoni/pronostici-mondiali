import type { Stage } from "./structure";

export type TeamInfo = {
    id: string;
    name: string;
    groupCode: string;
};

export type MatchInfo = {
    id: string;
    stage: Stage;
    groupCode: string | null;
    matchNumber: number;
    kickoff: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeSlot: string | null;
    awaySlot: string | null;
};

export type Prediction = {
    matchId: string;
    homeScore: number;
    awayScore: number;
    penaltyWinner: "home" | "away" | null;
};

/** Modifica parziale di un Pronostico salvata dalla UI. */
export type PredictionPatch = {
    homeScore: number;
    awayScore: number;
    penaltyWinner?: "home" | "away" | null;
};

export type RealResult = {
    matchId: string;
    homeScore: number;
    awayScore: number;
    homeTeamId: string | null;
    awayTeamId: string | null;
    finished: boolean;
};

export type StandingRow = {
    teamId: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
    rank: number; // 1..4 nel girone
};

/** Esito risolto di una partita knockout dopo la propagazione. */
export type ResolvedKnockout = {
    matchId: string;
    homeTeamId: string | null; // null finché lo slot non è determinato
    awayTeamId: string | null;
    winnerId: string | null;
    loserId: string | null;
};
