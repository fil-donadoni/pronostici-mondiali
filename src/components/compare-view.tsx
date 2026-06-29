"use client";

import { useApp } from "@/lib/app-context";
import { CompareTab } from "@/components/compare-tab";

export function CompareView() {
    const {
        teamMap,
        teams,
        matches,
        predictions,
        phase2Predictions,
        realResults,
        predictedReaching,
    } = useApp();
    return (
        <CompareTab
            teamMap={teamMap}
            teams={teams}
            matches={matches}
            predictions={predictions}
            phase2Predictions={phase2Predictions}
            realResults={realResults}
            predictedReaching={predictedReaching}
        />
    );
}
