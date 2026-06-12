"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  PredictionPatch,
  ResolvedKnockout,
  TeamInfo,
} from "@/lib/tournament/types";

const COLUMNS: Stage[] = ["R32", "R16", "QF", "SF", "FINAL"];

// --- Geometria del tabellone (px) ---
const COL_W = 236; // larghezza card / colonna
const GAP = 56; // spazio orizzontale per i connettori
const HEADER_H = 28; // banda etichette in cima
const V_GAP = 12; // spazio verticale minimo tra due card R32 adiacenti
const EST_H = 112; // altezza stimata di una card (solo per il primo paint)
const colLeft = (i: number) => i * (COL_W + GAP);

// Mappa figlio -> partite che lo alimentano (winner-of), per l'albero.
const FEEDERS = new Map<string, string[]>();
for (const m of KNOCKOUT_MATCHES) {
  const fs = [m.home, m.away]
    .filter((s) => s.kind === "winner-of")
    .map((s) => (s as { matchId: string }).matchId);
  if (fs.length) FEEDERS.set(m.id, fs);
}

/** Le partite R32 (foglie) dall'alto al basso, in ordine d'albero non incrociato. */
const LEAVES: string[] = (() => {
  const out: string[] = [];
  const walk = (id: string) => {
    const fs = FEEDERS.get(id);
    if (!fs) {
      out.push(id);
      return;
    }
    fs.forEach(walk);
  };
  walk("FINAL");
  return out;
})();

/**
 * Centro verticale (px) di ogni partita a partire dalle ALTEZZE REALI delle
 * card (parametro `heightOf`). Le foglie (R32) sono impilate con un gap minimo;
 * ogni partita interna sta a metà tra i suoi due feeder -> niente overlap né
 * spazio sprecato, qualunque sia l'altezza (es. con la riga Rigori).
 */
function computeCenters(heightOf: (id: string) => number): {
  centers: Map<string, number>;
  totalH: number;
} {
  const centers = new Map<string, number>();
  let top = HEADER_H;
  for (const id of LEAVES) {
    const h = heightOf(id);
    centers.set(id, top + h / 2);
    top += h + V_GAP;
  }
  const center = (id: string): number => {
    const cached = centers.get(id);
    if (cached !== undefined) return cached;
    const fs = FEEDERS.get(id)!;
    const v = fs.map(center).reduce((a, b) => a + b, 0) / fs.length;
    centers.set(id, v);
    return v;
  };
  for (const m of KNOCKOUT_MATCHES) if (m.stage !== "THIRD") center(m.id);

  // Finale 3°/4°: sotto la finale.
  const fc = center("FINAL");
  const thirdC = fc + heightOf("FINAL") / 2 + heightOf("THIRD") / 2 + 28;
  centers.set("THIRD", thirdC);

  const totalH = Math.max(top, thirdC + heightOf("THIRD") / 2) + 16;
  return { centers, totalH };
}

// useLayoutEffect lato client, useEffect lato server (evita warning SSR).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  const colOf = (stage: Stage) =>
    stage === "THIRD" ? COLUMNS.indexOf("FINAL") : COLUMNS.indexOf(stage);
  const totalW = colLeft(COLUMNS.length - 1) + COL_W;

  // Riferimenti alle card per misurarne l'altezza reale.
  const cardRefs = useRef(new Map<string, HTMLDivElement | null>());

  // Layout misurato: parte da una stima, poi si corregge con le altezze reali.
  const [layout, setLayout] = useState(() => computeCenters(() => EST_H));

  useIsoLayoutEffect(() => {
    const heightOf = (id: string) =>
      cardRefs.current.get(id)?.offsetHeight ?? EST_H;
    const next = computeCenters(heightOf);
    setLayout((prev) => {
      // evita re-render se nulla è cambiato
      if (
        prev.totalH === next.totalH &&
        prev.centers.size === next.centers.size &&
        [...next.centers].every(([k, v]) => prev.centers.get(k) === v)
      ) {
        return prev;
      }
      return next;
    });
    // ricalcola quando cambiano i pronostici (la riga Rigori varia l'altezza)
  }, [predictions, bracket, teamMap]);

  const { centers, totalH } = layout;
  const centerY = (matchId: string) => centers.get(matchId) ?? HEADER_H;

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
    const childCol = colOf(
      KNOCKOUT_MATCHES.find((x) => x.id === feeders[0])!.stage,
    );
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
            <p className="text-sm text-muted-foreground">
              Campione del mondo previsto
            </p>
            <p className="text-xl font-bold">
              {teamMap.get(champ)?.name ?? champ}
            </p>
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
              ref={(el) => {
                cardRefs.current.set(m.id, el);
              }}
              className="absolute -translate-y-1/2"
              style={{
                left: colLeft(colOf(m.stage)),
                top: centerY(m.id),
                width: COL_W,
              }}
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
          {centers.has("THIRD") && (
            <div
              ref={(el) => {
                cardRefs.current.set("THIRD", el);
              }}
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
  const homeName = homeId
    ? (teamMap.get(homeId)?.name ?? homeId)
    : (homeSlot ?? "—");
  const awayName = awayId
    ? (teamMap.get(awayId)?.name ?? awayId)
    : (awaySlot ?? "—");

  const ready = homeId !== null && awayId !== null;
  const isDraw = home !== "" && away !== "" && home === away;

  function commit(
    h: number | "",
    a: number | "",
    penalty?: "home" | "away" | null,
  ) {
    if (h === "" || a === "") return;
    savePrediction(matchId, {
      homeScore: h,
      awayScore: a,
      penaltyWinner:
        penalty !== undefined ? penalty : (prediction?.penaltyWinner ?? null),
    });
  }

  const winnerId = resolved?.winnerId ?? null;

  return (
    <Card className={ready ? "" : "opacity-60"}>
      <CardContent className="p-2 space-y-1">
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
          <div className="space-y-1.5 pt-1">
            <p className="shrink-0 text-xs text-muted-foreground">Rig.:</p>
            <Button
              size="sm"
              variant={
                prediction?.penaltyWinner === "home" ? "default" : "outline"
              }
              className="h-6 min-w-0 flex-1 truncate whitespace-nowrap px-2 text-xs"
              onClick={() => commit(home, away, "home")}
            >
              <span className="truncate">{homeName}</span>
            </Button>
            <Button
              size="sm"
              variant={
                prediction?.penaltyWinner === "away" ? "default" : "outline"
              }
              className="h-6 min-w-0 flex-1 truncate whitespace-nowrap px-2 text-xs"
              onClick={() => commit(home, away, "away")}
            >
              <span className="truncate">{awayName}</span>
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
      {isWinner && (
        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
          →
        </Badge>
      )}
      <ScoreInput
        value={score}
        ariaLabel={ariaLabel}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
