"use client";

import { useApp } from "@/lib/app-context";
import { BracketTab } from "@/components/bracket-tab";

export function BracketView() {
  const { teamMap, matches, predictions, bracket, savePrediction } = useApp();
  return (
    <BracketTab
      teamMap={teamMap}
      matches={matches}
      predictions={predictions}
      bracket={bracket}
      savePrediction={savePrediction}
    />
  );
}
