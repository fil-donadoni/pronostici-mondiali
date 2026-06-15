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
    /**
     * Istante ISO (UTC) dell'ultima modifica. Presente quando il Pronostico
     * arriva dal DB; assente per gli stati ottimistici lato client (match non
     * ancora bloccati -> mai "in ritardo"). Usato dal cap punti: una modifica
     * dopo il calcio d'inizio vale al massimo 1 punto (vedi compare.ts).
     */
    updatedAt?: string;
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
    /**
     * Squadra realmente avanzata al turno successivo (chi-passa), inclusi
     * supplementari e rigori. Valorizzata solo per il knockout concluso; null
     * per i Gironi o per partite non ancora decise. Verità per il Bonus e per
     * il punto "chi-passa" della Fase 2 (vedi docs/adr/0003).
     */
    advancerTeamId: string | null;
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
