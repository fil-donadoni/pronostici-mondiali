"use client";

import { useApp } from "@/lib/app-context";
import { GroupsTab } from "@/components/groups-tab";

export function GroupsView() {
    const { teamMap, matches, predictions, standings, savePrediction } =
        useApp();
    return (
        <GroupsTab
            teamMap={teamMap}
            matches={matches}
            predictions={predictions}
            standings={standings}
            savePrediction={savePrediction}
        />
    );
}
