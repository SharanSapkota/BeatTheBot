import type { LeaderboardPeriod } from "@voita_kone/shared_types";
import { leaderboard_copy } from "./copy";
import { SegmentTabs } from "../../components/segment_tabs";

interface PeriodTabsProps {
  period: LeaderboardPeriod;
  on_change: (period: LeaderboardPeriod) => void;
}

/** This week / Season. */
export function PeriodTabs({ period, on_change }: PeriodTabsProps) {
  return (
    <SegmentTabs
      label={leaderboard_copy.period_group}
      tabs={leaderboard_copy.periods}
      selected={period}
      on_change={on_change}
    />
  );
}
