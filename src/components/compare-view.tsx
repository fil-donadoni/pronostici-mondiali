"use client";

import { useApp } from "@/lib/app-context";
import { CompareTab } from "@/components/compare-tab";

export function CompareView() {
    const { teamMap, matches, predictions, realResults, predictedReaching } =
        useApp();
    return (
        <CompareTab
            teamMap={teamMap}
            matches={matches}
            predictions={predictions}
            realResults={realResults}
            predictedReaching={predictedReaching}
        />
    );
}
