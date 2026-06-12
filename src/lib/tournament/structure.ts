/**
 * Struttura STATICA UFFICIALE del torneo (FIFA World Cup 2026).
 *
 * - 12 Gironi (A..L), 4 squadre ciascuno.
 * - Knockout a 32: 24 piazzate (1ª/2ª di ogni girone) + 8 migliori terze.
 * - Schema R32 -> Finale 1:1 col bracket ufficiale FIFA (match 73..104).
 *   Fonte: regolamento FIFA / Wikipedia "2026 FIFA World Cup knockout stage".
 * - Le 8 terze sono assegnate agli slot via la tabella ufficiale a 495
 *   combinazioni (Annex C), vedi THIRD_PLACE_TABLE e l'engine. Ogni slot
 *   "third" sa quale 1ª affronta (facingWinner), così il lookup è esatto.
 */

export const GROUP_CODES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
] as const;
export type GroupCode = (typeof GROUP_CODES)[number];

export type Stage = "GROUP" | "R32" | "R16" | "QF" | "SF" | "THIRD" | "FINAL";

/** Uno slot del knockout: piazzamento di girone, terza, o vincente/perdente di una partita. */
export type Slot =
  | { kind: "winner-group"; group: GroupCode } // 1ª del girone
  | { kind: "runner-group"; group: GroupCode } // 2ª del girone
  | { kind: "third"; facingWinner: GroupCode } // terza assegnata via tabella FIFA, contro la 1ª di `facingWinner`
  | { kind: "winner-of"; matchId: string } // vincente di un'altra partita
  | { kind: "loser-of"; matchId: string }; // perdente (per la finale 3°/4° posto)

export type KnockoutMatch = {
  id: string;
  stage: Stage;
  matchNumber: number;
  home: Slot;
  away: Slot;
};

const W = (group: GroupCode): Slot => ({ kind: "winner-group", group });
const R = (group: GroupCode): Slot => ({ kind: "runner-group", group });
const T = (facingWinner: GroupCode): Slot => ({ kind: "third", facingWinner });
const win = (matchId: string): Slot => ({ kind: "winner-of", matchId });
const lose = (matchId: string): Slot => ({ kind: "loser-of", matchId });

// --- Round of 32: match ufficiali 73..88 (R32-1 = M73 ... R32-16 = M88) ---
// 8 slot "third" sui match con 1ª vs terza (vincenti A,B,D,E,G,I,K,L).
export const R32_SLOTS: KnockoutMatch[] = [
  { id: "R32-1",  stage: "R32", matchNumber: 73, home: R("A"), away: R("B") },
  { id: "R32-2",  stage: "R32", matchNumber: 74, home: W("E"), away: T("E") },
  { id: "R32-3",  stage: "R32", matchNumber: 75, home: W("F"), away: R("C") },
  { id: "R32-4",  stage: "R32", matchNumber: 76, home: W("C"), away: R("F") },
  { id: "R32-5",  stage: "R32", matchNumber: 77, home: W("I"), away: T("I") },
  { id: "R32-6",  stage: "R32", matchNumber: 78, home: R("E"), away: R("I") },
  { id: "R32-7",  stage: "R32", matchNumber: 79, home: W("A"), away: T("A") },
  { id: "R32-8",  stage: "R32", matchNumber: 80, home: W("L"), away: T("L") },
  { id: "R32-9",  stage: "R32", matchNumber: 81, home: W("D"), away: T("D") },
  { id: "R32-10", stage: "R32", matchNumber: 82, home: W("G"), away: T("G") },
  { id: "R32-11", stage: "R32", matchNumber: 83, home: R("K"), away: R("L") },
  { id: "R32-12", stage: "R32", matchNumber: 84, home: W("H"), away: R("J") },
  { id: "R32-13", stage: "R32", matchNumber: 85, home: W("B"), away: T("B") },
  { id: "R32-14", stage: "R32", matchNumber: 86, home: W("J"), away: R("H") },
  { id: "R32-15", stage: "R32", matchNumber: 87, home: W("K"), away: T("K") },
  { id: "R32-16", stage: "R32", matchNumber: 88, home: R("D"), away: R("G") },
];

// --- Round of 16: match ufficiali 89..96 ---
export const R16_SLOTS: KnockoutMatch[] = [
  { id: "R16-1", stage: "R16", matchNumber: 89, home: win("R32-2"),  away: win("R32-5") },
  { id: "R16-2", stage: "R16", matchNumber: 90, home: win("R32-1"),  away: win("R32-3") },
  { id: "R16-3", stage: "R16", matchNumber: 91, home: win("R32-4"),  away: win("R32-6") },
  { id: "R16-4", stage: "R16", matchNumber: 92, home: win("R32-7"),  away: win("R32-8") },
  { id: "R16-5", stage: "R16", matchNumber: 93, home: win("R32-11"), away: win("R32-12") },
  { id: "R16-6", stage: "R16", matchNumber: 94, home: win("R32-9"),  away: win("R32-10") },
  { id: "R16-7", stage: "R16", matchNumber: 95, home: win("R32-14"), away: win("R32-16") },
  { id: "R16-8", stage: "R16", matchNumber: 96, home: win("R32-13"), away: win("R32-15") },
];

// --- Quarti: match ufficiali 97..100 ---
export const QF_SLOTS: KnockoutMatch[] = [
  { id: "QF-1", stage: "QF", matchNumber: 97,  home: win("R16-1"), away: win("R16-2") },
  { id: "QF-2", stage: "QF", matchNumber: 98,  home: win("R16-5"), away: win("R16-6") },
  { id: "QF-3", stage: "QF", matchNumber: 99,  home: win("R16-3"), away: win("R16-4") },
  { id: "QF-4", stage: "QF", matchNumber: 100, home: win("R16-7"), away: win("R16-8") },
];

// --- Semifinali: 2 partite ---
export const SF_SLOTS: KnockoutMatch[] = [
  { id: "SF-1", stage: "SF", matchNumber: 101, home: win("QF-1"), away: win("QF-2") },
  { id: "SF-2", stage: "SF", matchNumber: 102, home: win("QF-3"), away: win("QF-4") },
];

// --- Finale 3°/4° posto + Finale ---
export const FINAL_SLOTS: KnockoutMatch[] = [
  { id: "THIRD", stage: "THIRD", matchNumber: 103, home: lose("SF-1"), away: lose("SF-2") },
  { id: "FINAL", stage: "FINAL", matchNumber: 104, home: win("SF-1"), away: win("SF-2") },
];

export const KNOCKOUT_MATCHES: KnockoutMatch[] = [
  ...R32_SLOTS,
  ...R16_SLOTS,
  ...QF_SLOTS,
  ...SF_SLOTS,
  ...FINAL_SLOTS,
];

export const STAGE_LABEL: Record<Stage, string> = {
  GROUP: "Gironi",
  R32: "Sedicesimi",
  R16: "Ottavi",
  QF: "Quarti",
  SF: "Semifinali",
  THIRD: "Finale 3°/4°",
  FINAL: "Finale",
};

export const KNOCKOUT_STAGE_ORDER: Stage[] = ["R32", "R16", "QF", "SF", "FINAL"];
