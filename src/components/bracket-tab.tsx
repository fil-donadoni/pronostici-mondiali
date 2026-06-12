"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreInput } from "@/components/score-input";
import {
  KNOCKOUT_MATCHES,
  STAGE_LABEL,
  type Stage,
} from "@/lib/tournament/structure";
import type {
  MatchInfo,
  Prediction,
  ResolvedKnockout,
  TeamInfo,
} from "@/lib/tournament/types";
import type { PredictionPatch } from "@/components/dashboard";

const COLUMNS: Stage[] = ["R32", "R16", "QF", "SF", "FINAL"];

// --- Geometria del tabellone (px) ---
const COL_W = 236; // larghezza card / colonna
const GAP = 56; // spazio orizzontale per i connettori
const ROW_H = 108; // altezza dello slot verticale di una partita R32
const HEADER_H = 28; // banda etichette in cima
const colLeft = (i: number) => i * (COL_W + GAP);

/**
 * Posizione verticale (in unità-riga) di ogni partita seguendo l'albero
 * a partire dalla finale: i due feeder di una partita sono adiacenti e la
 * partita figlia sta esattamente a metà tra essi -> percorso non incrociato.
 */
function computeRows(): Map<string, number> {
  const feedersOf = new Map<string, string[]>();
  for (const m of KNOCKOUT_MATCHES) {
    const fs = [m.home, m.away]
      .filter((s) => s.kind === "winner-of")
      .map((s) => (s as { matchId: string }).matchId);
    if (fs.length) feedersOf.set(m.id, fs);
  }
  const row = new Map<string, number>();
  let leaf = 0;
  const assign = (id: string): number => {
    const fs = feedersOf.get(id);
    if (!fs || fs.length === 0) {
      const r = leaf++;
      row.set(id, r);
      return r;
    }
    const rs = fs.map(assign);
    const r = rs.reduce((a, b) => a + b, 0) / rs.length;
    row.set(id, r);
    return r;
  };
  assign("FINAL");
  // Finale 3°/4°: poco sotto la finale (perdenti delle semifinali).
  const finalRow = row.get("FINAL");
  if (finalRow !== undefined) row.set("THIRD", finalRow + 2.5);
  return row;
}

export function BracketTab({
  teamMap,
  matches,
  predictions,
  bracket,
  savePrediction,
}: {
  teamMap: Map<string, TeamInfo>;
  matches: MatchInfo[];
  predictions: Map<string, Prediction>;
  bracket: Map<string, ResolvedKnockout>;
  savePrediction: (matchId: string, patch: PredictionPatch) => void;
}) {
  const slotLabel = (id: string, side: "home" | "away") => {
    const m = matches.find((x) => x.id === id);
    return side === "home" ? m?.homeSlot : m?.awaySlot;
  };

  const champ = bracket.get("FINAL")?.winnerId;

  const rows = computeRows();
  const colOf = (stage: Stage) =>
    stage === "THIRD" ? COLUMNS.indexOf("FINAL") : COLUMNS.indexOf(stage);
  const centerY = (matchId: string) =>
    HEADER_H + (rows.get(matchId)! + 0.5) * ROW_H;
  const totalW = colLeft(COLUMNS.length - 1) + COL_W;
  const totalH = HEADER_H + 16 * ROW_H;

  // Connettori: per ogni partita, linea a gomito da ciascun feeder al suo centro.
  const connectors: { d: string; dashed: boolean }[] = [];
  for (const m of KNOCKOUT_MATCHES) {
    const feeders =
      m.id === "THIRD"
        ? ["SF-1", "SF-2"]
        : [m.home, m.away]
            .filter((s) => s.kind === "winner-of")
            .map((s) => (s as { matchId: string }).matchId);
    if (!feeders.length) continue;
    const childCol = colOf(KNOCKOUT_MATCHES.find((x) => x.id === feeders[0])!.stage);
    const px = colLeft(colOf(m.stage));
    const py = centerY(m.id);
    for (const f of feeders) {
      const cx = colLeft(childCol) + COL_W;
      const cy = centerY(f);
      const midX = m.id === "THIRD" ? cx + GAP / 2 : (cx + px) / 2;
      connectors.push({
        d: `M ${cx} ${cy} H ${midX} V ${py} H ${px}`,
        dashed: m.id === "THIRD",
      });
    }
  }

  return (
    <div className="space-y-4">
      {champ && (
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-muted-foreground">Campione del mondo previsto</p>
            <p className="text-xl font-bold">{teamMap.get(champ)?.name ?? champ}</p>
          </CardContent>
        </Card>
      )}

      <div className="overflow-x-auto pb-4">
        <div className="relative" style={{ width: totalW, height: totalH }}>
          {/* Connettori del percorso a eliminazione */}
          <svg
            className="pointer-events-none absolute inset-0 text-border"
            width={totalW}
            height={totalH}
          >
            {connectors.map((c, i) => (
              <path
                key={i}
                d={c.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray={c.dashed ? "4 4" : undefined}
              />
            ))}
          </svg>

          {/* Etichette colonne */}
          {COLUMNS.map((stage, i) => (
            <h3
              key={stage}
              className="absolute text-sm font-semibold text-muted-foreground"
              style={{ left: colLeft(i), top: 0, width: COL_W }}
            >
              {STAGE_LABEL[stage]}
            </h3>
          ))}

          {/* Card partite, centrate verticalmente sui due feeder */}
          {KNOCKOUT_MATCHES.filter(
            (m) => m.stage !== "THIRD" && COLUMNS.includes(m.stage),
          ).map((m) => (
            <div
              key={m.id}
              className="absolute -translate-y-1/2"
              style={{ left: colLeft(colOf(m.stage)), top: centerY(m.id), width: COL_W }}
            >
              <KnockoutCard
                matchId={m.id}
                resolved={bracket.get(m.id)}
                prediction={predictions.get(m.id)}
                teamMap={teamMap}
                homeSlot={slotLabel(m.id, "home")}
                awaySlot={slotLabel(m.id, "away")}
                savePrediction={savePrediction}
              />
            </div>
          ))}

          {/* Finale 3°/4° posto */}
          {rows.has("THIRD") && (
            <div
              className="absolute -translate-y-1/2"
              style={{
                left: colLeft(colOf("THIRD")),
                top: centerY("THIRD"),
                width: COL_W,
              }}
            >
              <p className="mb-1 text-xs text-muted-foreground">Finale 3°/4°</p>
              <KnockoutCard
                matchId="THIRD"
                resolved={bracket.get("THIRD")}
                prediction={predictions.get("THIRD")}
                teamMap={teamMap}
                homeSlot={slotLabel("THIRD", "home")}
                awaySlot={slotLabel("THIRD", "away")}
                savePrediction={savePrediction}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KnockoutCard({
  matchId,
  resolved,
  prediction,
  teamMap,
  homeSlot,
  awaySlot,
  savePrediction,
}: {
  matchId: string;
  resolved?: ResolvedKnockout;
  prediction?: Prediction;
  teamMap: Map<string, TeamInfo>;
  homeSlot?: string | null;
  awaySlot?: string | null;
  savePrediction: (matchId: string, patch: PredictionPatch) => void;
}) {
  const [home, setHome] = useState<number | "">(prediction?.homeScore ?? "");
  const [away, setAway] = useState<number | "">(prediction?.awayScore ?? "");

  const homeId = resolved?.homeTeamId ?? null;
  const awayId = resolved?.awayTeamId ?? null;
  const homeName = homeId ? (teamMap.get(homeId)?.name ?? homeId) : (homeSlot ?? "—");
  const awayName = awayId ? (teamMap.get(awayId)?.name ?? awayId) : (awaySlot ?? "—");

  const ready = homeId !== null && awayId !== null;
  const isDraw = home !== "" && away !== "" && home === away;

  function commit(h: number | "", a: number | "", penalty?: "home" | "away" | null) {
    if (h === "" || a === "") return;
    savePrediction(matchId, {
      homeScore: h,
      awayScore: a,
      penaltyWinner: penalty !== undefined ? penalty : prediction?.penaltyWinner ?? null,
    });
  }

  const winnerId = resolved?.winnerId ?? null;

  return (
    <Card className={ready ? "" : "opacity-60"}>
      <CardContent className="p-3 space-y-2">
        <TeamLine
          name={homeName}
          score={home}
          isWinner={winnerId !== null && winnerId === homeId}
          disabled={!ready}
          onChange={(v) => {
            setHome(v);
            commit(v, away);
          }}
          ariaLabel={`${homeName} gol`}
        />
        <TeamLine
          name={awayName}
          score={away}
          isWinner={winnerId !== null && winnerId === awayId}
          disabled={!ready}
          onChange={(v) => {
            setAway(v);
            commit(home, v);
          }}
          ariaLabel={`${awayName} gol`}
        />

        {isDraw && ready && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">Rigori:</span>
            <Button
              size="sm"
              variant={prediction?.penaltyWinner === "home" ? "default" : "outline"}
              className="h-6 text-xs px-2"
              onClick={() => commit(home, away, "home")}
            >
              {homeName}
            </Button>
            <Button
              size="sm"
              variant={prediction?.penaltyWinner === "away" ? "default" : "outline"}
              className="h-6 text-xs px-2"
              onClick={() => commit(home, away, "away")}
            >
              {awayName}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamLine({
  name,
  score,
  isWinner,
  disabled,
  onChange,
  ariaLabel,
}: {
  name: string;
  score: number | "";
  isWinner: boolean;
  disabled: boolean;
  onChange: (v: number | "") => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex-1 truncate text-sm ${isWinner ? "font-semibold" : ""}`}
      >
        {name}
      </span>
      {isWinner && <Badge variant="secondary" className="h-4 px-1 text-[10px]">→</Badge>}
      <ScoreInput value={score} ariaLabel={ariaLabel} onChange={onChange} />
    </div>
  );
}
