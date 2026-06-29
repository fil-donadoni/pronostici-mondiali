"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { groupDiffs, roundSetDiffs, summarize } from "@/lib/tournament/compare";
import type { GroupDiff } from "@/lib/tournament/compare";
import { teamsReachingStage } from "@/lib/tournament/engine";
import { resolveRealBracket } from "@/lib/tournament/real-bracket";
import {
    GROUP_CODES,
    KNOCKOUT_MATCHES,
    STAGE_LABEL,
    type Stage,
} from "@/lib/tournament/structure";
import type {
    MatchInfo,
    Prediction,
    RealResult,
    TeamInfo,
} from "@/lib/tournament/types";

// Ordine dei turni del tabellone (THIRD = finale 3°/4° prima della Finale).
const KO_STAGES: Stage[] = ["R32", "R16", "QF", "SF", "THIRD", "FINAL"];

type Tone = "ok" | "warn" | "bad" | "neutral";

// Listener per chiave: una modifica locale notifica gli hook montati (lo
// "storage" event nativo scatta solo cross-tab, non nella stessa pagina).
const collapseListeners = new Map<string, Set<() => void>>();

function readCollapsed(key: string, initial: boolean): boolean {
    const v = window.localStorage.getItem(key);
    return v === null ? initial : v === "1";
}

/**
 * Stato collassato persistito in localStorage (chiave per box). Via
 * useSyncExternalStore: lo snapshot server è sempre `initial`, quindi
 * l'hydration combacia; il valore salvato compare subito dopo il mount.
 */
function useCollapsed(key: string, initial = false) {
    const subscribe = useCallback(
        (cb: () => void) => {
            let set = collapseListeners.get(key);
            if (!set) {
                set = new Set();
                collapseListeners.set(key, set);
            }
            set.add(cb);
            return () => set!.delete(cb);
        },
        [key]
    );
    const collapsed = useSyncExternalStore(
        subscribe,
        () => readCollapsed(key, initial),
        () => initial
    );
    const setCollapsed = useCallback(
        (updater: boolean | ((prev: boolean) => boolean)) => {
            const cur = readCollapsed(key, initial);
            const next = typeof updater === "function" ? updater(cur) : updater;
            try {
                window.localStorage.setItem(key, next ? "1" : "0");
            } catch {
                // localStorage non disponibile: niente persistenza.
            }
            collapseListeners.get(key)?.forEach((l) => l());
        },
        [key, initial]
    );
    return [collapsed, setCollapsed] as const;
}

export function CompareTab({
    teamMap,
    teams,
    matches,
    predictions,
    phase2Predictions,
    realResults,
    predictedReaching,
}: {
    teamMap: Map<string, TeamInfo>;
    teams: TeamInfo[];
    matches: MatchInfo[];
    predictions: Map<string, Prediction>;
    phase2Predictions: Map<string, Prediction>;
    realResults: Map<string, RealResult>;
    predictedReaching: Record<string, string[]>;
}) {
    const name = (id: string | null | undefined) =>
        id ? (teamMap.get(id)?.name ?? id) : "—";

    const diffs = useMemo(
        () => groupDiffs(matches, predictions, realResults),
        [matches, predictions, realResults]
    );

    const matchById = useMemo(
        () => new Map(matches.map((m) => [m.id, m])),
        [matches]
    );

    // Differenze gironi raggruppate per Girone, ordinate per numero partita.
    const diffsByGroup = useMemo(() => {
        const map = new Map<string, GroupDiff[]>();
        for (const d of diffs) {
            const g = matchById.get(d.matchId)?.groupCode ?? "?";
            const arr = map.get(g) ?? [];
            arr.push(d);
            map.set(g, arr);
        }
        for (const arr of map.values()) {
            arr.sort(
                (a, b) =>
                    (matchById.get(a.matchId)?.matchNumber ?? 0) -
                    (matchById.get(b.matchId)?.matchNumber ?? 0)
            );
        }
        return map;
    }, [diffs, matchById]);

    // Tabellone (set-based): insiemi di squadre per turno, previsto vs reale.
    // Le squadre reali del turno derivano dalle Classifiche reali dei Gironi +
    // chi-passa salvato (real-bracket), NON solo dalle partite knockout finite.
    // `eliminated` = squadre realmente FUORI: perdenti di un knockout reale
    // concluso + escluse dai Gironi (a gironi completi). Serve a distinguere una
    // previsione sbagliata (rosso) da una ancora indecisa (grigio).
    const { realReach, eliminated } = useMemo(() => {
        const rr = [...realResults.values()];
        const realBracket = resolveRealBracket(teams, matches, rr);
        const reach = teamsReachingStage(realBracket);
        const elim = new Set<string>();
        for (const k of realBracket.values()) {
            if (k.loserId) elim.add(k.loserId);
        }
        // Gironi completi -> chi non è tra le 32 qualificate è eliminato.
        const r32 = new Set(reach["R32"] ?? []);
        if (r32.size >= 32) {
            for (const t of teams) if (!r32.has(t.id)) elim.add(t.id);
        }
        return { realReach: reach, eliminated: elim };
    }, [teams, matches, realResults]);
    const rounds = useMemo(
        () => roundSetDiffs(predictedReaching, realReach),
        [predictedReaching, realReach]
    );

    // Tabellone partita per partita: per ogni slot R32-N/..., il tuo punteggio
    // previsto per quello slot contro il risultato reale di QUELLA partita
    // (squadre reali). Stessa UI dei Gironi, divisa per fase. Solo le partite con
    // previsione e risultato reale. Pari nel knockout -> chi passa ai rigori.
    const koPhases = useMemo(() => {
        const side = (
            home: number,
            away: number,
            tieWinner: "home" | "away" | null
        ): "home" | "away" | null =>
            home > away ? "home" : away > home ? "away" : tieWinner;

        return KO_STAGES.map((stage) => {
            const items = KNOCKOUT_MATCHES.filter((m) => m.stage === stage)
                .map((km) => {
                    // Confronto del Tabellone reale: la previsione è quella di
                    // Fase 2 sullo slot reale, NON il bracket previsto in Fase 1.
                    const p = phase2Predictions.get(km.id);
                    const r = realResults.get(km.id);
                    if (!p || !r || !r.finished) return null;

                    const predScore = { home: p.homeScore, away: p.awayScore };
                    const realScore = { home: r.homeScore, away: r.awayScore };
                    const predSide = side(
                        p.homeScore,
                        p.awayScore,
                        p.penaltyWinner ?? null
                    );
                    const realSide = side(
                        r.homeScore,
                        r.awayScore,
                        r.advancerTeamId === r.homeTeamId
                            ? "home"
                            : r.advancerTeamId === r.awayTeamId
                              ? "away"
                              : null
                    );
                    const sameScore =
                        p.homeScore === r.homeScore &&
                        p.awayScore === r.awayScore;
                    const tone: Tone =
                        sameScore && predSide === realSide
                            ? "ok"
                            : predSide !== null && predSide === realSide
                              ? "warn"
                              : "bad";

                    const homeName = name(r.homeTeamId);
                    const awayName = name(r.awayTeamId);
                    const sideName = (s: "home" | "away" | null) =>
                        s === "home"
                            ? homeName
                            : s === "away"
                              ? awayName
                              : null;
                    // Rigori da mostrare solo se una delle due partite è un pari.
                    const penalty =
                        p.homeScore === p.awayScore ||
                        r.homeScore === r.awayScore
                            ? {
                                  pred: sideName(predSide),
                                  real: sideName(realSide),
                              }
                            : null;

                    return {
                        id: km.id,
                        homeName,
                        awayName,
                        predScore,
                        realScore,
                        tone,
                        penalty,
                    };
                })
                .filter((i) => i !== null);
            return { stage, items };
        }).filter((s) => s.items.length > 0);
    }, [phase2Predictions, realResults, teamMap]); // eslint-disable-line react-hooks/exhaustive-deps

    // Riepilogo: Gironi + Tabellone insieme. I toni del knockout mappano su
    // esatto (ok) / esito giusto (warn) / sbagliata (bad).
    const summary = useMemo(() => {
        const base = summarize(diffs);
        let { exact, correctOutcome, wrong, totalCompared } = base;
        for (const s of koPhases) {
            for (const i of s.items) {
                totalCompared++;
                if (i.tone === "ok") exact++;
                else if (i.tone === "warn") correctOutcome++;
                else wrong++;
            }
        }
        return { totalCompared, exact, correctOutcome, wrong };
    }, [diffs, koPhases]);

    const [gironiCollapsed, setGironiCollapsed] =
        useCollapsed("confronto:gironi");
    const [tabelloneCollapsed, setTabelloneCollapsed] = useCollapsed(
        "confronto:tabellone"
    );
    const [partiteCollapsed, setPartiteCollapsed] = useCollapsed(
        "confronto:tabellone-partite"
    );

    if (realResults.size === 0) {
        return (
            <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                    Nessun risultato reale ancora. Premi{" "}
                    <span className="font-medium text-foreground">
                        Sync risultati
                    </span>{" "}
                    in alto per scaricarli e confrontarli con i tuoi pronostici.
                </CardContent>
            </Card>
        );
    }

    const orderedGroups = GROUP_CODES.filter((g) => diffsByGroup.has(g));

    return (
        <div className="space-y-6">
            {/* Riepilogo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Confrontate" value={summary.totalCompared} />
                <StatCard
                    label="Risultato esatto"
                    value={summary.exact}
                    total={summary.totalCompared}
                    tone="ok"
                />
                <StatCard
                    label="Esito giusto"
                    value={summary.correctOutcome}
                    total={summary.totalCompared}
                    tone="warn"
                />
                <StatCard
                    label="Sbagliate"
                    value={summary.wrong}
                    total={summary.totalCompared}
                    tone="bad"
                />
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <LegendItem tone="ok" text="Risultato esatto" />
                <LegendItem tone="warn" text="Esito giusto" />
                <LegendItem tone="bad" text="Sbagliata" />
            </div>

            {/* Box Tabellone partita per partita (collassabile) */}
            <Card>
                <CollapsibleHeader
                    title="Tabellone partita per partita"
                    collapsed={partiteCollapsed}
                    onToggle={() => setPartiteCollapsed((c) => !c)}
                />
                {!partiteCollapsed && (
                    <CardContent className="space-y-5">
                        <p className="text-xs text-muted-foreground">
                            Il tuo punteggio previsto per ogni partita del
                            tabellone contro il risultato reale di quella
                            partita. Sui pareggi è indicato chi passa ai rigori.
                        </p>
                        {koPhases.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                Ancora nessuna partita del tabellone con
                                previsione e risultato reale.
                            </p>
                        )}
                        {koPhases.map((s) => (
                            <div key={s.stage}>
                                <h3 className="text-sm font-semibold mb-2">
                                    {STAGE_LABEL[s.stage]}
                                </h3>
                                <div className="space-y-1 pl-1">
                                    <GroupDiffHeader />
                                    {s.items.map((i) => (
                                        <KnockoutDiffRow
                                            key={i.id}
                                            home={i.homeName}
                                            away={i.awayName}
                                            predScore={i.predScore}
                                            realScore={i.realScore}
                                            tone={i.tone}
                                            penalty={i.penalty}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                )}
            </Card>

            {/* Box Tabellone (collassabile): squadre per turno, previsto vs reale */}
            <Card>
                <CollapsibleHeader
                    title="Squadre per turno: previsto vs reale"
                    collapsed={tabelloneCollapsed}
                    onToggle={() => setTabelloneCollapsed((c) => !c)}
                />
                {!tabelloneCollapsed && (
                    <CardContent className="space-y-5">
                        <p className="text-xs text-muted-foreground">
                            Le tue squadre previste a ogni turno. In{" "}
                            <span className="text-green-600 font-medium">
                                verde
                            </span>{" "}
                            quelle davvero arrivate, in{" "}
                            <span className="text-red-600 font-medium">
                                rosso
                            </span>{" "}
                            quelle già eliminate, in{" "}
                            <span className="opacity-50 font-medium">
                                grigio
                            </span>{" "}
                            quelle ancora in corsa (esito non deciso).
                        </p>
                        {rounds.map((r) => (
                            <RoundDiff
                                key={r.stage}
                                stageLabel={
                                    STAGE_LABEL[
                                        r.stage as keyof typeof STAGE_LABEL
                                    ] ?? r.stage
                                }
                                predicted={r.predicted}
                                onlyPredicted={r.onlyPredicted}
                                onlyReal={r.onlyReal}
                                hasReal={r.hasReal}
                                eliminated={eliminated}
                                name={name}
                            />
                        ))}
                    </CardContent>
                )}
            </Card>

            {/* Box Gironi (collassabile) */}
            <Card>
                <CollapsibleHeader
                    title="Differenze nei gironi"
                    collapsed={gironiCollapsed}
                    onToggle={() => setGironiCollapsed((c) => !c)}
                />
                {!gironiCollapsed && (
                    <CardContent className="space-y-5">
                        {orderedGroups.map((g) => (
                            <div key={g}>
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    Girone {g}
                                </h3>
                                <div className="space-y-1 pl-1">
                                    <GroupDiffHeader />
                                    {diffsByGroup.get(g)!.map((d) => {
                                        const m = matchById.get(d.matchId);
                                        return (
                                            <GroupDiffRow
                                                key={d.matchId}
                                                home={name(m?.homeTeamId)}
                                                away={name(m?.awayTeamId)}
                                                diff={d}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                )}
            </Card>
        </div>
    );
}

/** Confronto set-based di un turno: badge previsti colorati per match col reale. */
function RoundDiff({
    stageLabel,
    predicted,
    onlyPredicted,
    onlyReal,
    hasReal,
    eliminated,
    name,
}: {
    stageLabel: string;
    predicted: string[];
    onlyPredicted: string[];
    onlyReal: string[];
    hasReal: boolean;
    eliminated: Set<string>;
    name: (id: string | null | undefined) => string;
}) {
    const onlyPredSet = new Set(onlyPredicted);
    return (
        <div>
            <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm font-semibold">{stageLabel}</h3>
                {!hasReal && (
                    <Badge variant="outline" className="text-[10px]">
                        nessun dato reale
                    </Badge>
                )}
            </div>
            <div className="flex flex-wrap gap-1">
                {predicted.map((t) => {
                    // Arrivata davvero a questo turno -> verde. Altrimenti rossa
                    // solo se realmente eliminata; sennò grigia (ancora in corsa).
                    const matched = !onlyPredSet.has(t);
                    const isOut = eliminated.has(t);
                    return (
                        <Badge
                            key={t}
                            variant={
                                matched
                                    ? "default"
                                    : isOut
                                      ? "destructive"
                                      : "secondary"
                            }
                            className={`text-[11px] ${
                                !matched && !isOut ? "opacity-50" : ""
                            }`}
                        >
                            {name(t)}
                        </Badge>
                    );
                })}
            </div>
            {onlyReal.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                    Reali non previste:{" "}
                    {onlyReal.map((id) => name(id)).join(", ")}
                </p>
            )}
        </div>
    );
}

/**
 * Riga di una partita del tabellone, stessa UI dei Gironi: squadre reali della
 * partita, punteggio previsto vs reale. Su pareggio, riga rigori con chi passa.
 */
function KnockoutDiffRow({
    home,
    away,
    predScore,
    realScore,
    tone,
    penalty,
}: {
    home: string;
    away: string;
    predScore: { home: number; away: number };
    realScore: { home: number; away: number };
    tone: Tone;
    penalty: { pred: string | null; real: string | null } | null;
}) {
    return (
        <div className="py-1.5 border-b last:border-0">
            <div className="flex items-center gap-3 text-sm">
                <Dot tone={tone} />
                <span className="flex-1 text-right truncate">{home}</span>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="w-12 flex justify-center">
                        <ScoreChip
                            label=""
                            score={`${predScore.home}-${predScore.away}`}
                            variant="pred"
                        />
                    </span>
                    <span className="w-12 flex justify-center">
                        <ScoreChip
                            label=""
                            score={`${realScore.home}-${realScore.away}`}
                            variant="real"
                            tone={tone}
                        />
                    </span>
                </div>
                <span className="flex-1 truncate">{away}</span>
            </div>
            {penalty && (
                <div className="text-[11px] text-muted-foreground text-center mt-1">
                    Ai rigori — tua:{" "}
                    <span className="font-medium text-foreground">
                        {penalty.pred ?? "—"}
                    </span>{" "}
                    · reale:{" "}
                    <span className="font-medium text-foreground">
                        {penalty.real ?? "—"}
                    </span>
                </div>
            )}
        </div>
    );
}

function CollapsibleHeader({
    title,
    collapsed,
    onToggle,
}: {
    title: string;
    collapsed: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className="w-full flex items-center justify-between px-6 py-0 text-left cursor-pointer"
        >
            <span className="text-base font-semibold">{title}</span>
            <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                    collapsed ? "-rotate-90" : ""
                }`}
            />
        </button>
    );
}

/** Intestazioni di colonna allineate sopra le partite di un girone. */
function GroupDiffHeader() {
    return (
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground pb-1">
            <span className="w-2 shrink-0" />
            <span className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">
                <span className="w-12 text-center">Pron.</span>
                <span className="w-12 text-center">Reale</span>
            </div>
            <span className="flex-1" />
        </div>
    );
}

/** Riga di una partita dei gironi: stesse squadre, due punteggi affiancati. */
function GroupDiffRow({
    home,
    away,
    diff,
}: {
    home: string;
    away: string;
    diff: GroupDiff;
}) {
    const tone: Tone = diff.exactMatch
        ? "ok"
        : diff.outcomeMatch
          ? "warn"
          : "bad";
    return (
        <div className="flex items-center gap-3 text-sm py-1.5 border-b last:border-0">
            <Dot tone={tone} />
            <span className="flex-1 text-right truncate">{home}</span>
            <div className="flex items-center gap-2 shrink-0">
                <span className="w-12 flex justify-center">
                    <ScoreChip
                        label=""
                        score={`${diff.predicted.home}-${diff.predicted.away}`}
                        variant="pred"
                    />
                </span>
                <span className="w-12 flex justify-center">
                    <ScoreChip
                        label=""
                        score={`${diff.real.home}-${diff.real.away}`}
                        variant="real"
                        tone={tone}
                    />
                </span>
            </div>
            <span className="flex-1 truncate">{away}</span>
        </div>
    );
}

function ScoreChip({
    label,
    score,
    variant,
    tone,
}: {
    label: string;
    score: string;
    variant: "pred" | "real";
    tone?: Tone;
}) {
    const toneCls =
        variant === "real" && tone
            ? tone === "ok"
                ? "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
                : tone === "warn"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : tone === "bad"
                    ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
                    : "border-border bg-muted"
            : variant === "pred"
              ? "border-dashed border-border bg-muted/40 text-muted-foreground"
              : "border-border bg-muted";
    return (
        <span className="inline-flex items-center gap-1">
            {label && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                </span>
            )}
            <span
                className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold tabular-nums ${toneCls}`}
            >
                {score}
            </span>
        </span>
    );
}

function LegendItem({ tone, text }: { tone: Tone; text: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <Dot tone={tone} />
            {text}
        </span>
    );
}

function StatCard({
    label,
    value,
    total,
    tone,
}: {
    label: string;
    value: number;
    total?: number;
    tone?: Tone;
}) {
    const color =
        tone === "ok"
            ? "text-green-600"
            : tone === "warn"
              ? "text-amber-600"
              : tone === "bad"
                ? "text-red-600"
                : "";
    const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
    return (
        <Card>
            <CardContent className="py-4 text-center">
                <p className={`text-4xl font-bold tabular-nums ${color}`}>
                    {value}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
                {pct !== null && (
                    <p className="text-md font-semibold mt-1 tabular-nums text-muted-foreground">
                        {pct}%
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function Dot({ tone, className = "" }: { tone: Tone; className?: string }) {
    const color =
        tone === "ok"
            ? "bg-green-500"
            : tone === "warn"
              ? "bg-amber-500"
              : tone === "bad"
                ? "bg-red-500"
                : "bg-muted-foreground/40";
    return (
        <span
            className={`w-2 h-2 rounded-full shrink-0 ${color} ${className}`}
        />
    );
}
