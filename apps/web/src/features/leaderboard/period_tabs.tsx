import type { LeaderboardPeriod } from "@voita_kone/shared_types";
import type { KeyboardEvent } from "react";
import { class_names } from "../../lib/class_names";
import { leaderboard_copy } from "./copy";
import styles from "./period_tabs.module.css";

interface PeriodTabsProps {
  period: LeaderboardPeriod;
  on_change: (period: LeaderboardPeriod) => void;
}

/** This week / Season. Arrow keys move between the two tabs. */
export function PeriodTabs({ period, on_change }: PeriodTabsProps) {
  const on_key_down = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      on_change(period === "week" ? "season" : "week");
    }
  };
  return (
    <div
      role="tablist"
      aria-label={leaderboard_copy.period_group}
      className={styles.tabs}
      onKeyDown={on_key_down}
    >
      {leaderboard_copy.periods.map((tab) => {
        const is_selected = tab.id === period;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={is_selected}
            tabIndex={is_selected ? 0 : -1}
            className={class_names(styles.tab, is_selected && styles.selected)}
            onClick={() => on_change(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
