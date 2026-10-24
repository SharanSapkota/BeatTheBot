import type { Question } from "@voita_kone/shared_types";
import { Card } from "../../components/card";
import { ChoiceButtons } from "../../components/choice_buttons";
import { PointsBadge } from "../../components/points_badge";
import { SectionTitle } from "../../components/section_title";
import { format_period } from "../../lib/format";
import type { GamePicks } from "../../lib/picks";
import { POINTS } from "../../lib/points";
import { during_copy } from "./copy";
import styles from "./period_goal_pick.module.css";

/** The pick is always about the 3rd period and locks when it starts. */
export const PERIOD_GOAL_PERIOD = 3;

interface PeriodGoalPickProps {
  current_period: number | null;
  picks: GamePicks;
  /** Real games: the API's question (its lock); one answer only. */
  question: Question | undefined;
  /** False in demo replays: the pick stays on this device and can change. */
  is_saved: boolean;
  on_answer: (answer: string) => void;
}

export function PeriodGoalPick({
  current_period,
  picks,
  question,
  is_saved,
  on_answer,
}: PeriodGoalPickProps) {
  const period_name = format_period(PERIOD_GOAL_PERIOD);
  const is_locked = is_saved
    ? (question?.is_locked ?? true)
    : (current_period ?? 1) >= PERIOD_GOAL_PERIOD;
  const answer = picks.period_goal?.period === PERIOD_GOAL_PERIOD ? picks.period_goal.answer : null;

  return (
    <Card>
      <SectionTitle
        title={during_copy.period_goal_title(period_name)}
        align="center"
        right={<PointsBadge text={`+${String(POINTS.period_goal)}`} />}
      />
      <ChoiceButtons
        label={during_copy.period_goal_group}
        size="medium"
        choices={[
          { id: "yes", label: during_copy.yes },
          { id: "no", label: during_copy.no },
        ]}
        selected_id={answer}
        disabled={is_locked || (is_saved && answer !== null)}
        on_select={on_answer}
      />
      <p className={styles.note}>
        {is_locked
          ? during_copy.period_goal_locked(period_name)
          : during_copy.period_goal_note(period_name)}
      </p>
    </Card>
  );
}
