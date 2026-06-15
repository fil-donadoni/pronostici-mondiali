"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreInput } from "@/components/score-input";
import {
    allGroupsFilled,
    isBracketPhase1Locked,
    isMatchLocked,
} from "@/lib/match-lock";
import { Shield } from "lucide-react";
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

type BracketProps = {
    teamMap: Map<string, TeamInfo>;
    matches: MatchInfo[];
    predictions: Map<string, Prediction>;
    bracket: Map<string, ResolvedKnockout>;
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
};

// Le viste interne ricevono anche lo stato di freeze della Fase 1.
type BracketViewProps = BracketProps & { phase1Locked: boolean };

export function BracketTab(props: BracketProps) {
    const champ = props.bracket.get("FINAL")?.winnerId;
    // A torneo iniziato il bracket previsto (Fase 1) è congelato (ADR 0003),
    // SALVO la finestra di grazia: chi ha già compilato tutti i Gironi può
    // ancora completare il Tabellone fino alla scadenza (vedi match-lock.ts).
    const groupMatchIds = props.matches
        .filter((m) => m.stage === "GROUP")
        .map((m) => m.id);
    const groupsFilled = allGroupsFilled(
        groupMatchIds,
        new Set(props.predictions.keys())
    );
    const phase1Locked = isBracketPhase1Locked(
        props.matches.map((m) => m.kickoff),
        groupsFilled
    );

    return (
        <div className="space-y-4">
            {champ && (
                <Card>
                    <CardContent className="py-4 text-center">
                        <p className="text-sm text-muted-foreground">
                            Campione del mondo previsto
                        </p>
                        <p className="text-xl font-bold">
                            {props.teamMap.get(champ)?.name ?? champ}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Mobile: pager a un turno per schermata, con tab e snap. */}
            <BracketPager {...props} phase1Locked={phase1Locked} />

            {/* Desktop: albero completo con connettori. */}
            <BracketTree {...props} phase1Locked={phase1Locked} />
        </div>
    );
}

// Etichette estese per le tab dei turni (stile LiveScore).
const TAB_LABEL: Record<Stage, string> = {
    GROUP: "Gironi",
    R32: "Sedicesimi di finale",
    R16: "Ottavi di finale",
    QF: "Quarti di finale",
    SF: "Semifinali",
    THIRD: "Finale 3°/4°",
    FINAL: "Finale",
};

// --- Geometria mobile (px) ---
const M_ML = 14; // margine sinistro della card dentro la colonna
const M_GUT = 52; // spazio a destra per i connettori a gomito

/** Formatta il kickoff in "30 giu" + "03:00" (locale it-IT). */
function fmtKickoff(iso: string | null | undefined) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return {
        date: d.toLocaleDateString("it-IT", { day: "numeric", month: "short" }),
        time: d.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
        }),
    };
}

/**
 * Vista mobile in stile LiveScore. Canvas unico scrollabile in orizzontale: ogni
 * turno è una colonna a piena larghezza con snap. Il turno attivo mostra le card
 * piene; gli altri collassano in box-scheletro vuoti che lasciano leggere la
 * struttura del tabellone. I connettori a gomito tra le colonne (e il loro
 * "bleed" ai bordi) danno la continuità dell'albero.
 */
function BracketPager({
    teamMap,
    matches,
    predictions,
    bracket,
    savePrediction,
    phase1Locked,
}: BracketViewProps) {
    const slotLabel = (id: string, side: "home" | "away") => {
        const m = matches.find((x) => x.id === id);
        return side === "home" ? m?.homeSlot : m?.awaySlot;
    };
    const kickoffOf = (id: string) =>
        matches.find((x) => x.id === id)?.kickoff ?? null;

    const colOf = (stage: Stage) =>
        stage === "THIRD" ? COLUMNS.indexOf("FINAL") : COLUMNS.indexOf(stage);

    const scrollRef = useRef<HTMLDivElement>(null);
    const cardRefs = useRef(new Map<string, HTMLDivElement | null>());
    const [cw, setCw] = useState(360); // larghezza colonna = larghezza viewport
    const [activeIndex, setActiveIndex] = useState(0);

    // Misura la larghezza della colonna (= contenitore) e la tiene aggiornata.
    useIsoLayoutEffect(() => {
        const root = scrollRef.current;
        if (!root) return;
        const measure = () => {
            const w = root.clientWidth;
            if (w > 0) setCw(w);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(root);
        return () => ro.disconnect();
    }, []);

    // Layout verticale: centri delle partite dalle altezze reali delle card.
    const [layout, setLayout] = useState(() => computeCenters(() => EST_H));
    useIsoLayoutEffect(() => {
        const heightOf = (id: string) =>
            cardRefs.current.get(id)?.offsetHeight ?? EST_H;
        const next = computeCenters(heightOf);
        setLayout((prev) => {
            if (
                prev.totalH === next.totalH &&
                prev.centers.size === next.centers.size &&
                [...next.centers].every(([k, v]) => prev.centers.get(k) === v)
            ) {
                return prev;
            }
            return next;
        });
    }, [predictions, bracket, teamMap, cw]);

    const { centers, totalH } = layout;
    const centerY = (id: string) => centers.get(id) ?? HEADER_H;

    const cardW = Math.max(0, cw - M_ML - M_GUT);
    const totalW = COLUMNS.length * cw;

    // Connettori a gomito tra colonne (feeder -> partita successiva).
    const connectors: { d: string; dashed: boolean }[] = [];
    for (const m of KNOCKOUT_MATCHES) {
        const feeders =
            m.id === "THIRD"
                ? ["SF-1", "SF-2"]
                : [m.home, m.away]
                      .filter((s) => s.kind === "winner-of")
                      .map((s) => (s as { matchId: string }).matchId);
        if (!feeders.length) continue;
        const px = colOf(m.stage) * cw + M_ML; // bordo sinistro della partita
        const py = centerY(m.id);
        for (const f of feeders) {
            const childStage = KNOCKOUT_MATCHES.find((x) => x.id === f)!.stage;
            const cx = colOf(childStage) * cw + M_ML + cardW; // bordo destro feeder
            const cy = centerY(f);
            const midX = m.id === "THIRD" ? cx + M_GUT / 2 : (cx + px) / 2;
            connectors.push({
                d: `M ${cx} ${cy} H ${midX} V ${py} H ${px}`,
                dashed: m.id === "THIRD",
            });
        }
    }

    const goTo = (i: number) => {
        scrollRef.current?.scrollTo({ left: i * cw, behavior: "smooth" });
        setActiveIndex(i);
    };
    const onScroll = () => {
        const root = scrollRef.current;
        if (!root || !cw) return;
        const i = Math.min(
            COLUMNS.length - 1,
            Math.max(0, Math.round(root.scrollLeft / cw))
        );
        if (i !== activeIndex) setActiveIndex(i);
    };

    const cardMatches = KNOCKOUT_MATCHES.filter(
        (m) => m.stage === "THIRD" || COLUMNS.includes(m.stage)
    );

    return (
        <div className="md:hidden">
            {/* Tab dei turni: sticky subito sotto l'header dell'app. */}
            <div className="sticky top-[var(--app-header-h,65px)] z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-border/60 bg-background px-4 py-2">
                {COLUMNS.map((stage, i) => (
                    <button
                        key={stage}
                        type="button"
                        onClick={() => goTo(i)}
                        className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                            activeIndex === i
                                ? "bg-foreground text-background"
                                : "bg-muted text-muted-foreground"
                        }`}
                    >
                        {TAB_LABEL[stage]}
                    </button>
                ))}
            </div>

            {/* Canvas unico con snap orizzontale per colonna */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="-mx-4 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
            >
                <div
                    className="relative"
                    style={{ width: totalW, height: totalH }}
                >
                    {/* Connettori (dietro alle card) */}
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

                    {/* Punti di snap a piena larghezza, uno per turno */}
                    {COLUMNS.map((stage, i) => (
                        <div
                            key={stage}
                            className="absolute top-0 snap-start"
                            style={{ left: i * cw, width: cw, height: 1 }}
                        />
                    ))}

                    {/* Card partite, posizionate sull'albero */}
                    {cardMatches.map((m) => {
                        const i = colOf(m.stage);
                        return (
                            <div
                                key={m.id}
                                ref={(el) => {
                                    cardRefs.current.set(m.id, el);
                                }}
                                className="absolute -translate-y-1/2"
                                style={{
                                    left: i * cw + M_ML,
                                    top: centerY(m.id),
                                    width: cardW,
                                }}
                            >
                                <MobileKnockoutCard
                                    matchId={m.id}
                                    resolved={bracket.get(m.id)}
                                    prediction={predictions.get(m.id)}
                                    teamMap={teamMap}
                                    homeSlot={slotLabel(m.id, "home")}
                                    awaySlot={slotLabel(m.id, "away")}
                                    kickoff={kickoffOf(m.id)}
                                    topNote={
                                        m.id === "THIRD"
                                            ? "Finale 3°/4°"
                                            : undefined
                                    }
                                    dim={i !== activeIndex}
                                    savePrediction={savePrediction}
                                    phase1Locked={phase1Locked}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MobileKnockoutCard({
    matchId,
    resolved,
    prediction,
    teamMap,
    homeSlot,
    awaySlot,
    kickoff,
    topNote,
    dim,
    savePrediction,
    phase1Locked,
}: {
    matchId: string;
    resolved?: ResolvedKnockout;
    prediction?: Prediction;
    teamMap: Map<string, TeamInfo>;
    homeSlot?: string | null;
    awaySlot?: string | null;
    kickoff?: string | null;
    topNote?: string;
    dim: boolean;
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
    phase1Locked: boolean;
}) {
    const [home, setHome] = useState<number | "">(prediction?.homeScore ?? "");
    const [away, setAway] = useState<number | "">(prediction?.awayScore ?? "");

    // Mantiene lo stato locale allineato al pronostico salvato: l'altra vista
    // (mobile/desktop) resta montata e deve riflettere le modifiche reciproche.
    // Aggiornamento durante il render (pattern React per stato derivato dai prop).
    const ph = prediction?.homeScore ?? null;
    const pa = prediction?.awayScore ?? null;
    const [synced, setSynced] = useState({ h: ph, a: pa });
    if (synced.h !== ph || synced.a !== pa) {
        setSynced({ h: ph, a: pa });
        setHome(ph ?? "");
        setAway(pa ?? "");
    }

    const homeId = resolved?.homeTeamId ?? null;
    const awayId = resolved?.awayTeamId ?? null;
    const homeName = homeId
        ? (teamMap.get(homeId)?.name ?? homeId)
        : (homeSlot ?? "—");
    const awayName = awayId
        ? (teamMap.get(awayId)?.name ?? awayId)
        : (awaySlot ?? "—");

    const ready = homeId !== null && awayId !== null;
    const locked = phase1Locked || isMatchLocked(kickoff);
    const isDraw = home !== "" && away !== "" && home === away;
    const winnerId = resolved?.winnerId ?? null;
    const kd = fmtKickoff(kickoff);

    function commit(
        h: number | "",
        a: number | "",
        penalty?: "home" | "away" | null
    ) {
        if (locked) return;
        if (h === "" || a === "") return;
        savePrediction(matchId, {
            homeScore: h,
            awayScore: a,
            penaltyWinner:
                penalty !== undefined
                    ? penalty
                    : (prediction?.penaltyWinner ?? null),
        });
    }

    return (
        <Card
            className={`overflow-hidden py-0 ${dim ? "border-border/40 bg-card/30" : ""}`}
        >
            {/* Quando il turno non è attivo, il contenuto è nascosto ma occupa
                lo stesso spazio: la card diventa un box-scheletro e l'albero
                resta allineato. */}
            <div className={dim ? "invisible" : ""}>
                {topNote && (
                    <p className="px-3 pt-1.5 text-[10px] text-muted-foreground">
                        {topNote}
                    </p>
                )}
                <div className="flex items-stretch">
                    <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 py-2 text-center">
                        {kd ? (
                            <>
                                <span className="text-[11px] leading-tight text-muted-foreground">
                                    {kd.date}
                                </span>
                                <span className="text-sm leading-tight font-semibold">
                                    {kd.time}
                                </span>
                            </>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                —
                            </span>
                        )}
                    </div>
                    <div className="my-2 w-px shrink-0 bg-border" />
                    <div className="flex-1 space-y-1 p-2">
                        <MobileTeamRow
                            name={homeName}
                            score={home}
                            isWinner={winnerId !== null && winnerId === homeId}
                            disabled={!ready || dim || locked}
                            onChange={(v) => {
                                setHome(v);
                                commit(v, away);
                            }}
                            ariaLabel={`${homeName} gol`}
                        />
                        <MobileTeamRow
                            name={awayName}
                            score={away}
                            isWinner={winnerId !== null && winnerId === awayId}
                            disabled={!ready || dim || locked}
                            onChange={(v) => {
                                setAway(v);
                                commit(home, v);
                            }}
                            ariaLabel={`${awayName} gol`}
                        />

                        {isDraw && ready && (
                            <div className="flex items-center gap-1.5 pt-1">
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    Rig.:
                                </span>
                                <Button
                                    size="sm"
                                    disabled={locked}
                                    variant={
                                        prediction?.penaltyWinner === "home"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="h-6 min-w-0 flex-1 truncate px-2 text-xs whitespace-nowrap"
                                    onClick={() => commit(home, away, "home")}
                                >
                                    <span className="truncate">{homeName}</span>
                                </Button>
                                <Button
                                    size="sm"
                                    disabled={locked}
                                    variant={
                                        prediction?.penaltyWinner === "away"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="h-6 min-w-0 flex-1 truncate px-2 text-xs whitespace-nowrap"
                                    onClick={() => commit(home, away, "away")}
                                >
                                    <span className="truncate">{awayName}</span>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

function MobileTeamRow({
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
            <Shield className="size-4 shrink-0 text-muted-foreground" />
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

function BracketTree({
    teamMap,
    matches,
    predictions,
    bracket,
    savePrediction,
    phase1Locked,
}: BracketViewProps) {
    const slotLabel = (id: string, side: "home" | "away") => {
        const m = matches.find((x) => x.id === id);
        return side === "home" ? m?.homeSlot : m?.awaySlot;
    };
    const kickoffOf = (id: string) =>
        matches.find((x) => x.id === id)?.kickoff ?? null;

    const colOf = (stage: Stage) =>
        stage === "THIRD" ? COLUMNS.indexOf("FINAL") : COLUMNS.indexOf(stage);
    const totalW = colLeft(COLUMNS.length - 1) + COL_W;

    // Riferimenti alle card per misurarne l'altezza reale.
    const cardRefs = useRef(new Map<string, HTMLDivElement | null>());
    const containerRef = useRef<HTMLDivElement>(null);
    const [sizeTick, setSizeTick] = useState(0);

    // Layout misurato: parte da una stima, poi si corregge con le altezze reali.
    const [layout, setLayout] = useState(() => computeCenters(() => EST_H));

    // Ri-misura anche quando il contenitore cambia dimensione: rientrando da
    // mobile (era display:none) le card avevano altezza 0 e il layout restava
    // schiacciato finché qualcosa non lo ricalcolava.
    useIsoLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setSizeTick((t) => t + 1));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

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
    }, [predictions, bracket, teamMap, sizeTick]);

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
            KNOCKOUT_MATCHES.find((x) => x.id === feeders[0])!.stage
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
        <div
            ref={containerRef}
            className="hidden overflow-x-auto pb-4 md:block"
        >
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
                    (m) => m.stage !== "THIRD" && COLUMNS.includes(m.stage)
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
                            kickoff={kickoffOf(m.id)}
                            savePrediction={savePrediction}
                            phase1Locked={phase1Locked}
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
                        <p className="mb-1 text-xs text-muted-foreground">
                            Finale 3°/4°
                        </p>
                        <KnockoutCard
                            matchId="THIRD"
                            resolved={bracket.get("THIRD")}
                            prediction={predictions.get("THIRD")}
                            teamMap={teamMap}
                            homeSlot={slotLabel("THIRD", "home")}
                            awaySlot={slotLabel("THIRD", "away")}
                            kickoff={kickoffOf("THIRD")}
                            savePrediction={savePrediction}
                            phase1Locked={phase1Locked}
                        />
                    </div>
                )}
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
    kickoff,
    savePrediction,
    phase1Locked,
}: {
    matchId: string;
    resolved?: ResolvedKnockout;
    prediction?: Prediction;
    teamMap: Map<string, TeamInfo>;
    homeSlot?: string | null;
    awaySlot?: string | null;
    kickoff?: string | null;
    savePrediction: (matchId: string, patch: PredictionPatch) => void;
    phase1Locked: boolean;
}) {
    const [home, setHome] = useState<number | "">(prediction?.homeScore ?? "");
    const [away, setAway] = useState<number | "">(prediction?.awayScore ?? "");

    // Mantiene lo stato locale allineato al pronostico salvato: l'altra vista
    // (mobile/desktop) resta montata e deve riflettere le modifiche reciproche.
    // Aggiornamento durante il render (pattern React per stato derivato dai prop).
    const ph = prediction?.homeScore ?? null;
    const pa = prediction?.awayScore ?? null;
    const [synced, setSynced] = useState({ h: ph, a: pa });
    if (synced.h !== ph || synced.a !== pa) {
        setSynced({ h: ph, a: pa });
        setHome(ph ?? "");
        setAway(pa ?? "");
    }

    const homeId = resolved?.homeTeamId ?? null;
    const awayId = resolved?.awayTeamId ?? null;
    const homeName = homeId
        ? (teamMap.get(homeId)?.name ?? homeId)
        : (homeSlot ?? "—");
    const awayName = awayId
        ? (teamMap.get(awayId)?.name ?? awayId)
        : (awaySlot ?? "—");

    const ready = homeId !== null && awayId !== null;
    const locked = phase1Locked || isMatchLocked(kickoff);
    const isDraw = home !== "" && away !== "" && home === away;

    function commit(
        h: number | "",
        a: number | "",
        penalty?: "home" | "away" | null
    ) {
        if (locked) return;
        if (h === "" || a === "") return;
        savePrediction(matchId, {
            homeScore: h,
            awayScore: a,
            penaltyWinner:
                penalty !== undefined
                    ? penalty
                    : (prediction?.penaltyWinner ?? null),
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
                    disabled={!ready || locked}
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
                    disabled={!ready || locked}
                    onChange={(v) => {
                        setAway(v);
                        commit(home, v);
                    }}
                    ariaLabel={`${awayName} gol`}
                />

                {isDraw && ready && (
                    <div className="space-y-1.5 pt-1">
                        <p className="shrink-0 text-xs text-muted-foreground">
                            Rig.:
                        </p>
                        <Button
                            size="sm"
                            disabled={locked}
                            variant={
                                prediction?.penaltyWinner === "home"
                                    ? "default"
                                    : "outline"
                            }
                            className="h-6 min-w-0 flex-1 truncate whitespace-nowrap px-2 text-xs"
                            onClick={() => commit(home, away, "home")}
                        >
                            <span className="truncate">{homeName}</span>
                        </Button>
                        <Button
                            size="sm"
                            disabled={locked}
                            variant={
                                prediction?.penaltyWinner === "away"
                                    ? "default"
                                    : "outline"
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
