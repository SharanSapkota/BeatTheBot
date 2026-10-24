import type { GameDetail } from "@voita_kone/shared_types";
import { useEffect, type CSSProperties } from "react";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { format_short_countdown } from "../../lib/format";
import { side_schema, type GamePicks } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { useNow } from "../../lib/use_now";
import { during_copy } from "./copy";
import styles from "./next_goal_pick.module.css";

/** The pick window: 2 minutes from when the pick opened (first shown after a goal). */
export const NEXT_GOAL_WINDOW_MS = 2 * 60 * 1000;

interface NextGoalPickProps {
  game: GameDetail;
  goal_count: number;
  picks: GamePicks;
  update: (change: (picks: GamePicks) => GamePicks) => void;
}

export function NextGoalPick({ game, goal_count, picks, update }: NextGoalPickProps) {
  const now = useNow();
  const key = String(goal_count);
  const opened_at = picks.next_goal_opened_at[key];

  // A new pick opens after every goal: remember when this one was first shown.
  useEffect(() => {
    if (opened_at === undefined) {
      update((current) => ({
        ...current,
        next_goal_opened_at: { ...current.next_goal_opened_at, [key]: new Date().toISOString() },
      }));
    }
  }, [opened_at, key, update]);

  const remaining_ms = opened_at
    ? new Date(opened_at).getTime() + NEXT_GOAL_WINDOW_MS - now.getTime()
    : NEXT_GOAL_WINDOW_MS;
  const is_open = remaining_ms > 0;
  const progress: CSSProperties = {
    width: `${String(Math.max(0, Math.min(1, remaining_ms / NEXT_GOAL_WINDOW_MS)) * 100)}%`,
  };
  const current_pick = picks.next_goal_picks.find((pick) => pick.goal_index === goal_count);

  const choose = (choice_id: string) => {
    const choice = side_schema.parse(choice_id);
    update((current) => ({
      ...current,
      next_goal_picks: [
        ...current.next_goal_picks.filter((pick) => pick.goal_index !== goal_count),
        { goal_index: goal_count, choice },
      ],
    }));
  };

  return (
    <Card accent="you">
      <SectionTitle
        title={during_copy.next_goal_title}
        align="center"
        right={<PointsBadge text={`+${String(POINTS.next_goal)}`} />}
      />
      <div className={styles.timer}>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={progress} />
        </div>
        <span className={styles.closes} role="timer">
          {is_open
            ? during_copy.closes_in(format_short_countdown(remaining_ms))
            : during_copy.closed}
        </span>
      </div>
      <ChoiceButtons
        label={during_copy.next_goal_group}
        size="medium"
        choices={[
          { id: "home", label: game.home_team.name },
          { id: "away", label: game.away_team.name },
          { id: "none", label: during_copy.no_more_goals },
        ]}
        selected_id={current_pick?.choice ?? null}
        on_select={choose}
        disabled={!is_open}
      />
      <p className={styles.note}>{during_copy.next_goal_note}</p>
    </Card>
  );
}
